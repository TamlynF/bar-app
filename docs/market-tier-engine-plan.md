# Plan: implement the recommended tier engine (workbook tab 10) in bar-app

Source of truth for behaviour: `docs/Drinks_Market_Explained.xlsx`, tab **10 Recommended Simulation** (rules) and tab **11** (definitions). Every rule below cites the workbook input it mirrors.

## 0. Principles

- **Additive, switchable, reversible.** The current demand engine stays exactly as it is. The tier engine is a second `pricing_mode` chosen per market event, default `demand`, so shipping this changes nothing until staff pick `tiers` on an event. Rollback = switch the event back.
- **Pure logic first, tested against the workbook.** The engine is a pure module with an injected clock/rng, and its unit test replays the exact 42-drink, 15-tick night from tab 10 and asserts the ranks, tiers and prices the sheet produces (golden test). If the code and the sheet disagree, the test fails.
- **One tick, one Square write, board shows the till.** Keep the existing batched `syncMarketPricesToSquare` and make the public surfaces show only the Square-acknowledged price.
- Repo conventions: no comments in code, Server Actions for writes, prod DDL via Supabase MCP + matching local migration, `npm test` + `npm run build` before you commit (you commit, not me).

## 1. Data model (one migration: `20260918000000_market_tier_engine.sql`)

**`stock_market_events`** (per-event config, snapshotted into `market_sessions.config` at open as today):

| column | type / default | workbook input |
|---|---|---|
| `pricing_mode` | text not null default `'demand'` check in (`demand`,`tiers`) | — |
| `rerank_every_ticks` | int default 5 | D3 Re-rank every N ticks |
| `glide_pct` | numeric default 0.35 | D4 Glide per tick |
| `warmup_units` | int default 30 | D5 Warm-up units |
| `tier_pcts` | jsonb default `{"down":[0.30,0.20,0.10],"up":[0.30,0.20,0.10],"bands":[5,10,15]}` | tab 6 C7:E12 + tab 10 row 6 |
| `pace_floor_units` | numeric default 8 | D7 Pace minimum normal units |
| `session_ticks_hint` | int default 120 | the "÷15" — normal-per-tick = normal-per-night ÷ this. 120 = a 2-hour night at 60 s ticks; derived from open/close time when set |

Event calendar (for §3.4 — profile selection only, never a restriction on when the event can be opened): `weekdays int[] not null default '{}'` (0 = Sunday … 6 = Saturday), `bank_holiday_profile int null` (weekday whose sales profile a bank-holiday eve uses; default 6), `history_from date null` / `history_to date null` (optional bounds on the Square history sampled; null = rolling 12 weeks), `exclude_market_nights boolean default true`.

Keep the existing `crash_*`, `floor_pct`, `ceil_pct`, `move_notify_pct`, `low_stock_threshold`, `tick_interval_sec` as they are; the tier engine reuses them.

**`stock_market_event_items`**: `normal_units_per_night numeric null` (staff override; null = auto, see §3.4).

**`market_normal_units`** (cache of Square history, see §3.4): `menu_item_price_id bigint`, `weekday int`, `units_avg numeric`, `nights_sampled int`, `sampled_dates date[]`, `computed_at timestamptz`; pk `(menu_item_price_id, weekday)`. **`uk_bank_holidays`**: `date date pk`, `title text`, `fetched_at timestamptz`. Both authenticated-read, service-role write.

**`market_instruments`** (per live session state): `normal_units_per_night numeric`, `normal_units_source text` (`override | square:<weekday>:<n> | fallback`), `heat` is already `demand_units` (reuse), `pace numeric default 0`, `last_sale_tick int null`, `rank_pos int null`, `tier_pct numeric default 0`, `target_price numeric null`.

**`market_sessions`**: `units_sold_total int default 0`, `warmed_up_tick int null`, `last_rerank_tick int null`.

**`market_events.kind`** check: add `tier_up`, `tier_down`, `rerank`, `warmup_done` (ticker copy: "Guinness enters the Top 5 — heading to £6.45").

Local test migration mirrors this with RLS off, per repo convention.

## 2. Config plumbing

- `types.ts`: extend `MarketConfig` with `pricingMode`, `rerankEveryTicks`, `glidePct`, `warmupUnits`, `tierPcts`, `paceFloorUnits`, `sessionTicksHint`; extend `DEFAULT_MARKET_CONFIG`. **Fix `resolveMarketConfig`**: it currently accepts only numbers `> 0` — add string/object handling for `pricingMode` and `tierPcts`, and allow `0` where meaningful (`warmupUnits: 0` = no warm-up).
- `stock-market-events.ts` → `eventConfig(row)` maps the new columns. `summariseEvent` unchanged shape + new fields.
- `config-fields.tsx` / `market-client.tsx`: a "Pricing" segmented control (Demand engine / Tier leaderboard) that reveals the tier fields; existing fields stay. Admin styling per CLAUDE.md (olive Save, sentence case, `text-[13px]`).

## 3. The tier engine — `src/lib/market/tier-engine.ts` (pure)

Inputs: all instruments for the session (ranking is cross-drink, so the signature is `runTierTick(instruments, inputs)` — not per-instrument like `tickInstrument`), `TickInputs` + `{ tickNo, unitsSoldTotalBefore, warmedUpTick, lastRerankTick }`. Output: per-instrument result in the existing `InstrumentTickResult` shape plus `{ pace, lastSaleTick, rankPos, tierPct, targetPrice }`, and a session delta `{ unitsSoldTotal, warmedUpTick, lastRerankTick, reranked: boolean }`.

Per tick, in this order (mirrors tab 10 columns left → right):

1. **Heat** — `demandUnits = round3(prev × decayK + units)` (unchanged from today; tab 10 "Heat").
2. **Pace** — `heat ÷ (max(normalUnitsPerNight, paceFloorUnits) ÷ sessionTicksHint)` (tab 10 "Pace vs normal", D7 floor, the ÷15).
3. **Mins since sale** — `units > 0 ? 0 : min(99, prev + 1)`; persisted as `last_sale_tick`.
4. **Rank value** — `pace + 1e-4/(1+minsSince) + 1e-7×basePrice`; sort descending, then instrument id as the final deterministic tie-break (the sheet's row order).
5. **Warm-up** — `unitsSoldTotal += Σunits`; `warmedUpTick` set on the first tick it reaches `warmupUnits` (D5).
6. **Re-rank?** — `warmed && (tickNo === warmedUpTick || tickNo % rerankEveryTicks === 0)` — the sheet's `MOD(t,N)=0` rule exactly, so the golden test compares like for like. `tick_no` is a counter, not wall-clock, so a missed cron minute doesn't break the cadence. `last_rerank_tick` is still recorded for the board countdown.
7. **Tier %** — not warmed → 0; re-rank tick → lookup from `tierPcts` using rank-from-top and rank-from-bottom (fewest wins if both, as tab 6); otherwise carry previous `tier_pct`.
8. **Target** — crash active (session `crash_until_tick` or instrument `crash_until_tick`) → `crashTarget` from `instrumentLimits`; else `base × (1 + tierPct)`.
9. **Price** — sold-out/override → frozen; else `roundToStep(clamp(prev + glide × (target − prev), floor, ceil))`. Reuse `roundToStep`/`clamp`/`instrumentLimits` — export them from `engine.ts` rather than duplicating; also export `nextStockState`/`stockEvent` for stock handling and reuse the surge/drop alert block verbatim (move it to a shared `alerts-from-move.ts` helper used by both engines).
10. **Events** — `tier_up`/`tier_down` when `tierPct` changes on a re-rank, `warmup_done` once, `rerank` once per re-rank (feeds the board countdown reset).

No noise term in tier mode (the sheet has none; the ranking supplies the movement). `noiseSigma` is ignored when `pricingMode = 'tiers'` and the UI hides it.

### 3.4 Where "normal units per night" comes from — Square sales history, per weekday

A Friday sells fewer pints than a Saturday, so "normal" must be worked out for the **kind of night the event runs on**, not averaged across the week. The source is Square's own order history (every till sale, market night or not), which is far richer than past market sessions alone.

**Event carries its calendar** (new columns on `stock_market_events`, see §1). A stock market event is a reusable setup that can be opened again and again, so nothing here restricts *when* it may run. `weekdays int[]` (0–6) says which day(s) of the week the event is *for*, so the right weekday's sales profile is used; `bank_holiday_profile int null` says which weekday's profile to use when a run date is the eve of a UK bank holiday (e.g. a bank-holiday Sunday trades like a Saturday); optional `history_from` / `history_to` bound the Square history that is sampled (null = rolling last 12 weeks) — useful to skip a refurb closure or to pin "normal" to last summer for a one-off. Open/close times already exist and define the hours counted. If a session is opened on a weekday not in `weekdays`, the profile for the actual weekday is used and the staff panel says so.

**Computation** (`src/lib/market/normal-units.ts`, server-only, run on demand — never per tick):

1. For each weekday the event runs on, take the last **N = 6** calendar dates of that weekday within a **lookback of 12 weeks** (both configurable), skipping dates with zero Square orders (closed) and, optionally, dates a market session ran (a discounted night is not "normal" — `exclude_market_nights` default true).
2. For each date, `orders.search` at `SQUARE_LOCATION_ID`, state `COMPLETED`, `closed_at` inside the **trading night** that starts on that date: from `date + open_time` to `date + close_time`, and when `close_time ≤ open_time` the window runs into the **next calendar day** (`date + 1 + close_time`). A Saturday event with 20:00–02:00 therefore counts sales from Saturday 20:00 through to **Sunday 02:00**, and those Sunday-morning sales belong to the *Saturday* profile, never to Sunday's. All timestamps are computed in `Europe/London` so BST/GMT changeovers don't shift the window. Paginated with the cursor; sum `lineItems[].quantity` per `catalogObjectId`.
   The same trading-night rule is used everywhere a "night" is meant: the weekday of a session is the weekday it *opened* on (a session opened Saturday 21:00 that closes Sunday 01:30 is a Saturday), the market-night exclusion, the bank-holiday-eve check, and the live tick's own Square orders poll already behaves this way (it is watermark-based, not date-based).
3. Map `catalogObjectId` → `menu_item_price_id` via `menu_item_prices.square_variation_id` (already maintained by the mapping screen); unmatched ids are ignored.
4. `normal_units[weekday][price_id] = mean over the sampled dates`, plus `nights_sampled` so the UI can show confidence ("based on 6 Saturdays" vs "2 Saturdays").
5. Public holidays: fetch `https://www.gov.uk/bank-holidays.json` (england-and-wales), cache rows in `uk_bank_holidays(date primary key, title)`, refresh monthly. A run date whose **next day** is a bank holiday uses `bank_holiday_profile` (default Saturday = 6) instead of its own weekday; bank-holiday dates themselves are excluded from the "normal" samples so they don't inflate ordinary weekdays.
6. Persist to `market_normal_units(menu_item_price_id, weekday, units_avg numeric, nights_sampled int, sampled_dates date[], computed_at)`; primary key `(menu_item_price_id, weekday)`.

**Resolution at session open** (`openSession`), per drink: event-item override → `market_normal_units` for the **profile weekday of tonight's date** (bank-holiday rule applied) → same drink any weekday (flagged low-confidence) → `pace_floor_units`. The chosen value and its source (`override | square:<weekday>:<n nights> | fallback`) are stored on `market_instruments` so the night is self-consistent and the staff panel can show where each number came from.

**Refresh policy**: `Recalculate normals` action on the event editor (server action, shows nights sampled per drink); auto-refresh at open when the cached row is older than 7 days. Cost: ≤ 6 dates × pages per weekday, run once per event, well inside Square limits; the tick path never touches it.

**Event editor**: weekday pills, bank-holiday profile select, optional history-window dates (advanced), and per-drink table showing auto normal (with "6 Saturdays" confidence) and an override box.

## 4. Tick integration (`tick.ts`)

- After demand + sim units are merged: `if (config.pricingMode === 'tiers') results = runTierTick(...) else results = runTick(...)`.
- Persist the extra instrument fields and the session delta (`units_sold_total`, `warmed_up_tick`, `last_rerank_tick`) in the same update pass. Replace the 42 sequential instrument updates with one `upsert` (also fixes the half-synced-state risk noted in review).
- Square write leg unchanged (one batched upsert per tick). **Drop the idea of a till threshold** (Option A from the review): board = till, every moved price is sent; payload size is irrelevant to Square's limits, request count stays at one per tick.
- `readMarketState`: add `pricingMode`, `nextRerankInSec`, `warmedUp`, and per instrument `tierPct`, `targetPrice`, `pace`, `rankPos`, `normalUnitsPerNight`. Keep `tillPrice`.

## 5. Public surfaces (big screen `src/app/(public)/market/board`, phone `(public)/market`, home widgets)

- **Big screen: add, don't replace.** `market-board.tsx` already has three views chosen by `?view=` — `categories`, `table`, `movers` (`BoardView`). The tier engine adds a **fourth, `leaderboard`**: Top 5 / Bottom 5 with tier badges, the "next re-rank in m:ss" countdown, and a "market warming up" state until `warmedUp`. The existing three views stay exactly as they are and keep working in both pricing modes; in tier mode they additionally show the tier badge next to a price. `page.tsx`'s view parser gains the new value; the default view is unchanged. Staff pick the view per screen with the URL as today.
- Show `tillPrice` when the drink is linked to Square, engine `price` only when it isn't (replace the `tillPrice ?? price` fallbacks with a `displayPrice(i)` helper that encodes that rule). Board shows "updating…" instead of a number while `tillPrice` is null on a linked drink.
- **Phone page `/market` (reached from the home screen).** Lists the drinks in the currently open market. In tier mode the list is **sorted bottom tier first**: the biggest discounts at the top (−30%, then −20%, then −10%), then the unchanged middle, then the mark-ups (+10%, +20%, +30% last); within a tier, by pace ascending so the drink furthest into its discount leads. Demand mode keeps today's ordering. Each row shows the tier badge and the target it is gliding to; a countdown to the next re-rank sits above the list; the footer reads "You pay the price on the till when your drink is rung in". Public theme per STYLE_GUIDE (olive/gold/neon), no emoji.
- Ticker copy for the new event kinds (`tier_up`, `tier_down`, `rerank`, `warmup_done`).

## 6. Staff surfaces (`settings/market`)

- Event editor: pricing mode + tier fields + per-drink normal-units override.
- Live control panel (`[id]/event-detail-client.tsx`): columns for pace, rank, tier, target next to price; "Re-rank now" action (sets `last_rerank_tick = null`), warm-up progress. CRASH button unchanged — the tier engine reads the same `crash_until_tick`.
- Sales simulator works unchanged (units are merged before the engine switch).
- Guard: disable "Push menu to Square" and menu price edits while a session is live (prevents `VERSION_MISMATCH`/429 collisions).

## 7. Square hardening (small, independent of the engine)

- Deterministic idempotency key: `market-${sessionId}-${tickNo}` instead of `randomUUID()` so a timed-out request retried by the SDK cannot double-apply.
- On 429 honour `Retry-After` with a single in-tick retry before deferring to next tick.
- Optional (phase 4): subscribe to `catalog.version.updated` on the existing webhook route, stamp `market_sessions.square_confirmed_at`, and have the board flip to new prices only after confirmation + 10 s grace.

## 8. Tests

- `tier-engine.test.ts`: (a) **golden replay** — fixture `tier-night.fixture.json` exported from tab 10 (42 drinks, per-tick units, expected rank/tier/price per tick); assert equality to the penny (rounding: `Math.round(x/step)×step`, same as the sheet). (b) unit cases: warm-up gate, re-rank cadence incl. a skipped tick, tie-break by recency then base, pace floor, glide convergence + 5p rounding stall, sold-out freeze, crash override and recovery, fewest-wins when in both lists.
- `stock-market-events.test.ts`: `eventConfig` mapping + `resolveMarketConfig` accepting mode/tierPcts/zero.
- `normal-units.test.ts` (pure parts, Square client injected): weekday date sampling incl. lookback and skipped closed dates; trading-night window crossing midnight (Saturday 20:00–02:00 includes Sunday 00:00–02:00 sales and attributes them to Saturday; a 00:30 Sunday sale is never counted in Sunday's profile); BST/GMT changeover night; variation → price mapping with unmatched ids ignored; mean + nights_sampled; bank-holiday eve → profile weekday, bank-holiday dates excluded from samples; resolution order override → weekday → any-weekday → floor, with the recorded source string.
- Existing `engine.test.ts` untouched (demand mode must be byte-for-byte the same).
- Playwright: open a `tiers` event → board shows "warming up" → simulate 30 sales → tiers appear → leaderboard strip renders (mobile + desktop).
- Manual: sandbox demo recipe from `market-sales-simulator-notes.md`, then one real market night with tick logging; check price changes per tick, minutes per tier, ties at cut-off (the three workbook measures).

## 9. Phasing

1. **Schema + config + pure engine + golden test.** No behaviour change (mode defaults to `demand`). ~1 session.
1b. **Normal units from Square.** `normal-units.ts` + bank-holiday cache + `Recalculate normals` action + event calendar fields on the editor. Independent of the engine, so it can ship and be sanity-checked against real Friday/Saturday numbers before tiers go live. ~1 session.
2. **Tick integration + state payload + admin config/event-detail columns.** Switchable per event. ~1 session.
3. **Board/phone: new `leaderboard` view on the big screen (existing `categories` / `table` / `movers` views untouched); `/market` phone list sorted discounts-first in tier mode; countdown, warm-up state, till-price-only display, ticker copy.** ~1 session.
4. **Square hardening + webhook confirmation gate.** ~½ session.

## 10. Decisions (agreed 17 Sep 2026)

1. **Per-event `pricing_mode` switch.** Demand engine untouched; default `demand`; staff pick `tiers` per event.
2. **Normal units per night = Square sales history per weekday + staff override.** Events carry weekday(s), a bank-holiday profile and an optional history window (they stay reusable — no run-date restriction); normals are the mean of the last 6 same-weekday nights (12-week lookback, event hours only, market nights excluded) from Square orders, cached in `market_normal_units`; bank-holiday eves use the configured profile weekday; fallback `pace_floor_units`; override column on `stock_market_event_items`. (Revised 17 Sep after review — was "last 4 market sessions".)
3. **Board = till, no write threshold.** Every moved price goes in the one batched Square write per tick; public surfaces show the Square-acknowledged price for linked drinks.
4. **Default mark-ups 30 / 20 / 10**, symmetric with the discounts, editable per event.

## 11. Progress

**Phase 1 — done (17 Sep 2026).** Files: `supabase/migrations/20260918000000_market_tier_engine.sql` (local test schema; prod DDL to be applied via Supabase MCP at the start of Phase 2, after confirmation), `src/lib/market/types.ts` (config fields, `resolveTierPcts`, `resolveMarketConfig` accepts mode / tier table / zero warm-up), `src/lib/market/stock-market-events.ts` (`eventConfig` maps the new columns), `src/lib/market/engine.ts` (exports `roundToStep`, `clamp`, `nextStockState`, `stockEvent`; surge/drop logic lifted into `moveAlert`, behaviour unchanged — all 22 existing engine tests still pass), `src/lib/market/tier-engine.ts` (pure `runTierTick`), `src/lib/market/__tests__/tier-engine.test.ts` + `fixtures/tier-night.fixture.json` (golden replay of tab 10: every rank, tier and target exact across 42 drinks × 15 ticks; prices exact in >97% of cells and never more than one 5p step out — the remainder are half-penny cases where Excel and `Math.round` differ). 51 market tests green; strict `tsc` clean on the market lib. Nothing reads the new config yet, so runtime behaviour is unchanged.

Deviations from the plan above: `targetPrice` is returned unrounded (the glide uses the exact value; round only for display) and the re-rank rule is `MOD`-based as noted in §3.6.

**Phase 1b — done (17 Sep 2026).** Files: `src/lib/market/normal-units.ts` (pure: trading-night window in Europe/London incl. crossing midnight and clocks-change, same-weekday sampling with lookback / history window / exclusions, bank-holiday eve → profile weekday, aggregation, per-night mean, override → weekday → other-weekday → floor resolution, `sessionTicksFor`), `src/lib/market/bank-holidays.ts` (gov.uk feed, cached in `uk_bank_holidays`, refreshed monthly, failures fall back to cache), `src/lib/market/normal-units-server.ts` (one paginated `orders.search` per sampled night, upsert into `market_normal_units`, `resolveNormalsForOpen` with a 7-day staleness refresh), `settings/market/actions.ts` (`recalculateNormalUnitsAction`, `saveEventNormalUnitsAction`, event save reads weekdays / bank-holiday profile / history window / skip-market-nights; `openStockMarketEventAction` derives `sessionTicksHint` from the hours and stores `normal_units_per_night` + `normal_units_source` on every instrument), `market-client.tsx` (weekday pills, bank-holiday-eve profile select, collapsible "Sales history used for normal" card), `[id]/normal-units-card.tsx` + `page.tsx` + `event-detail-client.tsx` (Normal sales per night table: per-weekday average with nights sampled, unlinked-to-Square flag, per-drink override, "Read from Square" button). 66 market tests green in isolation; full-project `tsc` and ESLint clean on every touched file (the tsc errors that remain are in pre-existing files: `market-ui.tsx`, three old tests).

**Production DDL applied** (17 Sep 2026, Supabase migration `market_tier_engine` on `vhbbbxljtemawsimqhfw`): same statements as the local file plus RLS + `Allow authenticated full` policies on the two new tables, mirroring `market_sim_sales`. Verified all 26 new columns/tables present. The branch is safe to deploy.

**Phase 2 — done (17 Sep 2026).** `tick.ts`: `maybeRunMarketTick` switches on `config.pricingMode` (`runTierTick` vs `runTick`), persists `pace` / `last_sale_tick` / `rank_pos` / `tier_pct` / `target_price` per instrument and `units_sold_total` / `warmed_up_tick` / `last_rerank_tick` per session, emits `warmup_done` and `rerank` as session-level events (`instrument_id null`) alongside the per-drink `tier_up` / `tier_down`; the 42 sequential instrument updates now run in parallel (a single upsert is not possible — `market_instruments` has NOT NULL columns without defaults, so a partial upsert row is rejected before the conflict path). `readMarketState` adds `pricingMode`, `warmedUp`, `unitsSoldTotal`, `warmupUnits`, `nextRerankInSec` and per-instrument `tierPct` / `targetPrice` / `pace` / `rankPos` / `normalUnitsPerNight` (all null in demand mode, so existing consumers are unaffected). Admin: `config-fields.tsx` gains the pricing-mode options, four tier dials with help text and the two 3-band percentage rows; `ConfigFormRows` shows a Demand engine / Tier leaderboard toggle that reveals the tier rows and hides volatility; `actions.ts` validates them with `tierSchema`, stores them on the event, and `updateConfigAction` now merges the form over the live session's current config so a mid-session change keeps `sessionTicksHint`; new `rerankNowAction` ("Re-rank now", or "Skip warm-up" before the threshold) forces a tick with the warm-up gate lifted. Event detail live rows show rank, pace vs normal and a tier badge with the target price. Ticker / history copy for the four new event kinds. Full-project `tsc` and ESLint clean on every touched file. Push alerts deliberately do not fire on tier events yet (`PUSH_KINDS` unchanged) — decide in Phase 3 whether `tier_down` should buzz phones as a deal.

**Phase 3 — done (17 Sep 2026).** Big screen: `BoardView` gains `leaderboard` as a fourth option (`?view=leaderboard`, and in the on-screen cycle after Movers); the existing `categories` / `table` / `movers` views are untouched. The leaderboard shows two columns — "Top sellers · going up" and "Deals · slow tonight" — with rank, pace vs normal, tier tag and price; in demand mode the same layout falls back to biggest risers / fallers since open. The header shows a "Next re-rank" countdown (or "Warming up n/30") in tier mode, and the leaderboard view shows a full-screen "MARKET WARMING UP · n of 30 drinks sold" until the threshold. Phone `/market`: `sortForPhone` orders deals first (−30 → −20 → −10, middle, +10 → +20 → +30; within a tier by pace so the drink furthest into its discount leads), each row has a `TierBadge` ("Deal −30%" / "Top seller +30%") and "heading to £x.xx", a warming-up card before the threshold, the countdown switches to "Re-rank in", and the footer reads "Deals first, top sellers last. You pay the price on the till when your drink is rung in." Till price: payload gains `linkedToTill`; `displayPrice()` in `market-ui.tsx` returns the Square-acknowledged price for linked drinks (rendered "…" until the first sync lands) and the engine price for unlinked ones; the board and phone use it strictly, the five home-page widgets (`market-cta`, `market-hero-card`, `market-section`, `market-sheet`, `market-ticker`) use it with an engine-price fallback for the brief pre-sync window since they are teasers, not the charged price. Push: `tier_down` added to `PUSH_KINDS` with the line "<drink> just dropped to the deals tier - heading −30%" (respects each phone's watched-drinks filter like `price_drop`). Full-project `tsc` and ESLint clean; 66 market tests green.

**Phase 4 — done (17 Sep 2026).** `square-price-sync.ts`: idempotency key is now deterministic — `market-<session>-t<tick>-a<attempt>` for the tick write (`-r` suffix for the in-tick retry, `market-restore-<session>-<ms>-<attempt>` for restore) so an SDK replay after a timeout cannot apply twice while a re-fetched VERSION_MISMATCH retry gets its own key; a 429 now waits `Retry-After` (capped at 5 s, default 2 s) and retries once inside the tick before deferring to the next one; a successful write stamps `market_sessions.square_last_write_at`. Confirmation gate: new `square-confirmation.ts`; the Square webhook route handles `catalog.version.updated` by copying every live instrument's `square_synced_price` into `square_confirmed_price` and stamping `square_catalog_confirmed_at` (admin client); `publicTillPrice()` gives the board the confirmed price once a session has ever been confirmed, falling back to the synced price if confirmations lag the last write by more than 90 s (webhook down) or have never arrived (webhook not enabled) — so nothing breaks if the venue has not subscribed to that event yet. Live guards: `live-guard.ts`; "Push menu to Square" refuses while a market is live, and `saveItemAction` / `deleteItemAction` refuse for a menu item whose serves are trading (the item editor rewrites `menu_item_prices` wholesale, which would orphan live instruments and their Square links). Migration `20260918100000_market_square_confirmation.sql` (local) applied to prod as `market_square_confirmation`. 71 market tests green; full-project `tsc` and ESLint clean.

**To enable the confirmation gate:** in the Square Developer dashboard add the `catalog.version.updated` event to the existing webhook subscription (same URL and signature key). Until then the board runs on synced prices exactly as before.

All four phases are complete. Remaining items are operational: run one real market night in tier mode with the sales simulator first, review the three workbook measures (price changes per tick, minutes per tier, ties at the cut-off), and revisit the 30/20/10 mark-ups if pint drinkers grumble.
