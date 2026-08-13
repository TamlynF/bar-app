import { describe, it, expect } from 'vitest'
import { parseTopicYearWindow, withinTopicYears } from '@/lib/quiz/topic-years'

describe('parseTopicYearWindow', () => {
  it('reads a two-digit decade', () => {
    expect(parseTopicYearWindow('60s')).toEqual({ from: 1960, to: 1969 })
    expect(parseTopicYearWindow("'80s")).toEqual({ from: 1980, to: 1989 })
    expect(parseTopicYearWindow('90s dance')).toEqual({ from: 1990, to: 1999 })
  })

  it('reads recent two-digit decades as this century', () => {
    expect(parseTopicYearWindow('00s')).toEqual({ from: 2000, to: 2009 })
    expect(parseTopicYearWindow('20s')).toEqual({ from: 2020, to: 2029 })
  })

  it('reads a four-digit decade without double-counting the trailing digits', () => {
    expect(parseTopicYearWindow('1960s')).toEqual({ from: 1960, to: 1969 })
    expect(parseTopicYearWindow('2010s indie')).toEqual({ from: 2010, to: 2019 })
  })

  it('reads named decades', () => {
    expect(parseTopicYearWindow('the seventies')).toEqual({ from: 1970, to: 1979 })
  })

  it('spans every period mentioned', () => {
    expect(parseTopicYearWindow('1960s and 70s')).toEqual({ from: 1960, to: 1979 })
  })

  it('reads an explicit range', () => {
    expect(parseTopicYearWindow('1965-1970')).toEqual({ from: 1965, to: 1970 })
    expect(parseTopicYearWindow('1975 to 1982')).toEqual({ from: 1975, to: 1982 })
    expect(parseTopicYearWindow('1990 – 1985')).toEqual({ from: 1985, to: 1990 })
  })

  it('reads a single year', () => {
    expect(parseTopicYearWindow('1985')).toEqual({ from: 1985, to: 1985 })
  })

  it('returns null when the topic carries no period', () => {
    expect(parseTopicYearWindow('motown')).toBeNull()
    expect(parseTopicYearWindow('one hit wonders')).toBeNull()
    expect(parseTopicYearWindow('')).toBeNull()
    expect(parseTopicYearWindow(null)).toBeNull()
  })

  it('ignores numbers that are not years', () => {
    expect(parseTopicYearWindow('top 40')).toBeNull()
    expect(parseTopicYearWindow('blink-182')).toBeNull()
  })
})

describe('withinTopicYears', () => {
  const window = { from: 1960, to: 1969 }

  it('keeps songs inside the window, inclusive of both ends', () => {
    expect(withinTopicYears(1960, window)).toBe(true)
    expect(withinTopicYears(1965, window)).toBe(true)
    expect(withinTopicYears(1969, window)).toBe(true)
  })

  it('drops songs outside it', () => {
    expect(withinTopicYears(1959, window)).toBe(false)
    expect(withinTopicYears(1971, window)).toBe(false)
    expect(withinTopicYears(1978, window)).toBe(false)
  })

  it('drops a song with no usable year', () => {
    expect(withinTopicYears(null, window)).toBe(false)
    expect(withinTopicYears(undefined, window)).toBe(false)
    expect(withinTopicYears(NaN, window)).toBe(false)
  })
})
