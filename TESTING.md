# Testing

Two layers:

- **Unit tests (Vitest)** - pure logic in `src/lib` (no DB, no React). Fast, run anywhere.
- **End-to-end tests (Playwright)** - the real app + a **local Supabase** stack, exercised on **phone and desktop** viewports.

External services are never hit: tests use the local Supabase keys, the **free** booking path (no Square call), and a dummy Resend key.

---

## Prerequisites

- **Docker** (for the local Supabase stack)
- **Node** (already required for the app)
- One-time Playwright browser download: `npx playwright install`

---

## Unit tests

```bash
npm test          # run once
npm run test:watch
```

Tests live next to the code in `src/lib/__tests__/*.test.ts`. Good candidates: anything pure - colour mapping, the `resolveEventSubtype` helper (Supabase mocked), date/grouping helpers. Don't unit-test Server Components; cover those with E2E.

---

## End-to-end tests

The app runs against a **local** Supabase database that is rebuilt from `supabase/migrations/` + `supabase/seed.sql` every reset, so runs are deterministic.

```bash
npm run db:start      # start local Supabase (first run pulls Docker images)
npm run db:reset      # apply schema migration + seed (run whenever you want a clean DB)
npx playwright install # once, to download browsers

npm run test:e2e       # runs every spec on BOTH mobile + desktop
npm run test:e2e:ui    # interactive runner
npm run db:stop        # when done
```

Playwright boots the app itself (`next dev -p 3100`) with the test env, so you don't start it manually. `e2e/global-setup.ts` creates a confirmed admin auth user, links it to the seeded `employees` row, logs in through the real `/login` form, and saves the session to `e2e/.auth/admin.json` for authenticated specs.

### Phone *and* desktop
`playwright.config.ts` defines two **projects** - `mobile` (iPhone 13, ~390px) and `desktop` (1280px). Every spec runs under both. The app's Tailwind `sm` breakpoint is **640px**, and behaviour diverges across it (bottom nav vs sidebar, bottom sheet vs centered modal, 3-dot menu vs inline buttons). When a test depends on that difference, assert on the project: `test.info().project.name === "mobile"`.

### What's covered (starter specs - extend these)
- `e2e/public-quiz.spec.ts` - public `/book/quiz` renders (unauthenticated).
- `e2e/admin-events.spec.ts` - event create form: selecting a subtype **prefills** the title, and the **host**/**karaoke** fields show/hide based on the subtype flags.

Worth adding next: completing a free quiz booking end-to-end, the bingo + generic `/book/event/[id]` flows, and an accessibility scan (`@axe-core/playwright`) to automate the Edge DevTools rules in CLAUDE.md (labels on icon buttons / form fields, no inline styles).

---

## Seed data (`supabase/seed.sql`)
Deterministic rows tests rely on: 4 types (games/music/party/private), subtypes incl. `quiz` (is_quiz, bookable), `bingo`, `gig` (host_required, payment_required), `karaoke` (is_karaoke), `birthday` (private); upcoming events for each bookable subtype; one staff member, two tables, a quiz category, a contact. IDs are explicit and identity sequences are reset afterward so the app's own inserts don't collide. Dates are `CURRENT_DATE + N`, so seeded events are always upcoming.

---

## Schema (`supabase/migrations/`)
`20250101000000_init_schema.sql` was **introspected from the live `pubapp` project** - tables, columns, constraints, indexes, and the `bookings_with_events` view, all faithful. It intentionally **omits Row Level Security**: production auto-enables RLS via an event trigger, but the local test DB leaves it off so both the anon and service-role keys have full access and tests stay deterministic. **Do not use this file for production.**

If you ever want a 100%-faithful dump (incl. RLS, policies, functions), run with the DB password:

```bash
npx supabase db dump --linked -f supabase/migrations/<timestamp>_init.sql
```

Going forward, make schema changes as new migration files (`supabase migration new <name>`) rather than ad-hoc edits, so local/CI/prod stay in sync.

---

## CI sketch
1. `npm ci`
2. `npx supabase start` then `npx supabase db reset`
3. `npm test`
4. `npx playwright install --with-deps` then `npm run test:e2e`
