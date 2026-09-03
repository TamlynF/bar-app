/* Server-side access to the ai_settings row. getAiSettings() is what every AI
   call reads and never writes; syncAiSettings() is the settings page's entry
   point and is the only place the row is reconciled against the code. */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { aiProvider } from "./providers/registry";
import type { AiModelListResult, AiProviderId } from "./providers/types";
import {
  mergeAiSettings,
  reconcile,
  type AiSettings,
  type AiSettingsRow,
  type StoredMaps,
} from "./settings-shape";

export const getAiSettingsRow = cache(async (): Promise<AiSettingsRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AiSettingsRow | null) ?? null;
});

export const getAiSettings = cache(async (): Promise<AiSettings> => mergeAiSettings(await getAiSettingsRow()));

export async function syncAiSettings(): Promise<{ row: AiSettingsRow; settings: AiSettings; employeeId: number | null }> {
  const supabase = await createClient();
  const [row, employeeId] = await Promise.all([getAiSettingsRow(), getCurrentEmployeeId(supabase)]);
  const now = new Date().toISOString();
  const { maps, changed } = reconcile(row, now, employeeId);

  if (row && !changed) return { row, settings: mergeAiSettings(row), employeeId };

  const saved = await writeAiSettings(maps, row, now, employeeId);
  return { row: saved, settings: mergeAiSettings(saved), employeeId };
}

export async function writeAiSettings(
  maps: StoredMaps,
  existing: AiSettingsRow | null,
  now: string,
  employeeId: number | null
): Promise<AiSettingsRow> {
  const supabase = await createClient();
  const payload = {
    ...(existing?.id ? { id: existing.id } : {}),
    providers: maps.providers,
    areas: maps.areas,
    created_at: existing?.created_at ?? now,
    created_by: existing?.created_by ?? employeeId,
    updated_at: now,
    updated_by: employeeId,
  };
  const { data, error } = await supabase.from("ai_settings").upsert(payload).select("*").single();
  if (error) {
    console.error("AI settings save failed:", error);
    throw new Error("Could not save the AI settings.");
  }
  return data as AiSettingsRow;
}

export function apiKeyFor(providerId: AiProviderId): string {
  for (const name of aiProvider(providerId).apiKeyEnv) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

export async function listModelsFor(providerId: AiProviderId, baseUrl: string): Promise<AiModelListResult> {
  const apiKey = apiKeyFor(providerId);
  if (!apiKey) {
    const names = aiProvider(providerId).apiKeyEnv.join(" or ");
    return { error: `No API key is set for ${aiProvider(providerId).label}. Set ${names} in the environment.` };
  }
  return aiProvider(providerId).adapter.listModels(baseUrl, apiKey);
}
