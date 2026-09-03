/* The stored ai_settings row, and the resolved view the rest of the app
   reads. Pure and free of Supabase, because the server resolves it on every
   AI call and the settings page merges the same way in the browser.

   The row follows the code: reconcile() lines both maps up with the two
   registries, adding entries for new areas and providers and marking entries
   inactive when their code has gone. Inactive entries are kept so the page can
   show what was removed and when, but nothing ever runs on them. */

import { AI_AREAS, aiArea, isAiAreaKey, type AiAreaKey } from "./areas";
import { resolveBaseUrl } from "./endpoints";
import { AI_PROVIDERS, aiProvider, isAiProviderId, providerCovers } from "./providers/registry";
import type { AiKind, AiProviderId } from "./providers/types";

export type StoredStamp = {
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
};

export type StoredProvider = StoredStamp & {
  label: string;
  api_base_url: string | null;
};

export type StoredArea = StoredStamp & {
  label: string;
  kind: AiKind;
  provider: string;
  model: string;
  api_base_url: string | null;
};

export type StoredMaps = {
  providers: Record<string, StoredProvider>;
  areas: Record<string, StoredArea>;
};

export type AiSettingsRow = StoredMaps & {
  id?: number;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export type ResolvedProvider = {
  id: AiProviderId;
  label: string;
  defaultBaseUrl: string;
  baseUrl: string;
  overrideUrl: string | null;
  stamp: StoredStamp | null;
};

export type ResolvedArea = {
  key: AiAreaKey;
  label: string;
  description: string;
  kind: AiKind;
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  overrideUrl: string | null;
  /* True when the stored provider is gone or cannot do what the area needs,
     so the area is running on its defaults instead. */
  providerFallback: boolean;
  stamp: StoredStamp | null;
};

export type AiSettings = {
  providers: Record<AiProviderId, ResolvedProvider>;
  areas: Record<AiAreaKey, ResolvedArea>;
  retiredProviders: Record<string, StoredProvider>;
  retiredAreas: Record<string, StoredArea>;
};

export const EMPTY_MAPS: StoredMaps = { providers: {}, areas: {} };

function newStamp(now: string, employeeId: number | null): StoredStamp {
  return { active: true, created_at: now, updated_at: now, created_by: employeeId, updated_by: employeeId };
}

function touched<T extends StoredStamp>(entry: T, now: string, employeeId: number | null, patch: Partial<T>): T {
  return { ...entry, ...patch, updated_at: now, updated_by: employeeId };
}

function stampOf(entry: StoredStamp | undefined): StoredStamp | null {
  if (!entry) return null;
  const { active, created_at, updated_at, created_by, updated_by } = entry;
  return { active, created_at, updated_at, created_by, updated_by };
}

function safeMaps(row: Partial<StoredMaps> | null | undefined): StoredMaps {
  return {
    providers: row?.providers && typeof row.providers === "object" ? row.providers : {},
    areas: row?.areas && typeof row.areas === "object" ? row.areas : {},
  };
}

export function mergeAiSettings(row: Partial<AiSettingsRow> | null | undefined): AiSettings {
  const maps = safeMaps(row);

  const providers = {} as Record<AiProviderId, ResolvedProvider>;
  for (const provider of AI_PROVIDERS) {
    const stored = maps.providers[provider.id];
    const overrideUrl = stored?.api_base_url?.trim() || null;
    providers[provider.id] = {
      id: provider.id,
      label: provider.label,
      defaultBaseUrl: provider.defaultBaseUrl,
      baseUrl: resolveBaseUrl(null, overrideUrl, provider.defaultBaseUrl),
      overrideUrl,
      stamp: stampOf(stored),
    };
  }

  const areas = {} as Record<AiAreaKey, ResolvedArea>;
  for (const area of AI_AREAS) {
    const stored = maps.areas[area.key];
    const storedProviderOk =
      !!stored &&
      isAiProviderId(stored.provider) &&
      (maps.providers[stored.provider]?.active ?? true) &&
      providerCovers(aiProvider(stored.provider), area.needs);
    const providerFallback = !!stored && !storedProviderOk;
    const providerId: AiProviderId = storedProviderOk ? (stored.provider as AiProviderId) : area.defaultProvider;
    const model = storedProviderOk && stored.model?.trim() ? stored.model.trim() : area.defaultModel;
    const overrideUrl = storedProviderOk ? stored.api_base_url?.trim() || null : null;
    areas[area.key] = {
      key: area.key,
      label: area.label,
      description: area.description,
      kind: area.kind,
      provider: providerId,
      model,
      baseUrl: resolveBaseUrl(overrideUrl, providers[providerId].overrideUrl, providers[providerId].defaultBaseUrl),
      overrideUrl,
      providerFallback,
      stamp: stampOf(stored),
    };
  }

  const retiredProviders: Record<string, StoredProvider> = {};
  for (const [id, entry] of Object.entries(maps.providers)) {
    if (!isAiProviderId(id)) retiredProviders[id] = entry;
  }
  const retiredAreas: Record<string, StoredArea> = {};
  for (const [key, entry] of Object.entries(maps.areas)) {
    if (!isAiAreaKey(key)) retiredAreas[key] = entry;
  }

  return { providers, areas, retiredProviders, retiredAreas };
}

export function reconcile(
  input: Partial<StoredMaps> | null | undefined,
  now: string,
  employeeId: number | null
): { maps: StoredMaps; changed: boolean } {
  const maps = safeMaps(input);
  let changed = false;
  const providers: Record<string, StoredProvider> = { ...maps.providers };
  const areas: Record<string, StoredArea> = { ...maps.areas };

  for (const provider of AI_PROVIDERS) {
    const existing = providers[provider.id];
    if (!existing) {
      providers[provider.id] = { label: provider.label, api_base_url: null, ...newStamp(now, employeeId) };
      changed = true;
    } else if (!existing.active || existing.label !== provider.label) {
      providers[provider.id] = touched(existing, now, employeeId, { active: true, label: provider.label });
      changed = true;
    }
  }
  for (const [id, entry] of Object.entries(providers)) {
    if (!isAiProviderId(id) && entry.active) {
      providers[id] = touched(entry, now, employeeId, { active: false });
      changed = true;
    }
  }

  for (const area of AI_AREAS) {
    const existing = areas[area.key];
    if (!existing) {
      areas[area.key] = {
        label: area.label,
        kind: area.kind,
        provider: area.defaultProvider,
        model: area.defaultModel,
        api_base_url: null,
        ...newStamp(now, employeeId),
      };
      changed = true;
    } else if (!existing.active || existing.label !== area.label || existing.kind !== area.kind) {
      areas[area.key] = touched(existing, now, employeeId, { active: true, label: area.label, kind: area.kind });
      changed = true;
    }
  }
  for (const [key, entry] of Object.entries(areas)) {
    if (!isAiAreaKey(key) && entry.active) {
      areas[key] = touched(entry, now, employeeId, { active: false });
      changed = true;
    }
  }

  return { maps: { providers, areas }, changed };
}

export type AreaChoice = { provider: AiProviderId; model: string; overrideUrl: string | null };

export type SettingsChoices = {
  providerUrls: Partial<Record<AiProviderId, string | null>>;
  areas: Partial<Record<AiAreaKey, AreaChoice>>;
};

/* Writes the page's choices over a reconciled map, touching only the entries
   whose provider, model or URL actually changed. */
export function applyChoices(
  reconciled: StoredMaps,
  choices: SettingsChoices,
  now: string,
  employeeId: number | null
): { maps: StoredMaps; changed: boolean } {
  let changed = false;
  const providers = { ...reconciled.providers };
  const areas = { ...reconciled.areas };

  for (const [id, url] of Object.entries(choices.providerUrls)) {
    if (!isAiProviderId(id) || !providers[id]) continue;
    const next = url?.trim() || null;
    if (providers[id].api_base_url !== next) {
      providers[id] = touched(providers[id], now, employeeId, { api_base_url: next });
      changed = true;
    }
  }

  for (const [key, choice] of Object.entries(choices.areas)) {
    if (!isAiAreaKey(key) || !areas[key] || !choice) continue;
    const next = { provider: choice.provider, model: choice.model.trim(), api_base_url: choice.overrideUrl?.trim() || null };
    const current = areas[key];
    if (current.provider !== next.provider || current.model !== next.model || current.api_base_url !== next.api_base_url) {
      areas[key] = touched(current, now, employeeId, next);
      changed = true;
    }
  }

  return { maps: { providers, areas }, changed };
}

export function defaultChoices(): SettingsChoices {
  const providerUrls: SettingsChoices["providerUrls"] = {};
  for (const provider of AI_PROVIDERS) providerUrls[provider.id] = null;
  const areas: SettingsChoices["areas"] = {};
  for (const area of AI_AREAS) {
    areas[area.key] = { provider: area.defaultProvider, model: area.defaultModel, overrideUrl: null };
  }
  return { providerUrls, areas };
}

export type Endpoint = { provider: AiProviderId; baseUrl: string };

export function endpointKey(endpoint: Endpoint): string {
  return `${endpoint.provider}|${endpoint.baseUrl}`;
}

/* Every provider + URL pair something runs on, each once, so the settings
   page fetches one model list per endpoint rather than per area. */
export function distinctEndpoints(settings: AiSettings): Endpoint[] {
  const seen = new Map<string, Endpoint>();
  for (const provider of Object.values(settings.providers)) {
    const endpoint = { provider: provider.id, baseUrl: provider.baseUrl };
    seen.set(endpointKey(endpoint), endpoint);
  }
  for (const area of Object.values(settings.areas)) {
    const endpoint = { provider: area.provider, baseUrl: area.baseUrl };
    seen.set(endpointKey(endpoint), endpoint);
  }
  return [...seen.values()];
}

export function areaOptionsFor(key: AiAreaKey) {
  return aiArea(key);
}
