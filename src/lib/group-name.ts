export function normalizeGroupName(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toLowerCase();
}
