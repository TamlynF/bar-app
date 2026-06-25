# Centralise & harden the table-allocation logic for seated bookings

## Goal
Rework how the app assigns tables to bookings so that **create**, **update**, **status-change**, and **admin table-edit** flows all follow one consistent, correct seating algorithm. Today the logic is **copy-pasted and inconsistent** across many server actions (quiz / event / bingo / general, public + admin). Replace those ad-hoc copies with **one shared module** and apply the rules below everywhere. This only governs bookings whose linked `events` row has **`seating_required = true` AND `is_bookable = true`**. For any other event, seating logic is skipped and the booking is confirmed as it is today.

## Read first (authoritative)
`CLAUDE.md` and `STYLE_GUIDE.md`. Follow them exactly: Next.js 16 App Router, React 19 (Server Components default), TypeScript strict, **Tailwind 4 only** (no inline `style` except CSS custom-property `--vars`; prefer canonical scale tokens), shadcn/ui in `src/components/ui/`, Lucide icons only, Supabase via `@/lib/supabase/server` in Server Actions. **Admin theme only** for admin UI (bg `#F7F4EA`, espresso `#5C4033`, borders `border-[#E6DFC8]`, cards `rounded-2xl`, sheets `rounded-3xl`). Public manage-booking pages stay on the **public dark olive/gold** theme. **Save/Add/Create buttons** include `bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase tracking-widest`; **Edit buttons** `bg-[#B45309] hover:bg-[#B45309]/85 …`. Accessibility: ≥44px touch targets, `aria-label` on icon-only buttons, real `<label>` on every control. **Do NOT add an npm dependency, change fonts, add non-Tailwind CSS, or commit/push — stop and ask.** Run `npm run build` before done; add Vitest tests in `src/lib/__tests__/` for the pure decision logic.

## Two important corrections to the brief I was given
1. **Capacity comparison is `max_capacity >= group_size`** (the table must be *big enough* to seat the group), not `<=`. The brief said "max_capacity <= group_size" — that is a typo; the existing codebase already uses `>= group_size` and that is correct. Use `>=` everywhere.
2. **`booking_table_mappings.event_id` already exists** (added in `supabase/migrations/20260625000000_floor_plan.sql`). Use it as the source of truth for "which tables are taken for this event" instead of going via the list of confirmed booking ids. **No new migration is required** for this work — confirm with me if you think one is.

## The data model (already in place)
- `events`: `seating_required boolean`, `is_bookable boolean`, `is_fully_booked boolean`.
- `tables`: `id`, `max_capacity` (smallint), `available boolean`.
- `bookings`: `id`, `event_id`, `group_size`, `status` (`confirmed` | `waitlisted` | `pending` | `cancelled`).
- `booking_table_mappings`: `booking_id`, `table_id`, **`event_id`**, `add_seat` (extra chairs when a group overflows a table's capacity).
- Helper that already exists and must keep being called after any allocation change: `updateFullyBookedStatus(supabase, eventId)` in `src/lib/update-fully-booked.ts` — it sets `events.is_fully_booked` when no available table is free for the event. Reuse it; extend it only if needed so it reflects `booking_table_mappings.event_id`.

## Step 1 — build the shared module (do this first)
Create **`src/lib/table-allocation.ts`** holding the single source of truth. Split it into:
- **Pure, unit-tested decision helpers** (no Supabase) in the same file or a sibling, covered by `src/lib/__tests__/table-allocation.test.ts`. These take plain arrays/objects and return decisions, e.g.:
  - `pickSmallestFittingTable(freeTables, groupSize)` → the available table with the smallest `max_capacity` that is still `>= groupSize`, or `null`.
  - `findUpsizeSwap(currentMapping, candidateMappings, newSize)` → given the booking that needs a bigger table and the other confirmed mappings for the event, return the booking to swap with (see Update rules), or `null`.
  - `findDownsizeSwap(...)` → for the downsize-optimisation rule (see below).
- **Data-access functions** that take the supabase client and `eventId`, e.g. `getFreeTablesForEvent(supabase, eventId, { excludeBookingId? })` returning `tables.available = true` rows whose `id` is **not** present in `booking_table_mappings` for that `event_id` (optionally ignoring the row belonging to `excludeBookingId`), ordered by `max_capacity` ascending.
- **Orchestrators** returning a typed outcome the callers act on:
  - `allocateOnCreate(supabase, { eventId, groupSize })` → `{ status: 'confirmed', table } | { status: 'waitlisted' }`.
  - `reallocateOnSizeChange(supabase, { booking, newSize, surface })` → `{ outcome: 'kept' | 'reassigned' | 'swapped' | 'no_space', table?, swappedBookingId? }`.
  - `clearMappingOnStatusChange(supabase, bookingId)`.
- An exported **outcome enum/type** plus a `seatingApplies(event)` guard = `event.seating_required === true && event.is_bookable === true`.

Every server action below must call into this module rather than re-implementing the queries.

## Step 2 — CREATE booking rules (seated events only)
When `seatingApplies(event)`:
1. Get the event's free tables (`available = true`, not already mapped for this `event_id`), `max_capacity >= group_size`, smallest-fit first.
2. **If a table exists** → insert the booking with `status = 'confirmed'`, then insert a `booking_table_mappings` row `{ booking_id, table_id, event_id, add_seat: 0 }`.
3. **If none exists** → the event is full → insert the booking with `status = 'waitlisted'`, **no mapping**, and return a result that tells the UI "this event is fully booked, you've been waitlisted."
4. Always call `updateFullyBookedStatus(supabase, eventId)` afterwards so `is_fully_booked` is set when the last table is taken.

Apply this in **all create flows** (route each through `allocateOnCreate`):
- `src/app/(public)/_actions/create-booking.ts` (quiz)
- `src/app/(public)/_actions/create-event-booking.ts` (ticketed event)
- `src/app/(public)/_actions/create-bingo-booking.ts` (bingo)
- any admin-side create path you find. (Paid flows: keep the existing Square `pending`→paid handling; allocation/mapping decisions stay the same, just sourced from the shared module.)

## Step 3 — UPDATE booking rules (seated events only)
Trigger when a booking on a seated event is edited. Let `current` = the booking, `currentTable` = its mapped table (if any), `newSize` = updated `group_size`.

### 3a. group_size INCREASED, status is `confirmed`, a mapping exists
- If `newSize <= currentTable.max_capacity` → **keep** the table (outcome `kept`). (Optionally recompute `add_seat`; with a fitting table it's 0.)
- If `newSize > currentTable.max_capacity` → need a bigger table:
  1. **Reassign:** look for a free table for the event (`available`, not mapped for this event excluding self) with `max_capacity >= newSize`, smallest-fit first. If found → move the booking's mapping to it (outcome `reassigned`).
  2. **Swap (upsize):** if no free table, look at the **other `confirmed` bookings for this same event that have a mapping** where:
     - their `group_size < newSize` (this booking is now the larger group), **and**
     - their mapped table's `max_capacity > currentTable.max_capacity` and `>= newSize` (their table is bigger and actually fits this booking), **and**
     - the other booking still fits on `currentTable` (`other.group_size <= currentTable.max_capacity`).
     If such a booking exists, **swap the two mappings** (this booking takes their bigger table; they take this booking's current table). Update both `booking_table_mappings` rows (outcome `swapped`). Pick the best candidate deterministically (e.g. smallest table that still satisfies the constraints).
  3. **No space:** if neither a free table nor a valid swap exists:
     - **Public manage-booking portal:** do **not** change the booking. Return a blocked result so the page can show *"There's no available space for that group size"* with an option/link to **contact the bar**. Leave status `confirmed` and the existing mapping intact.
     - **Admin portal:** show a warning *before saving* that the booking will be set to **`pending`** and its table mapping **removed**; on confirm, set `status = 'pending'` and delete the mapping (outcome `no_space`).

### 3b. group_size DECREASED, status is `confirmed`, a mapping exists
**Goal: keep each group on the tightest-fitting table** (smallest `max_capacity` that still seats the group), freeing larger tables back to the pool. `currentTable` = the booking's current table.

1. **Relocate to a tighter free table.** Look for **available** tables for this event (`available = true`, not mapped for this `event_id`, excluding self) whose `max_capacity >= newSize` **and** `max_capacity < currentTable.max_capacity`. Pick the one whose `max_capacity` is **closest to `newSize`** (the tightest fit — e.g. group drops 8→4 on a 10-seat table, move to a free 6-seat table). If found, move A's mapping there (outcome `reassigned`); `currentTable` returns to the pool.
2. **Tighten via swap.** If there's no free tighter table, look at the **occupied** tables that are tighter than A's current table — i.e. other `confirmed` bookings on this event mapped to a table with `max_capacity >= newSize` and `max_capacity < currentTable.max_capacity`, choosing the candidate table closest to `newSize`. Call its occupying booking **B**. Swap only if **B's `group_size` > A's new `group_size`** (B is the larger group, so B takes the bigger table A is vacating). On a valid candidate, **swap the two mappings**: B → A's current (bigger) table, A → B's (tighter) table. Update both `booking_table_mappings` rows (outcome `swapped`). Both groups still fit (A: `newSize <= B.table.max_capacity`; B: `B.group_size <= currentTable.max_capacity`, guaranteed since B was already at an equal-or-smaller table — verify anyway).
3. **Otherwise keep.** If there's no tighter free table and **no booking with a `group_size` greater than A's new size** sitting at a tighter table, **keep A on its current table** (outcome `kept`).

Worked example (from the brief): A = 8 people on a 10-seat table, drops to 4. → (1) try a free table closest to 4 that fits, e.g. a 6-seat → move A there. → (2) if none free, find a booking B on a 6-seat table whose `group_size` (e.g. 6) is **> 4**; swap so B takes the 10-seat and A takes the 6-seat. → (3) if no such booking, A stays on the 10-seat.

### 3c. status changes FROM `confirmed` to anything else (waitlisted/pending/cancelled)
- The related `booking_table_mappings` row **must be deleted** (the table is freed).
- **Admin portal:** before saving the status change, show a warning that the table mapping will be deleted.

### 3d. Admin edits the linked table directly (bookings pages)
- Run **full validation** via the shared module: the chosen table must be `available = true`, **not already mapped to another booking for this event**, and capacity-checked. If `group_size > max_capacity`, set `add_seat = group_size - max_capacity` (keep the existing add_seat behaviour); otherwise `add_seat = 0`. Reject/double-booking-guard instead of silently overwriting.

After **every** update path, call `updateFullyBookedStatus(supabase, eventId)`.

### 3e. Freeing a table must NOT auto-promote the waitlist — flag it for the admin instead
Whenever a table is returned to the pool (a downsize relocation/swap in 3b, a status change away from `confirmed` in 3c, a cancellation, or a delete), the system **must not** automatically confirm a waitlisted booking. Instead, if the event still has any `waitlisted` booking that **could now be seated** (there exists an `available` table, unmapped for that `event_id`, with `max_capacity >= that booking's group_size`), the admin must be **notified** and it must surface in the **dashboard "needs action" / urgent section**:
- Add a new **`ActionItem`** to the dashboard hero. See `src/app/(private)/dashboard/components/needs-action-hero.tsx` (the `ActionItem` shape: `{ key, label, count, href, color }`) and where the `actionItems` array is built in `src/app/(private)/dashboard/page.tsx` (~line 529). Add an item like `{ key: "seatable-waitlist", label: "Waitlist", count: <number of waitlisted bookings on seated events that now fit a free table>, href: <link to the relevant bookings list filtered to waitlisted>, color: <a Tailwind bg-* not already used in the array> }`, and include its count in `totalActions`.
- Compute that count in the dashboard page's server query (a seated-events + waitlisted-bookings + free-table check; reuse `getFreeTablesForEvent` / the shared module so the logic isn't duplicated). Keep it efficient — batch per event, don't N+1 per booking if avoidable.
- The admin then manually confirms/seats from the bookings page (existing edit flow). **No automatic status change.**

Apply Step 3 across (route each through the shared module):
- `src/app/(public)/_actions/update-booking.ts` (public quiz manage — surface = `public`)
- `src/app/(private)/event-bookings/quiz-bookings/actions.ts` → `updateBookingDetails`, `updateBookingStatus`
- `src/app/(private)/event-bookings/general/[type]/[subtype]/actions.ts` → `updateGeneralBookingDetails`
- the bingo / event admin update actions (`event-bookings/bingo-bookings/actions.ts`, `event-bookings/event/[id]/actions.ts`) — match the same pattern
- the public bingo manage-booking actions under `src/app/(public)/book/bingo/manage-booking/[id]/`
- Consolidate the duplicated `getAvailableTablesForEvent` / `getAvailableTablesForEventGeneral` helpers to call `getFreeTablesForEvent` from the shared module (keep the existing exported names/signatures so callers don't break).

## Step 4 — UI: warnings & blocked states
- **Admin** booking clients (e.g. `event-bookings/quiz-bookings/components/booking-list-client.tsx`, the general/bingo/event equivalents, and any status `<select>` in the edit sheets): when the pending change will (a) demote to `pending` and drop the mapping due to no space, or (b) move status away from `confirmed` and delete the mapping, show a confirmation/warning (a shadcn dialog or inline alert, espresso/cream theme) **before** the destructive save. Don't fire the server action until confirmed.
- **Public** manage-booking pages (quiz + bingo): on a no-space upsize, render the "no available space — contact the bar" message inline (olive/gold theme), with the bar's contact route/details, and leave the booking unchanged.
- Keep `sonner` toasts for success/idempotent results as the codebase already does.

## Constraints & guardrails
- **Concurrency:** two simultaneous bookings could grab the same last table. Mitigate by re-checking table availability immediately before insert inside the orchestrator and handling the unique/duplicate case gracefully (waitlist the loser). Note any residual race in a comment; don't add a dependency to solve it.
- Don't change behaviour for **non-seated** events (`seating_required = false`) or non-bookable events.
- Keep `add_seat`, `updated_by` / `updated_by_contact_id` tracking, email sending, and Square payment handling working exactly as before — only the allocation/mapping decisions move into the shared module.
- No `git add` / commit / push. No new npm packages. No theme cross-contamination.

## Suggested phasing (confirm Phase 1 before coding)
- **Phase 1 — shared module + tests:** build `src/lib/table-allocation.ts` and its Vitest suite covering the pure decision helpers: tightest-fit selection, upsize-swap selection (3a.2), downsize relocate/swap selection (3b.1/3b.2), and the create/upsize/downsize/status-clear outcomes. Get the algorithm right in isolation first.
- **Phase 2 — wire CREATE flows** through `allocateOnCreate`; verify quiz/event/bingo create + waitlist + `is_fully_booked` still behave.
- **Phase 3 — wire UPDATE / status / admin-table-edit flows** (3a upsize, 3b downsize, 3c status-clear, 3d admin table-edit) through the module.
- **Phase 4 — warnings, blocked states & the dashboard waitlist flag** (Step 4 + rule 3e): admin confirmation dialogs, public "contact the bar" message, and the new `ActionItem` in the dashboard hero.
- **Phase 5 — polish:** dedupe the `getAvailableTablesForEvent*` helpers, run `npm run build`, run `npm test`, review.

## Start
1. Read `CLAUDE.md` + `STYLE_GUIDE.md`.
2. Audit every create/update/status/table-edit booking flow listed above and confirm the full list back to me (flag any I missed).
3. Propose the `table-allocation.ts` public API (function signatures + the outcome type), and wait for my 👍 before writing implementation code.
4. Build Phase 1 (module + tests), then we review.
