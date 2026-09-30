/* The gold ticker across the top of the home page reads the company tagline
   as a comma-separated list, so staff change it from Settings → Company
   without a deploy. An empty tagline falls back to the ticker's own phrases. */
export function taglineItems(tagline: string | null | undefined): { text: string }[] | undefined {
  const items = (tagline ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
  return items.length ? items : undefined;
}
