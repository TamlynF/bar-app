/* WhatsApp has no segment limit, so every line goes in, with WhatsApp's own
   *bold* for the headline. A business-initiated message outside a 24-hour
   conversation must be an approved template, so the same content is also
   offered as the template's numbered variables. */
export const WHATSAPP_MAX_PER_NIGHT = 6;
export const WHATSAPP_MAX_LINES = 8;

type Copy = { lines: string[]; crash: boolean; marketUrl: string; stopUrl: string };

function shownLines(lines: string[]): string[] {
  if (lines.length <= WHATSAPP_MAX_LINES) return lines;
  const kept = lines.slice(0, WHATSAPP_MAX_LINES - 1);
  return [...kept, `+${lines.length - kept.length} more on the board`];
}

export function marketWhatsappBody(p: Copy): string {
  const heading = p.crash ? "*Market crash - buy the dip*" : "*Market Night - prices just moved*";
  return [heading, "", ...shownLines(p.lines).map((line) => `• ${line}`), "", `Live board: ${p.marketUrl}`, `Stop these: ${p.stopUrl}`].join("\n");
}

/* Variables for the approved template, whose body reads:
     {{1}}
     {{2}}
     Live board: {{3}}
     Stop these: {{4}}
   Template variables can't contain newlines, so the drink lines are joined. */
export function marketWhatsappTemplateVariables(p: Copy): Record<string, string> {
  return {
    "1": p.crash ? "Market crash - buy the dip" : "Market Night - prices just moved",
    "2": shownLines(p.lines).join(" · "),
    "3": p.marketUrl,
    "4": p.stopUrl,
  };
}
