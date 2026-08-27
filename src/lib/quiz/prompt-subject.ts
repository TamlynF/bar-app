/* Some round names describe the scoring format, not a subject. Asking the model
   for a round about "High Stakes" yields questions about gambling; the round is
   still a general knowledge round, just scored differently. */

const SUBJECT_OVERRIDES: Array<{ match: string; subject: string }> = [
  { match: "highstakes", subject: "General Knowledge" },
];

const normalise = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function promptSubject(categoryName: string): string {
  const key = normalise(categoryName);
  return SUBJECT_OVERRIDES.find((o) => key.includes(o.match))?.subject ?? categoryName;
}
