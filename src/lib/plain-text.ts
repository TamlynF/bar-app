/* Rich-text fields (specials, merchandise) are stored as HTML from the admin
   editor; a one-line summary on a card wants only the words. */
export function plainText(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
