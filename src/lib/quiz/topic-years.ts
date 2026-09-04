/* A music-snippet topic is usually a genre, but hosts also type a period -
   "60s", "1965-1970", "1985". When it reads as a period the round is only
   correct if every song sits inside it, so the years are pulled out here and
   enforced on the model's answer rather than trusted to the prompt. */

export type TopicYearWindow = { from: number; to: number }

const DECADE_ANCHOR: Record<string, number> = {
  '00': 2000,
  '10': 2010,
  '20': 2020,
  '30': 1930,
  '40': 1940,
  '50': 1950,
  '60': 1960,
  '70': 1970,
  '80': 1980,
  '90': 1990,
}

const NAMED_DECADE: Record<string, number> = {
  fifties: 1950,
  sixties: 1960,
  seventies: 1970,
  eighties: 1980,
  nineties: 1990,
  noughties: 2000,
}

const RANGE = /\b((?:19|20)\d{2})\s*(?:-|–|-|to|until|through)\s*((?:19|20)\d{2})\b/
const FOUR_DIGIT_DECADE = /\b((?:19|20)\d0)s\b/g
const TWO_DIGIT_DECADE = /(?:^|[^\d])'?(\d0)'?s\b/g
const NAMED = /\b(fifties|sixties|seventies|eighties|nineties|noughties)\b/g
const BARE_YEAR = /\b((?:19|20)\d{2})\b/g

export function parseTopicYearWindow(topic: string | null | undefined): TopicYearWindow | null {
  const text = (topic ?? '').toLowerCase().trim()
  if (!text) return null

  const range = RANGE.exec(text)
  if (range) {
    const a = Number(range[1])
    const b = Number(range[2])
    return { from: Math.min(a, b), to: Math.max(a, b) }
  }

  const bounds: TopicYearWindow[] = []

  for (const m of text.matchAll(FOUR_DIGIT_DECADE)) {
    const start = Number(m[1])
    bounds.push({ from: start, to: start + 9 })
  }

  /* The digit-guard keeps this off the "60" inside "1960s", which the
     four-digit pass has already read. */
  for (const m of text.matchAll(TWO_DIGIT_DECADE)) {
    const anchor = DECADE_ANCHOR[m[1]]
    if (anchor) bounds.push({ from: anchor, to: anchor + 9 })
  }

  for (const m of text.matchAll(NAMED)) {
    const anchor = NAMED_DECADE[m[1]]
    if (anchor) bounds.push({ from: anchor, to: anchor + 9 })
  }

  for (const m of text.matchAll(BARE_YEAR)) {
    const year = Number(m[1])
    bounds.push({ from: year, to: year })
  }

  if (!bounds.length) return null

  return {
    from: Math.min(...bounds.map((b) => b.from)),
    to: Math.max(...bounds.map((b) => b.to)),
  }
}

export function withinTopicYears(
  year: number | null | undefined,
  window: TopicYearWindow
): boolean {
  if (year == null || !Number.isFinite(year)) return false
  return year >= window.from && year <= window.to
}
