/* Reading the copy an email should actually use.

   A row in email_templates overrides the registry default one slot at a time -
   a null column means "not overridden", so editing only the subject keeps
   whatever copy later ships for the body. An empty string is a real override:
   clearing the footnote is a thing an admin can want.

   Every send site goes through resolveTemplate, so the admin page and the mail
   that lands in an inbox can never disagree. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_SCENARIOS, findScenario } from "./scenarios";
import { renderSlots, type MergeValues, type TemplateSlots } from "./render";
import { mergeOverride, type EmailTemplateRow, type ResolvedTemplate } from "./merge";

export { mergeOverride };
export type { EmailTemplateRow, ResolvedTemplate };

/* Both the cookie-based server client and the service-role admin client read
   templates - booking notifications run on the latter - so this is typed at the
   client they have in common rather than at either one. */
type TemplateClient = SupabaseClient;

export async function resolveTemplate(
  supabase: TemplateClient,
  key: string
): Promise<ResolvedTemplate | null> {
  const scenario = findScenario(key);
  if (!scenario) {
    console.error(`[email templates] unknown scenario "${key}"`);
    return null;
  }

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("scenario_key", key)
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
  const { data, error } = await supabase.from("email_templates").select("*");

  if (error) {
    console.error("[email templates] could not read overrides:", error.message);
    return EMAIL_SCENARIOS.map((scenario) => mergeOverride(scenario, null));
  }

  const byKey = new Map(((data ?? []) as EmailTemplateRow[]).map((row) => [row.scenario_key, row]));
  return EMAIL_SCENARIOS.map((scenario) => mergeOverride(scenario, byKey.get(scenario.key) ?? null));
}

/* What a send site calls: resolved copy with the merge values filled in, or null
   when the scenario has been switched off. */
export async function renderTemplate(
  supabase: TemplateClient,
  key: string,
  values: MergeValues
): Promise<TemplateSlots | null> {
  const resolved = await resolveTemplate(supabase, key);
  if (!resolved || !resolved.isActive) return null;

  const { slots, unknownTokens } = renderSlots(resolved.slots, values);
  if (unknownTokens.length > 0) {
    console.error(
      `[email templates] "${key}" references unknown fields: ${unknownTokens.join(", ")}`
    );
  }
  return slots;
}
