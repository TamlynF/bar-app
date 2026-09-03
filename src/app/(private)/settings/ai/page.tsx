import { createClient } from "@/lib/supabase/server";
import { AI_PROVIDERS } from "@/lib/ai/providers/registry";
import type { AiModelListResult, AiProviderId } from "@/lib/ai/providers/types";
import { apiKeyFor, listModelsFor, syncAiSettings } from "@/lib/ai/settings";
import { distinctEndpoints, endpointKey } from "@/lib/ai/settings-shape";
import AiSettingsClient from "./ai-settings-client";

export default async function AiSettingsPage() {
  const { row, settings } = await syncAiSettings();
  const supabase = await createClient();

  const endpoints = distinctEndpoints(settings);
  const [catalogueEntries, { data: employees }] = await Promise.all([
    Promise.all(
      endpoints.map(async (endpoint) => [endpointKey(endpoint), await listModelsFor(endpoint.provider, endpoint.baseUrl)] as const)
    ),
    supabase.from("employees").select("id, full_name"),
  ]);

  const catalogues: Record<string, AiModelListResult> = Object.fromEntries(catalogueEntries);
  const keyStatus = Object.fromEntries(
    AI_PROVIDERS.map((provider) => [provider.id, !!apiKeyFor(provider.id)])
  ) as Record<AiProviderId, boolean>;

  return (
    <AiSettingsClient
      row={row}
      settings={settings}
      catalogues={catalogues}
      keyStatus={keyStatus}
      employees={employees ?? []}
    />
  );
}
