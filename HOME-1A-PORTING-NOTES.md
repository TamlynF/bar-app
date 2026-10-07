# HOME 1A → bar-app porting brief

Source mockup: `Don Fenticas - Home Mobile Options.html`, frame **1a** (`div#1a.frame.A`) only.
Target: `src/app/page.tsx` + `src/components/home/*`. Mobile-first (390px); desktop unchanged unless noted.

## FROZEN — do not touch
- `src/components/logo-3d.tsx` and its mount in `home-hero.tsx` (3D wordmark + 26s rotation).
- The tagline under the logo in `home-hero.tsx` — keep the existing text and classes exactly.
- `gallery-peek.tsx` (Gallery section), merch section, `home-find-us.tsx` + `df-map-pin.tsx` (Find us + map).
- `public-nav.tsx` top nav + mobile bottom nav, `marquee-ticker.tsx`.
- Supabase queries, data shapes, props, routes.

## CHANGE — section by section (mockup → repo)

### 1. Hero buttons (`home-hero.tsx`)
Two-button grid under the tagline, `grid-cols-2 gap-2 mt-[18px]`, 15px padding, radius 14px, 12px/800 uppercase, tracking .06em.
- Primary `.g`: `bg-[#FDCC4B] text-[#1a2008]`, shadow `0 3px 0 #a8801c, 0 10px 20px -10px rgb(0 0 0/.8)`; `:active` → `translateY(2px)` + `0 1px 0 #a8801c`.
  - Default label: **What's on** → `/whats-on`.
  - If today's event is karaoke (`event_subtypes.slug === 'karaoke'`, event date = today): becomes **Sing on Singa** with mic icon, `bg-[#FD632B] text-[#1a0d05]`, shadow `0 3px 0 #a93d14`, href = `event.singa_url`.
  - If karaoke today but `singa_url` is null: **Karaoke not started**, `bg-transparent border border-dashed border-[#FFF4CC]/30 text-[#b4b294] text-[11px] pointer-events-none`.
- Secondary `.o`: `border-[1.5px] border-[#FFF4CC]/45 text-[#FFF4CC] bg-[#14180a]/55 backdrop-blur-[8px]`, shadow `0 3px 0 rgb(0 0 0/.6)`.
  - Default: **Book a table** → booking route.
  - While drinks exchange is trading (`market.is_open`): **Drinks exchange** with 8px `#3DDC84` dot, pulsing (`@keyframes live` — box-shadow 0→7px fade, 1.6s). href = exchange route.

### 2. Stage-light hero backdrop (`home-hero.tsx`, new, mobile only)
Behind the logo, `overflow-hidden h-[420px]`, bg `radial-gradient(120% 70% at 50% 100%, #2b2d12, #14180a 60%)`.
- Truss: `absolute top-0 inset-x-0 h-[6px] bg-[#0a0c05] border-b border-[#22251a]`, three 10px lamps at left 76/190/304px, radial `#fff3c4 → #c99a2e → #2a2616`, glow `0 0 10px 2px rgb(253 204 75/.35)`.
- Beams ×3: `absolute top-0 w-[120px] h-[540px] origin-top mix-blend-screen blur-[14px]`, `clip-path: polygon(48% 0,52% 0,100% 100%,0 100%)`, gradient `rgb(253 204 75/.22) → .08 at 45% → 0 at 85%` (centre beam uses `#FF6B35` at .16/.05). Animation `sweep` rotate −12°→12°, `alternate infinite`, durations 11s / 13s (reverse) / 16s. Add `sweep` to `globals.css` next to the `ad-*` keyframes. Respect `prefers-reduced-motion`.

### 3. Featured event card (`next-up-ticket.tsx`)
Keep shadcn `Card`. Height 340px, radius 20px, `border border-[#FDCC4B]/35`, poster as `bg-cover center 30%`.
- Bottom fade: `linear-gradient(to top, #14180a 0%, #14180a/85 35%, transparent 70%)` so the title always reads.
- Red curtains: 26px strips left/right, `repeating-linear-gradient(90deg,#4e0f13 0 5px,#7A1F1F 5px 10px,#5c1217 10px 14px)`, inner shadow; 14px scalloped valance across the top.
- Top-left date block (SAT / 10 / OCT), top-right subtype chip. Right-side vertical utility buttons: Share, Add to calendar (36px circles, `bg-black/45 border-white/20`).
- Bottom: eyebrow `Doors 8:00pm · Free entry` (gold, 800, tracking .14em), title in Archivo Black 28px uppercase, then **Tickets** (gold `.g`) + **Info** (`.o`). If `ticket_url` is null, render only **Info** full-width.

### 4. Event list rows (`highlighted-events.tsx` / `editorial/event-card.tsx`)
List container: `rounded-[18px] border border-white/10 bg-[#1b210f] overflow-hidden`.
Row: `grid grid-cols-[44px_1fr_18px] gap-[14px] items-center px-[14px] py-4`, divider `border-t border-white/10`.
- Date col: day abbrev 10px/800 tracking .12em `#b4b294`, number Anton 26px gold.
- Title: Archivo Black 16px uppercase cream. Meta line under it: time 13px/800 `#FF6B35`, ` · ` subtype 13px/600 `#b4b294`.
- Chevron: 8px rotated border, `#b4b294` at .6.
- **Double bill** (event has `dj_name` / follow-on act): render headline act as above, then a block `mt-[9px] pl-3 pr-[10px] py-2 border-l-2 border-[#FDCC4B] bg-white/[.035] rounded-r-[10px]` containing `THEN` (9px/800 gold tracking .14em), act title 14px Archivo Black, meta `10:30pm · DJ set`.

### 5. Deals (`deals-strip.tsx`)
Keep existing burgundy/gold alternating strips unchanged. **Add above them** the live Drinks-exchange card when `market.is_open`:
`flex items-center gap-[10px] min-h-[64px] px-[14px] py-[10px] rounded-2xl border border-[#FDCC4B]/40`, gradient gold tint, green pulsing dot, label "DRINKS EXCHANGE DEAL" (11px/700 gold) + drink name 16px, right side `↓30%` + price 18px/800. Shimmer sweep `@keyframes shim` 3.5s. Percentage/arrow green when price is below base, red when above.

### 6. Top nav extra (`public-nav.tsx`) — the one allowed nav change
Add a 36px circular "stock market" icon button (`border-[#FDCC4B]/50 bg-[#FDCC4B]/10 text-[#FDCC4B]`) left of the Instagram button, with a 10px `#3DDC84` pulsing dot top-right **only when `market.is_open`**. Links to the exchange board.

## Tokens / fonts
Already in `globals.css` from the previous port: `--bg #14180a`, `--bg2 #1b210f`, `--ink #FFF4CC`, `--ink2 #b4b294`, gold `#FDCC4B`, neon `#FF6B35`, burgundy `#7A1F1F`; Anton / Archivo Black / Archivo. New literal: Singa orange `#FD632B` (shadow `#a93d14`), live green `#3DDC84`.

## Ready-to-paste Claude Code prompt
> Read `HOME-1A-PORTING-NOTES.md`. Port frame 1a of the home mockup into the home page, section by section (1–6), keeping every item under **FROZEN** byte-identical: logo-3d.tsx and its rotation, the tagline under the logo, gallery-peek.tsx, merch, home-find-us.tsx, df-map-pin.tsx, public-nav.tsx (except the one additive change in §6), marquee-ticker.tsx, and all data/queries/props. Use existing shadcn `Card`/`Button` where the current page does. Add the `sweep`, `live`, `shim` keyframes to `globals.css` beside the `ad-*` ones with `prefers-reduced-motion` guards. Follow STYLE_GUIDE.md. Then `npm run dev`, verify at 375px and desktop, and list every file you changed.
