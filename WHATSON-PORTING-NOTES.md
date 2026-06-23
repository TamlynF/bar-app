# What's On — porting notes (mockup → bar-app Next.js)

Companion to `PORTING-NOTES.md` (which already covers the colour + type port). This
doc describes the **new What's On page behaviour** so it can be rebuilt in the real
app (`src/app/(public)/whats-on/`) using Tailwind v4 + TSX components.

The mockup is a CDN-React + inline-CSS prototype. Don't copy it verbatim — treat it
as the spec and translate into the repo's component vocabulary.

Mockup source files (in the design project):
- `app/whats-on-data.js`   — sample schedule + per-kind hue/icon map
- `app/wo-shared.jsx`      — page shell: header, search, filter chips, section assembly
- `app/wo-design-stack.jsx`— the Stack flip card (front + back)
- `app/whats-on-app.jsx`   — palette vars + chrome + Tweaks

---

## 1. What changed vs the current page

The live `whats-on/page.tsx` renders: SectionHeading → **NextEventHero** →
**WhatsOnGrid** (upcoming + past) → ScheduleMore. The redesign changes the
*arrangement and the card*:

1. **No separate hero.** Remove `<NextEventHero>`. The next upcoming event is shown
   *inline* in the Coming-up list with a pulsing **"NEXT UP · TUE 23 JUN"** label
   above it and a neon ring (`box-shadow:0 0 0 2px var(--neon)`) on its card.
2. **Earlier-this-month moved ABOVE Coming-up.** Past events render first, as a
   collapsed `<details>`-style toggle ("Earlier this month (N)"), above the
   "Coming up" section. Default collapsed; auto-open when a search query is active.
3. **Search bar** between the title and the filters. Filters events by title and by
   subtype label (case-insensitive), across both past + upcoming.
4. **Filter chips = one horizontal scroll row** (not wrapped). `flex-wrap:nowrap;
   overflow-x:auto; scrollbar hidden`, each chip `flex:none; white-space:nowrap`,
   with a colour dot + live count. "All" chip shows the total.
5. **Cards flip.** Tapping a card flips it (3D `rotateY`) to a back face with the
   blurb + details. **Only one card open at a time** (parent holds `openId`). The
   back **auto-grows** to fit its content (measure the taller face, set height).
6. **Book/Sing button on the FRONT** (not the back). Karaoke → "Sing", gigs →
   "Get tickets", else "Book". The back has **no buttons** — price shown as text.

---

## 2. Component-by-component

### `whats-on/page.tsx` (server)
- Delete the `<NextEventHero>` block and its import.
- Compute `nextEventId = upcoming[0]?.id` (first event on/after today) and pass it
  to the grid so it can mark that card inline.
- Keep the existing data fetch / `serializeEvent` / `tabs` logic. Reorder children:
  `SectionHeading` → `<WhatsOnGrid past={past} upcoming={upcoming} tabs={tabs}
  nextEventId={nextEventId} />` → `ScheduleMore`.

### `components/whats-on-grid.tsx` (client) — the orchestrator
Holds the interactive state (this is where most work goes):
- `const [query, setQuery] = useState("")`
- `const [active, setActive] = useState<string|"all">("all")`
- `const [showPast, setShowPast] = useState(false)`
- `const [openId, setOpenId] = useState<string|null>(null)`
- Filter helper: `match = e => (active==="all" || e.subType===active) &&
  (!q || e.title.toLowerCase().includes(q) || e.subType?.toLowerCase().includes(q))`
- Render order: **Search input → FilterTabs (scroll row) → "Earlier this month"
  toggle + past list (when open) → "Coming up" heading → upcoming list**.
- In the upcoming map, when `e.id === nextEventId` render the `NEXT UP · {date}`
  label above the card and pass `isNext` to it.
- Pass `open={openId===e.id}` + `onToggle={()=>setOpenId(p=>p===e.id?null:e.id)}`
  to every card.

### `components/editorial/event-card.tsx` — make it a flip card
- Props: `event`, `open`, `onToggle`, `isPast`, `isNext`.
- Markup: `.flip` (perspective) › `.flip-inner` (`transform-style:preserve-3d`,
  `rotateY(180deg)` when `open`) › two `.flip-face` (front + `.back` rotated 180,
  both `backface-visibility:hidden`).
- **Front:** date block (tinted with the subtype colour), subtype label, title
  (coloured with the subtype colour), time + price, and the **Book/Sing button**
  (`e.stopPropagation()` so it doesn't flip), plus a small "Info" flip hint.
- **Back:** subtype + date, blurb, a meta line (`host · time · age · price`). No buttons.
- **Auto-grow height** (`useLayoutEffect`): when `open`, set the card height to
  `max(frontRef.scrollHeight, backRef.scrollHeight)`; clear it when closed. Add
  `transition: height .45s` and keep `backface-visibility:hidden` on both faces.
- Note: a flex child with `overflow:hidden` + `white-space:nowrap` can collapse to
  0 height — give the title `flex:none` (this bit us in the mockup).

### `components/editorial/filter-tabs.tsx`
- Container: `flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none]
  [&::-webkit-scrollbar]:hidden` and bleed to the screen edges with negative margin
  + matching padding. Each tab: `flex-none whitespace-nowrap`, dot + label + count,
  active = `bg-accent text-on-accent`.

### Data
The mockup adds fields the back face needs: `blurb`, `host`, `age`. In the real app,
extend `serializeEvent` (in `lib/events-display.ts`) to surface equivalents (e.g.
a `description`/`door_policy` column, or compose from existing fields). The per-kind
colour already exists as `event_subtypes.color` — use it where the mockup uses its
`hue`.

---

## 3. Ready-to-paste Claude Code prompt

> Read `PORTING-NOTES.md` and `WHATSON-PORTING-NOTES.md`. Rebuild the public What's On
> page per the new spec, keeping the After Dark tokens:
> 1. In `whats-on/page.tsx` remove `NextEventHero`, compute `nextEventId`, and reorder
>    so past events render above upcoming.
> 2. Rewrite `whats-on-grid.tsx` to own `query / active / showPast / openId` state and
>    render: search input → scrollable `FilterTabs` → collapsible "Earlier this month"
>    (above) → "Coming up" list, marking the `nextEventId` card inline.
> 3. Convert `editorial/event-card.tsx` into a single-open flip card with the
>    Book/Sing button on the front, no buttons on the back, and a `useLayoutEffect`
>    auto-grow height. Give the title `flex-none`.
> 4. Make `filter-tabs.tsx` a single horizontal-scroll row with dot + count chips.
> Use Tailwind tokens (`bg-bg2`, `text-ink`, `border-line`, `bg-accent`, `text-neon`),
> don't change Supabase queries, and verify at 375px + desktop.

---

## 4. Token-check fix (the `/design-sync` warnings)

Separate from this page. The checker flags Tailwind v4 internals in the synced
`_ds_bundle.css`. Fix at the sync step (see the existing `DESIGN-SYNC-NOTES.md`):
exclude all `--tw-*` from token extraction; tag `--animate-*`/`--ease-*`/`--default-*`/
`--aspect-*` as `@kind other`; fix the `_adherence.oxlintrc.json` mis-guesses. Then
re-run `/design-sync`.
