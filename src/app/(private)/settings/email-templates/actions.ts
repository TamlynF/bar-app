"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { findScenario } from "@/lib/email/scenarios";
import { SLOT_KEYS, tokensUsed, type SlotKey, type TemplateSlots } from "@/lib/email/render";
import { EMPTY_SLOTS } from "@/lib/email/render";

const COLUMN_FOR_SLOT: Record<SlotKey, string> = {
  subject: "subject",
  heading: "heading",
  eyebrow: "eyebrow",
  greeting: "greeting",
  intro: "intro",
  outro: "outro",
  ctaLabel: "cta_label",
  footnote: "footnote",
};

export async function saveEmailTemplateAction(formData: FormData) {
  const key = String(formData.get("scenario_key") ?? "");
  const scenario = findScenario(key);
  if (!scenario) return { error: "That email scenario no longer exists." };

  const edited: TemplateSlots = { ...EMPTY_SLOTS };
  for (const slot of scenario.slots) {
    edited[slot] = String(formData.get(slot) ?? "").trim();
  }
  for (const slot of SLOT_KEYS) {
    if (!scenario.slots.includes(slot)) edited[slot] = scenario.defaults[slot];
  }

  if (!edited.subject) return { error: "A subject line is required - the email cannot send without one." };

  const declared = new Set(scenario.mergeFields.map((f) => f.token));
  const unknown = tokensUsed(edited).filter((token) => !declared.has(token));
  if (unknown.length > 0) {
    return {
      error: `This email has no field called ${unknown.map((t) => `{{${t}}}`).join(", ")}. Use one of the fields listed above, or remove it.`,
    };
  }

  /* Only the slots that differ from the built-in copy are stored. Everything
     else stays null, so a scenario keeps inheriting later wording changes for
     the parts nobody has deliberately rewritten. */
  const payload: Record<string, string | null> = {};
  for (const slot of SLOT_KEYS) {
    const column = COLUMN_FOR_SLOT[slot];
    payload[column] = edited[slot] === scenario.defaults[slot] ? null : edited[slot];
  }

  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("email_templates")
    .select("id, created_at, created_by")
    .eq("scenario_key", key)
    .maybeSingle();

  const { error } = await supabase.from("email_templates").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      scenario_key: key,
      ...payload,
      created_at: existing?.created_at ?? now,
      created_by: existing?.created_by ?? employeeId,
      updated_at: now,
      updated_by: employeeId,
    },
    { onConflict: "scenario_key" }
  );

  if (error) {
    console.error("Email template save failed:", error);
    return { error: "Could not save this template." };
  }

  revalidatePath("/settings/email-templates");
  return { success: true };
}

/* Deleting the row is what "reset" means - the scenario falls back to the copy
   that ships with the code, so it can never be left unable to send. */
export async function resetEmailTemplateAction(key: string) {
  if (!findScenario(key)) return { error: "That email scenario no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("email_templates").delete().eq("scenario_key", key);

  if (error) {
    console.error("Email template reset failed:", error);
    return { error: "Could not reset this template." };
  }

  revalidatePath("/settings/email-templates");
  return { success: true };
}

export async function setEmailTemplateActiveAction(key: string, isActive: boolean) {
  if (!findScenario(key)) return { error: "That email scenario no longer exists." };

  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("email_templates")
    .select("id, created_at, created_by")
    .eq("scenario_key", key)
    .maybeSingle();

  const { error } = await supabase.from("email_templates").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      scenario_key: key,
      is_active: isActive,
      created_at: existing?.created_at ?? now,
      created_by: existing?.created_by ?? employeeId,
      updated_at: now,
      updated_by: employeeId,
    },
    { onConflict: "scenario_key" }
  );

  if (error) {
    console.error("Email template activation failed:", error);
    return { error: "Could not change whether this email sends." };
  }

  revalidatePath("/settings/email-templates");
  return { success: true };
}
