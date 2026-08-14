/* What the round sheet opens with. Reopening a round to add the rest of it
   should not mean retyping the topic, the difficulty and the picture
   instructions the first batch was created with - so the settings are read back
   off the questions that batch saved.

   The most recently saved question wins outright rather than each field being
   taken from wherever it was last non-null: the three settings were chosen
   together, and clearing the picture instructions has to stay cleared rather
   than being resurrected from an older run. Rows saved before the settings were
   recorded simply leave the sheet on its own defaults. */

export type RoundSettingsRow = {
  quiz_category_configs_id: number | null;
  topic?: string | null;
  difficulty?: string | null;
  image_notes?: string | null;
  created_at?: string | null;
};

export type RoundSettings = {
  topic: string;
  difficulty: string;
  imageNotes: string;
};

export const EMPTY_ROUND_SETTINGS: RoundSettings = {
  topic: "",
  difficulty: "",
  imageNotes: "",
};

/* A batch is inserted with one timestamp across every row, so equal timestamps
   carry the same settings and later-in-the-list is a safe tie-break. */
export function lastRoundSettings(
  rows: RoundSettingsRow[]
): Map<number, RoundSettings> {
  const latest = new Map<number, RoundSettingsRow>();

  for (const row of rows) {
    const configId = row.quiz_category_configs_id;
    if (configId == null) continue;

    const held = latest.get(configId);
    if (held && (held.created_at ?? "") > (row.created_at ?? "")) continue;
    latest.set(configId, row);
  }

  return new Map(
    [...latest].map(([configId, row]) => [
      configId,
      {
        topic: row.topic?.trim() ?? "",
        difficulty: row.difficulty?.trim() ?? "",
        imageNotes: row.image_notes?.trim() ?? "",
      },
    ])
  );
}
