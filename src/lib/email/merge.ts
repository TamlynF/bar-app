/* Merging a stored override over a scenario's built-in copy.

   Pure and free of any Supabase import, because both sides need it: the server
   resolves templates when sending, and the settings page merges the same way in
   the browser so the editor and the preview agree without a round trip. */

import { SLOT_KEYS, type SlotKey } from "./render";
import { scenarioFamily, type EmailScenario } from "./scenarios";
import { sanitizeAttachments, sanitizeBlocks, type EmailBlock, type TemplateAttachment } from "./design";

export type EmailTemplateRow = {
  id: number;
  scenario_key: string;
  variant_name?: string | null;
  subject: string | null;
  heading: string | null;
  eyebrow: string | null;
  greeting: string | null;
  intro: string | null;
  outro: string | null;
  cta_label: string | null;
  footnote: string | null;
  card_title?: string | null;
  note_title?: string | null;
  blocks?: unknown;
  attachments?: unknown;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  created_by: number | null;
  updated_by: number | null;
};

export type ResolvedTemplate = {
  scenario: EmailScenario;
  slots: Record<SlotKey, string>;
  isActive: boolean;
  /* False when the scenario is running entirely on its built-in copy - drives
     the Default / Customised pill and whether "Reset to default" does anything. */
  isCustomised: boolean;
  /* The body as blocks, or null for the standard layout. */
  blocks: EmailBlock[] | null;
  /* Files sent with every email from this template. */
  attachments: TemplateAttachment[];
  row: EmailTemplateRow | null;
};

export const COLUMN_FOR_SLOT: Record<SlotKey, keyof EmailTemplateRow> = {
  subject: "subject",
  heading: "heading",
  eyebrow: "eyebrow",
  greeting: "greeting",
  intro: "intro",
  outro: "outro",
  ctaLabel: "cta_label",
  footnote: "footnote",
  cardTitle: "card_title",
  noteTitle: "note_title",
};

export function mergeOverride(
  scenario: EmailScenario,
  row: EmailTemplateRow | null
): ResolvedTemplate {
  const slots = { ...scenario.defaults };
  let isCustomised = false;

  if (row) {
    for (const key of SLOT_KEYS) {
      const stored = row[COLUMN_FOR_SLOT[key]];
      if (typeof stored === "string") {
        slots[key] = stored;
        isCustomised = true;
      }
    }
  }

  const blocks = row?.blocks ? sanitizeBlocks(row.blocks, scenarioFamily(scenario)) : null;
  const attachments = sanitizeAttachments(row?.attachments, scenario.key);

  return {
    scenario,
    slots,
    isActive: row?.is_active ?? true,
    isCustomised: isCustomised || !!blocks || attachments.length > 0,
    blocks,
    attachments,
    row,
  };
}
