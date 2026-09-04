# Handoff: Trends & Prices redesign ("Noticeboard + Price-off", option 2a)

## Overview
Redesign of the admin **Market trends** page (`/marketing/trends`) in bar-app. It replaces the current jargon-heavy list UI with two quirky, non-tech-savvy-friendly metaphors:
- **The noticeboard** - Ads & Events trends as sticky notes pinned to a board, each with an effort chip (Easy/Medium/Hard), a time estimate, and a "View more" expansion showing *Why your bar* and numbered *How to do it* steps.
- **The price-off** - Prices as a friendly "You vs The locals" scoreboard, with an Average / By-venue view toggle, a Choose-items control, and per-venue breakdowns on mobile rows.

## About the design files
`Trends & Prices Options.dc.html` is a **design reference created in HTML** - a canvas of mockups, not production code. The task is to **recreate option 2a in the bar-app Next.js codebase** (React + Tailwind v4, lucide-react icons, existing admin patterns) by modifying:
- `src/app/(private)/marketing/trends/trends-client.tsx`
- `src/app/(private)/marketing/trends/trend-card.tsx`
- `src/app/(private)/marketing/prices/prices-client.tsx`

The page shell (`private-layout-client.tsx`), server page (`trends/page.tsx`), actions, and data types stay as they are. Turn 2 / option **2a** in the canvas is the design to build; turn-1 options 1a–1d are context (1a is a recreation of the current UI).

## Fidelity
**High-fidelity.** Colors, type sizes, spacing, and copy in the 2a frames are final intent. Use Tailwind utilities + the admin tokens already in `globals.css` (`bg-admin-*`, `text-admin-*`, `nav-*`) rather than raw hex where a token exists.

## Screens / Views

### 1. Noticeboard (Ads tab & Events tab - desktop)
- **Header**: H1 "The noticeboard" - Archivo 800, 34px, tracking -0.03em, `#20231A`; subtitle 14px `#5E6654`: "Ideas worth nicking, pinned up fresh each week. Near {area}."
- **Header actions** (right): primary button "📌 Pin up fresh ideas" (solid `#34451F`, white, h-11, rounded-xl, font 700 13.5px - this is the existing refresh action) and secondary "🗂 My keepers · {n}" (white, 1px `#D8D5C8` border - this is the existing saved/Ideas toggle).
- **Tabs**: three chips styled as taped labels - active: `#20231A` bg, `#FFF4CC` text, 700, rotate(-1deg); inactive: white bg, 1.5px **dashed** `#5E6654` border, `#5E6654` text, slight alternating rotations (0.6deg / -0.5deg). Labels: "📣 Post ideas", "🎪 Event ideas", "🏆 The price-off". Radius 8px, h-10.
- **Board**: CSS grid `grid-cols-3 gap-5`, `align-items:start`.
- **Sticky note (collapsed)**: radius 4px (NOT rounded-2xl - deliberately paper-like), padding 20px 18px 16px, `box-shadow:0 6px 14px rgba(32,35,26,.16)`, rotation per note alternating between about -1.6deg and 1.8deg, background one of `#FFF7D6` (warm yellow), `#FFFEFA` (paper white), `#EDF3E2` (soft green). A red **pin**: 18px circle, `#B33A32`, `box-shadow:inset -2px -3px 4px rgba(0,0,0,.3), 0 2px 3px rgba(0,0,0,.3)`, centered at top:-9px.
  - Emoji 34px; title Archivo 800 16.5px/1.25 `#20231A`; one-line note 13px `#5E6654`.
  - **Effort chip**: pill, 700 11px - Easy `#E7F3EC`/`#22613F`, Medium `#FFF4D6`/`#9A5B00`, Hard `#FDECEA`/`#B33A32`; text "● Easy" etc. Map from existing `TrendEffort` (Easy/Medium/Big → Hard label "Hard").
  - **Time chip**: pill, 600 11px, `rgba(32,35,26,.08)` bg, ink text, "🕐 ~ one evening" (derive from effort: Easy = one evening, Medium = a weekend, Big/Hard = a full week - same mapping as current `EFFORT.note`).
  - **Actions**: "📌 Keep" (solid `#34451F`, flex-1, h-9, radius 8px) = save; "Bin it" (outline `rgba(94,102,84,.4)`) = ignore. Below: centered "View more" link, 600 12px `#34451F`, underlined.
- **Sticky note (expanded / "View more")**: spans 2 grid columns (`grid-column: span 2`), stronger shadow `0 10px 24px rgba(32,35,26,.22)`, 1px border `rgba(154,91,0,.15)`. Adds:
  - Chips row also gets a kind chip ("📣 Post idea" / "🎪 Event idea").
  - **Why your bar** box: 1px `rgba(154,91,0,.25)` border, `rgba(255,255,255,.55)` bg, radius 10px; label 700 11-12px uppercase tracked `#9A5B00`; body 13.5px/1.55 `#20231A`. Content = `trend.relevance`.
  - **How to do it** box: same treatment with `#34451F` accents; numbered steps as 22px olive circles (white 700 12px numeral) + 13.5px text. Content = `trend.action` split into steps (if the AI action text is one paragraph, render as a single step; ideally update the prompt to return 2–4 steps).
  - Footer: Keep / Bin it buttons + right-aligned source link "🔗 Source: {source_name}".
  - "Show less" link top-right collapses it.
- **Footer line** (centered, 12px, `rgba(94,102,84,.6)`): "Pinned fresh on {date} · found by AI from what's going round · always sense-check before acting."

### 2. Noticeboard (mobile, <sm)
- Same header at 27px; tabs become a compact 3-column grid of the same chips with short labels "📣 Posts / 🎪 Events / 🏆 Price-off", h-10.
- Full-width "📌 Pin up fresh ideas" button (h-13, radius 14px).
- Notes in `grid-cols-2 gap-4`; expanded note goes **full-width** (span 2) above the grid.
- All tap targets ≥ 44px where interactive.

### 3. The price-off (Prices tab - desktop)
- **Score banner**: dark olive `#263019` card, radius 20px, padding 20-24px. Left: "You **5** vs The locals **0**" - numerals Archivo 800 44px, yours `#D7A928`, theirs `#AEB69D`; labels 700 13px `#DDE2D1`. Middle: "The Hinckley price-off · updated {date}" 700 15px + one-liner 13px `#AEB69D` ("You're the cheaper pint on 5 of 6 drinks. Crowd goes wild. 🎉"). Right: "✏️ Change area" outline button (existing area-edit form behavior). Score = count of items where own price < competitor avg.
- **View toggle**: "View:" label + segmented control (1px `#D8D5C8`, radius 10px): **Average** / **By venue** - active segment solid `#34451F` white 700. Replaces the current tiny AVG/BY VENUE pills.
- **🎛 Choose items** (right-aligned, olive outline): opens the item picker. Selected items render as a wrapping chips row: "✓ {item}" pills (`#E7F3EC` bg, `#22613F` text, 1px `#BFD8C4` border) + a "+ Add more" dashed pill. (Extends the existing venue-picker pattern to *items*; persist like `pickedVenues`.)
- **By-venue table**: card (white, 1px `#D8D5C8`, radius 16px). Header row on `#F4F1E8`: "Round / You / {venue names}" - 600 11px uppercase tracked `#5E6654`, "You" column in `#34451F`. Grid columns `1.4fr 90px repeat(n, 1fr)`, all prices right-aligned `tabular-nums`; your price 700 15px `#22613F`; competitor 500 13.5px `#5E6654`; missing = "-" at 45% opacity. Reuse `buildVenueMatrix`/`rankedVenues`.
- **Average view**: same card, one row per comparison: "{item} 🏆 (if winning)" left; You price green; "vs £x.xx" avg; result word right ("You win 🏆" `#22613F` / "No match yet" `#8A8D7A`).
- **Footer actions**: full-width "⚡ Rerun the price-off" (solid olive, h-12 - existing refresh action) + "See all 25 sourced prices" outline (existing raw-list collapsible).
- Disclaimer line 11px: "Friendly competition only - prices are AI-estimated from the web. Empty cells mean no price found for that venue yet."

### 4. The price-off (mobile)
- Compact tab chips row (as noticeboard mobile), then score banner (numerals 38px).
- Two half-width buttons: "🎛 Choose items" (olive outline) and "✏️ Change area" (neutral outline), h-10.
- **Aligned table** - this fixed a real complaint: use a CSS grid with FIXED columns `minmax(0,1fr) 58px 58px 24px` (item / You / Them / chevron) on every row AND the header, so all prices line up vertically. `tabular-nums` everywhere. Header 600 10.5px uppercase on `#F4F1E8`.
- **Row expansion**: tapping a row toggles a per-venue breakdown inside the row (row bg becomes `#F4F1E8`, chevron rotates 180°): label "The breakdown - venue by venue" 700 10.5px uppercase, then one line per venue - venue name 600 12.5px + green delta note ("you're £0.75 under") + right-aligned price. Data from `competitorPrices` filtered to that benchmark key.
- Hint line below card: "Tap any row for the venue-by-venue breakdown."

## Interactions & behavior
- Keep = `setTrendStateAction(id, "saved")`; Bin it = `"ignored"`; existing pending spinner patterns apply.
- View more / Show less: local `expandedId` state; only one note expanded at a time is fine.
- Tabs keep the existing `trendTab` state; "The price-off" = prices tab.
- View toggle = existing `view` state ("summary" ↔ "byVenue"). Choose items = new `pickedItems: string[] | null` state mirroring `pickedVenues` (null = all).
- Mobile row expansion: `openRowKey` state; chevron `transition-transform`.
- Motion: existing conventions - `transition-colors`, `active:scale-[0.98]`; note expansion may use `animate-in fade-in duration-300`. Keep the sticky-note rotations on hover-none too (they're static transforms).
- Loading: keep the existing playful refresh copy ("Doomscrolling so you don't have to…").
- Empty states: keep existing dashed-border empty cards, reworded to match ("Nothing pinned up yet - smash the button above").

## State management
No new server state. New client state: `expandedId: string | null`, `pickedItems: string[] | null`, `openRowKey: string | null`. Everything else reuses `trendTab`, `showSaved`, `view`, `pickedVenues`, transitions, and the existing server actions.

## Design tokens
- Ink `#20231A`, muted `#5E6654`, canvas `#F4F1E8`, card `#FFFEFA`, line `#D8D5C8`, surface `#ECE9DE`
- Primary olive `#34451F` (hover `#283719`), gold `#D7A928`, nav olive `#263019`, nav ink `#DDE2D1`, nav muted `#AEB69D`
- Semantic: success `#22613F`/`#E7F3EC`, warning `#9A5B00`/`#FFF4D6`, error `#B33A32`/`#FDECEA`
- Sticky-note fills: `#FFF7D6`, `#FFFEFA`, `#EDF3E2`; pin red `#B33A32`
- Type: Archivo throughout (existing admin font). Weights 400/600/700/800. Sentence case except tiny uppercase table headers (11px, tracking-wide).
- Radii: notes 4px; chips/pills 999px; cards 16px; buttons 8–14px. Note shadows as specified above (the only place > shadow-sm is allowed - they sell the paper metaphor).

## Assets
No image assets. All icons are emoji (📌 🏆 ⚡ 🎛 ✏️ 🕐 etc. - deliberate, matches the app's existing emoji tab labels) plus existing lucide-react `ChevronDown` / `Loader2`.

## Files
- `Trends & Prices Options.dc.html` - the full design canvas. **Section "2" (top) = option 2a, the design to implement.** Section "1" holds the baseline recreation (1a) and earlier directions (1b–1d) for context.
