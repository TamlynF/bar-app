"use server";

import { revalidatePath } from "next/cache";
import { aiArea, isAiAreaKey } from "@/lib/ai/areas";
import { normaliseOptionalBaseUrl } from "@/lib/ai/endpoints";
import { AI_PROVIDERS, aiProvider, isAiProviderId, providerCovers } from "@/lib/ai/providers/registry";
import { syncAiSettings, writeAiSettings } from "@/lib/ai/settings";
import { applyChoices, defaultChoices, type SettingsChoices } from "@/lib/ai/settings-shape";

type ActionResult = { success: true; error?: undefined } | { success?: undefined; error: string };

function providerUrlsFromForm(formData: FormData): SettingsChoices | { error: string } {
  const choices: SettingsChoices = { providerUrls: {}, areas: {} };
  for (const provider of AI_PROVIDERS) {
    const check = normaliseOptionalBaseUrl(formData.get(`provider_url_${provider.id}`)?.toString());
    if ("error" in check) return { error: `${provider.label}: ${check.error}` };
    choices.providerUrls[provider.id] = check.url;
  }
  return choices;
}

function areaChoiceFromForm(formData: FormData): SettingsChoices | { error: string } {
  const key = formData.get("key")?.toString() ?? "";
  if (!isAiAreaKey(key)) return { error: "This area is no longer used and cannot be changed." };
  const area = aiArea(key);

  const providerId = formData.get("provider")?.toString() ?? "";
  if (!isAiProviderId(providerId)) return { error: "Choose a provider." };
  if (!providerCovers(aiProvider(providerId), area.needs)) {
    return { error: `${aiProvider(providerId).label} cannot do what this area needs.` };
  }
  const model = formData.get("model")?.toString().trim() ?? "";
  if (!model) return { error: "Choose a model." };
  const override = normaliseOptionalBaseUrl(formData.get("base_url")?.toString());
  if ("error" in override) return { error: override.error };

  return { providerUrls: {}, areas: { [key]: { provider: providerId, model, overrideUrl: override.url } } };
}

async function persist(choices: SettingsChoices): Promise<ActionResult> {
  try {
    const { row, employeeId } = await syncAiSettings();
    const now = new Date().toISOString();
    const { maps, changed } = applyChoices({ providers: row.providers, areas: row.areas }, choices, now, employeeId);
    if (changed) await writeAiSettings(maps, row, now, employeeId);
    revalidatePath("/settings/ai");
    return { success: true };
  } catch (error) {
    console.error("AI settings save failed:", error);
    return { error: error instanceof Error ? error.message : "Could not save the AI settings." };
  }
}

export async function saveAiProvidersAction(formData: FormData): Promise<ActionResult> {
  const choices = providerUrlsFromForm(formData);
  if ("error" in choices) return choices;
  return persist(choices);
}

export async function saveAiAreaAction(formData: FormData): Promise<ActionResult> {
  const choices = areaChoiceFromForm(formData);
  if ("error" in choices) return choices;
  return persist(choices);
}

export async function resetAiSettingsAction(): Promise<ActionResult> {
  return persist(defaultChoices());
}
