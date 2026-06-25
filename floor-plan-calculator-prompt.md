# Build a Floor Plan Layout Calculator into the bar-app admin portal

## Goal
Add an admin tool that **computes, renders, and saves an optimal table layout** for a specific event. The venue is an **irregular-shaped room with fixed obstacles and fixtures** (stage, bar, DJ booth, projector, TVs). The calculator packs the event's confirmed tables into the room, avoids obstacles, respects aisle clearance, and scores sightlines to the screens/stage so guests are comfortable and can see. Inputs are **live-adjustable on the page**, the layout is **saved against the event**, and it is re-openable.

## Read first (authoritative)
`CLAUDE.md` and `STYLE_GUIDE.md`. Follow them exactly: Next.js 16 App Router, React 19 (Server Components default), TypeScript strict, **Tailwind 4 only** (no inline `style` except CSS custom-property `--vars`; prefer canonical scale tokens over arbitrary px), shadcn/ui in `src/components/ui/`, Lucide icons only, Supabase. **Admin theme only** (bg `#F7F4EA`, espresso `#5C4033`, borders `border-[#E6DFC8]`, cards `rounded-2xl`, sheets `rounded-3xl`). **Save/Add/Create buttons** must include `bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase tracking-widest`; **Edit buttons** `bg-[#B45309] hover:bg-[#B45309]/85 ...`. Accessibility: ≥44px touch targets, `aria-label` on icon-only buttons, real `<label>` on every form control. **Do NOT add an npm dependency, change fonts, add non-Tailwind CSS, or commit/push — stop and ask.** Run `npm run build` before done; add Vitest tests in `src/lib/__tests__/` for pure geometry logic.

## Conventions
- Reads in async Server Components via `@/lib/supabase/server`; writes via co-located `actions.ts` (`"use server"`) + `revalidatePath(...)`. No API routes for mutations.
- `await params` / `await searchParams` (async in Next 16). Middleware is `src/proxy.ts` (fn `proxy`) — don't touch.
- Mirror the existing settings CRUD pattern: `page.tsx` (server) → `actions.ts` → `_components/*-client.tsx` (`"use client"` with a Sheet, add/view/edit modes). Reference: `src/app/(private)/settings/tables/` and `.../settings/gallery/`.
- `event_types` joins can return array OR object — handle both. DB `date` is `YYYY-MM-DD` string — parse as `new Date(str + "T00:00:00")`.

## Required schema changes (create new migration file(s) in `supabase/migrations/`; the existing `20250101000000_init_schema.sql` is the local RLS-off test schema introspected from prod — DON'T edit it). Propose the prod migration and get approval before applying via the Supabase MCP; prod has RLS.

1. **`company_information` — venue geometry (configured once, reused by every event).** Add columns (JSONB preferred):
   - `room_outline` — the **irregular room shape** as a polygon (ordered points in metres) plus bounding width/length.
   - `obstacles` — no-go zones (rects/polygons) e.g. pillars, store cupboards.
   - `fixtures` — named, positioned items the user can **easily place**: `stage`, `bar`, `dj_booth`, `projector`, and **multiple `tv` screens**. Each has a position, size, and (for screens/stage/booth) a facing direction so sightlines can be computed. Bar and booth are obstacles + service points; stage/projector/TVs/booth can be sightline focal points.
   - Edited in a new **venue layout editor** under settings — draw the outline, drop obstacles, place each fixture.

2. **`tables` — table geometry.** Add `shape` (`'round' | 'rect'`) and dimensions (`diameter` for round, `width` + `length` for rect, metres). Surface in the existing `settings/tables` edit Sheet.

3. **`booking_table_mappings` — add `event_id`** (bigint, FK → `events.id`). Source of truth for which tables an event uses: load tables where `booking_table_mappings.event_id = <event>` AND the linked booking (`booking_id` → `bookings`) has `status = 'confirmed'`. (`add_seat` already exists — it holds per-table extra chairs.)

4. **Saved layout.** Add a **`floor_plan_layout jsonb`** column to `events` storing: per-table x/y/rotation, per-table chair counts (incl. extras), the input settings used (chair zone, aisle width, "must-see" focal selections), sightline scores, and a timestamp/version.

## Adjustable inputs (live on the calculator page — recomputes the plan on change)
All inputs sit in a control panel on `/settings/floor-plan/[eventId]` and re-run the packer when changed:
- **Chair / pull-out zone** (metres) — space reserved around a table for a seated guest + chair pull-out. **Default 0.5 m.**
- **Aisle width** (metres) — clearance between table cells. **Default and enforced minimum 0.9 m** (WCAG); warn if the user sets it below 0.9.
- **Extra chairs to add** — a numeric input for how many additional chairs to add (applied to a selected table; see below). Reflects/updates `booking_table_mappings.add_seat`.
- **"Must be visible from every seat"** — a **multi-select** over the focal points (`stage`, `projector`, each `tv`, `dj_booth`); the user can choose **one or more**. Any focal point selected here becomes a **hard sightline requirement**: every seat must have a clear, acceptable-angle view of it.
- (Plus the table set itself is derived from the event's confirmed mappings — read-only count, but quantity placed is validated against `available` tables.)

## Calculator behaviour
- **Tables to place** = the confirmed-mapping tables for the event. Footprint = `tables.shape` + dimensions + the **chair/pull-out zone input**.
- **Extra chairs — two ways, both update `add_seat` and the saved layout:**
  1. **On the visual:** click/tap a table in the SVG to add an extra chair to *that* table (and a control to remove). Render the added chairs around the table and include them in the seat total.
  2. **Via the input:** the "extra chairs to add" number applies to the currently selected table.
- **Hard limit:** tables placed can never exceed the count of `tables` where `available = true`. Validate and warn.
- **Packing:** fit table cells (footprint + **aisle input**) **inside the room polygon**, **avoiding all obstacles, the stage, the bar, and the booth**. Stagger alternate rows theatre-style for sightlines.
- **Sightlines:** score each table's angle + distance to relevant focal points. For any focal point flagged **"must be visible from every seat,"** treat a table that can't see it as a **hard violation** — the packer should prioritise placements that satisfy all must-see requirements, and any unavoidable violation is surfaced as a blocking warning (not just colour-coded). Other focal points stay soft-scored (good / acceptable / poor, colour-coded with a legend).
- **Output/UX:** an SVG floor plan (metres→px) showing the room outline, obstacles, fixtures (labelled stage/bar/booth/projector/TVs), tables (round/rect) with chairs (incl. extras), and sightline colouring. Stats: tables placed vs available, total seats (incl. extra chairs), aisle width, chair-zone, utilisation %, must-see compliance, and warnings. Buttons to regenerate and to **Save** the layout (with its input settings) to `events.floor_plan_layout`.
- Keep geometry math (polygon containment, packing, sightline scoring) as **pure functions in `src/lib/`** with unit tests. Build SVG/pointer interactions (table selection, add-chair, drag) by hand — **no canvas/drag library without asking.**

## Entry point (exact)
In `src/app/(private)/event-setups/events/event-setups-client.tsx`, in the **view-mode detail Sheet**, inside the collapsible **Bookings** section (around line 915, the `bookingsOpen` block), add a button **"Floor plan layout calculator"** that navigates to **`/settings/floor-plan/[eventId]`** for that event. **Only render it when `selected.seating_required` is true.** Style as normal navigation (not a save-coloured button). The page loads venue geometry from `company_information`, the event's confirmed tables, and any saved `floor_plan_layout`.

## Route
New page at **`src/app/(private)/settings/floor-plan/[eventId]/page.tsx`** (async server component — `await params`, load company_information + confirmed tables + saved layout) with co-located `actions.ts` (`saveFloorPlanLayoutAction` writing `events.floor_plan_layout`, and updating `booking_table_mappings.add_seat` for chair changes) and `_components/floor-plan-client.tsx` for the interactive SVG calculator + control panel. Belongs to the Settings nav group via existing `groupForPath()`.

## Suggested phasing (confirm Phase 1 before coding)
- **Phase 1 — schema + data:** migrations for all four changes; add `shape`/dimensions to the tables settings Sheet; write `event_id` on booking_table_mappings where mappings are created.
- **Phase 2 — venue layout editor** in settings: draw room outline, place obstacles + fixtures into `company_information`.
- **Phase 3 — calculator page** at `/settings/floor-plan/[eventId]` + the events-sheet button: live-adjustable inputs (chair zone, aisle, extra chairs, must-see multi-select), polygon-aware packing avoiding obstacles, interactive add-chair on the SVG, sightline scoring with hard must-see requirements, render, and save to `events.floor_plan_layout`.
- **Phase 4 — polish:** load/edit a saved layout, manual nudge of table positions, edge-case warnings.

## Start
1. Read `CLAUDE.md` + `STYLE_GUIDE.md`.
2. Propose the exact migration (column types and JSONB shapes) and confirm with me before writing code.
3. Build Phase 1, run `npm run build`, then we review.
