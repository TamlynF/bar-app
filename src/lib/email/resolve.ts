/* Reading the copy an email should actually use.

   A row in email_templates overrides the registry default one slot at a time -
   a null column means "not overridden", so editing only the subject keeps
   whatever copy later ships for the body. An empty string is a real override:
   clearing the footnote is a thing an admin can want.

   Every send site goes through resolveTemplate, so the admin page and the mail
   that lands in an inbox can never disagree. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_SCENARIOS, findScenario } from "./scenarios";
import { renderSlots, type MergeValues } from "./render";
import { brandFromRow, fillBlocks, type EmailBrand, type EmailBrandRow, type RenderedSlots } from "./design";
import { mergeOverride, type EmailTemplateRow, type ResolvedTemplate } from "./merge";

export { mergeOverride };
export type { EmailTemplateRow, ResolvedTemplate };

/* Both the cookie-based server client and the service-role admin client read
   templates - booking notifications run on the latter - so this is typed at the
   client they have in common rather than at either one. */
type TemplateClient = SupabaseClient;

export async function resolveTemplate(
  supabase: TemplateClient,
  key: string,
  versionId?: number | null
): Promise<ResolvedTemplate | null> {
  const scenario = findScenario(key);
  if (!scenario) {
    console.error(`[email templates] unknown scenario "${key}"`);
    return null;
  }

  /* A chosen version that has since been deleted, or that belongs to another
     email, falls back to Standard rather than leaving the booking unsent. */
  if (versionId) {
    const { data: version, error: versionError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", versionId)
      .eq("scenario_key", key)
      .not("variant_name", "is", null)
      .maybeSingle();
    if (versionError) console.error("[email templates] could not read version:", versionError.message);
    if (version) return mergeOverride(scenario, version as EmailTemplateRow);
  }

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("scenario_key", key)
    .is("variant_name", null)
    .maybeSingle();

  if (error) {
    /* The registry defaults are a complete, working set of emails, so a failed
       read degrades to "nothing is overridden" rather than stopping a booking
       confirmation from going out. */
    console.error("[email templates] could not read override:", error.message);
    return mergeOverride(scenario, null);
  }

  return mergeOverride(scenario, (data as EmailTemplateRow | null) ?? null);
}

export async function resolveAllTemplates(supabase: TemplateClient): Promise<ResolvedTemplate[]> {
  const { data, error } = await supabase.from("email_templates").select("*").is("variant_name", null);

  if (error) {
    console.error("[email templates] could not read overrides:", error.message);
    return EMAIL_SCENARIOS.map((scenario) => mergeOverride(scenario, null));
  }

  const byKey = new Map(((data ?? []) as EmailTemplateRow[]).map((row) => [row.scenario_key, row]));
  return EMAIL_SCENARIOS.map((scenario) => mergeOverride(scenario, byKey.get(scenario.key) ?? null));
}

/* What a send site calls: resolved copy with the merge values filled in, or null
   when the scenario has been switched off. */
export async function resolveBrand(supabase: TemplateClient): Promise<EmailBrand> {
  const { data, error } = await supabase.from("email_brand").select("*").eq("id", 1).maybeSingle();
  /* No brand row, or no read, means every design keeps its own look. */
  if (error) console.error("[email templates] could not read brand:", error.message);
  return brandFromRow((data as EmailBrandRow | null) ?? null);
}

export async function renderTemplate(
  supabase: TemplateClient,
  key: string,
  values: MergeValues,
  versionId?: number | null
): Promise<RenderedSlots | null> {
  const [resolved, brand] = await Promise.all([
    resolveTemplate(supabase, key, versionId),
    resolveBrand(supabase),
  ]);
  if (!resolved || !resolved.isActive) return null;

  const { slots, unknownTokens } = renderSlots(resolved.slots, values);
  const unknown = new Set(unknownTokens);
  const blocks = resolved.blocks ? fillBlocks(resolved.blocks, values, unknown) : null;
  if (unknown.size > 0) {
    console.error(`[email templates] "${key}" references unknown fields: ${[...unknown].join(", ")}`);
  }
  return { ...slots, design: { brand, blocks, attachments: resolved.attachments } };
}
