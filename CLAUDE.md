# CLAUDE.md

This file is read by Claude Code on every session. Treat it as authoritative. If a request would cause you to break something in here, **stop and ask** rather than guessing.

For visual / design decisions, also read `STYLE_GUIDE.md`. The two files together are the source of truth.

---

## Commands

```bash
npm run dev      # Dev server
npm run build    # Production build (also runs TypeScript check)
npm run lint     # ESLint
npm run start    # Start production server
```

There are no tests. Do not add a test framework unless explicitly requested.

## Git workflow

**Do not commit or push changes.** All git operations (staging, committing, pushing) are done manually by the user.

**Commit message conventions (for reference):**
- `add: <thing>` — new feature or file
- `fix: <thing>` — bug fix
- `update: <thing>` — enhancement to existing feature
- `refactor: <thing>` — restructure without behaviour change

Always run `npm run build` successfully before committing.

---

## Tech stack — do not deviate without asking

- **Framework:** Next.js 16 (App Router, Server Components by default, React 19, React Compiler enabled)
- **Language:** TypeScript, strict mode
- **Styling:** Tailwind CSS 4 only — no CSS modules in new code (existing `.module.css` files are tolerated, but don't add more). No styled-components. **No inline `style` props** — this triggers Edge DevTools `no-inline-styles` warnings. **Utilities in `globals.css` are manually defined** — Tailwind v4 does NOT auto-generate them from `@source` in this project. Before using any Tailwind utility class, verify it exists in `src/app/globals.css` under a `@layer utilities` block. If it's missing, **add it** before using it. For dynamic values that can't be expressed as static Tailwind classes:
  1. **Preferred:** Set a CSS custom property via `style` and consume it via Tailwind arbitrary value — e.g. `style={{ "--badge-color": color } as React.CSSProperties}` + `className="bg-[var(--badge-color)]"`. This keeps the actual styling in classes.
  2. **Acceptable:** Use `style` only for CSS custom properties (`--var-name`), never for standard CSS properties like `backgroundColor`, `color`, `borderColor`, `minWidth`, etc.
  3. When refactoring existing inline styles, convert `style={{ backgroundColor: x, color: y }}` → `style={{ "--c": x, "--bg": y } as React.CSSProperties}` + Tailwind `text-[var(--c)] bg-[var(--bg)]`.
- **Component library:** shadcn/ui (new-york style), components live in `src/components/ui/`. Owned by us — edit freely.
- **Primitives:** Radix UI (via shadcn)
- **Icons:** Lucide React only
- **Forms:** react-hook-form + zod where validation is non-trivial; plain `useState` is fine for simple forms
- **Auth:** Supabase Auth via `@supabase/ssr`
- **DB:** Supabase Postgres (no Prisma; use the Supabase client directly)
- **Email:** Resend (sender: `Don Fenticas <admin@bookingsdonfenticas.co.uk>`)
- **Payments:** Square (sandbox + production envs)
- **AI:** Google Gemini (quiz generation)
- **Storage:** Supabase Storage (`gallery`, `band-videos` buckets)
- **Music:** Spotify Web Playback SDK (quiz integration only)
- **Animations:** `tw-animate-css` + Tailwind animate utilities. No Framer Motion (yet) — ask before adding.
- **Toasts:** `sonner`
- **Date handling:** `date-fns` only
- **Charts/tables:** none currently; ask before adding

If you think a new dependency is needed, **stop and ask** before installing.

---

## Route structure

```
src/app/
├── (public)/              # No auth required, public-facing
│   ├── book/              # Hub → quiz/band/private/bingo + per-event pages
│   ├── gallery/
│   ├── menu/
│   ├── contact/
│   ├── manage-booking/[id]
│   └── _actions/          # Server actions for public forms
├── (private)/             # Protected by src/proxy.ts (NOT middleware.ts)
│   ├── dashboard/
│   ├── event-bookings/    # Quiz, music, bingo, private, per-event
│   ├── event-setups/      # Events, event types, quiz config, quiz generator
│   └── settings/          # Company, customers, teams, tables, menu, gallery, users, etc.
├── login/
├── accept-invite/
├── update-password/
├── auth/callback/
├── api/                   # Route handlers (Spotify, Square webhook)
└── page.tsx               # Public home
```

**Important Next.js 16 conventions in this project:**
- Middleware is in `src/proxy.ts` and the exported function is named `proxy`, not `middleware`.
- `params` and `searchParams` are async. Always `await` them: `const { id } = await params;`.
- Server Actions live in `actions.ts` files co-located with the route, marked `"use server"`.

---

## Supabase clients — pick the right one

- **Server** (`@/lib/supabase/server.ts`) → Server Components, Server Actions, `proxy.ts`. Reads cookies via `next/headers`.
- **Browser** (`@/lib/supabase/client.ts`) → Client Components that need direct access (e.g. Storage uploads).
- **Admin** (`@/lib/supabase/admin.ts`) → Service role key, server-only, use sparingly (currently for invite acceptance flow).

Required env vars:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY            # JWT — used in proxy.ts and browser client
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     # New Supabase publishable key format
SUPABASE_SERVICE_ROLE_KEY                # Admin client only, never NEXT_PUBLIC_
RESEND_API_KEY
NEXT_PUBLIC_GEMINI_API_KEY
NEXT_PUBLIC_SITE_URL                     # e.g. https://bar-app-tau.vercel.app
SQUARE_ACCESS_TOKEN
SQUARE_ENVIRONMENT                       # 'sandbox' | 'production'
SQUARE_LOCATION_ID
SQUARE_WEBHOOK_SIGNATURE_KEY
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
```

---

## Data fetching & mutations

- **Reads** happen in async Server Components via the server Supabase client. Don't fetch in `useEffect` unless there's a specific client-side reason.
- **Writes** go through Server Actions co-located with the route (`actions.ts`). No API routes for mutations unless there's a specific reason (webhooks, third-party callbacks like Square).
- **Email sending** fires from Server Actions — never from client code.

For unauthenticated/public mutations (booking forms, manage-booking page), Server Actions are still fine; they don't require an authenticated session.

---

## Two distinct UI surfaces

This app has two faces and they look intentionally different. **Don't mix them.**

### Public site (`/`, `/book`, `/menu`, `/gallery`, `/contact`)
- Dark theme: `#26300D` (deep olive) background, `#FDCC4B` (gold) accent
- "Gritty bar" aesthetic — see `STYLE_GUIDE.md` for the full palette and rules
- Mobile-first; design at 375px width and scale up
- Bottom-sheet style nav at the top is acceptable; no persistent bottom nav on public pages
- Big, confident typography; lots of uppercase tracking; serif or bold display vibes welcome
- Real photography over illustration

### Admin portal (`/dashboard`, `/event-bookings/*`, `/event-setups/*`, `/settings/*`)
- Light/warm theme: `#F7F4EA` background, `#5C4033` espresso primary, `#E6DFC8` borders
- Card-based information density — this is a working tool, not a marketing surface
- Sidebar nav on desktop (≥sm), persistent bottom nav on mobile (≤sm)
- Sheet-based detail/edit views (bottom sheet on mobile, centered on desktop)

If you find yourself styling a public page with espresso/cream tones, or an admin page with olive/gold, **stop**. You're on the wrong surface.

---

## Visual standards (summary — full version in `STYLE_GUIDE.md`)

- **Touch targets ≥ 44×44px** on anything tappable on mobile (WCAG)
- **Icon-only buttons/links need `aria-label` or `title`** — a `<button>`/`<a>` containing only a Lucide icon must have an accessible name, or Edge DevTools fires `axe/name-role-value` ("Buttons must have discernible text"). Same class of Edge DevTools warning as `no-inline-styles`. See STYLE_GUIDE Accessibility.
- **Every form element needs a label** — `<input>`/`<select>`/`<textarea>`, including checkboxes, need a `<label htmlFor>` or `aria-label`. A `<span>` sitting next to the input is not a label. Missing → Edge DevTools `axe/forms` ("Form elements must have labels"). See STYLE_GUIDE Accessibility.
- **Tailwind spacing scale only** — no arbitrary `p-[13px]` values
- **Type scale:** Tailwind defaults. Display headings get `font-black uppercase tracking-tight` or `tracking-tighter`. Eyebrows/labels get `text-[10px] font-black uppercase tracking-widest`.
- **Colour usage:** Public pages use the olive/gold palette plus deep burgundy and a neon accent (see STYLE_GUIDE). Admin pages stay on the espresso/cream palette.
- **Card radii:** `rounded-2xl` (cards) and `rounded-3xl` (sheets) are the defaults. Don't introduce new radius values without a reason.
- **Borders are visible but soft:** `border-[#E6DFC8]` on admin, `border-white/10` on public dark theme.
- **No emojis in production UI** unless explicitly requested by the user (some legacy emoji exist in emails; that's fine).

---

## Booking page route map

The booking pages share a public dark theme but each has its own logic:

- `/book` — hub, lists quiz/bingo/band/private + upcoming bookable events
- `/book/quiz` — Thursday quiz booking form (free, lazy event creation, waitlist when full)
- `/book/bingo` — Music Bingo (paid via Square, pay upfront)
- `/book/band` — band/artist stage application (review queue)
- `/book/private` — private hire enquiry (review queue)
- `/book/event/[id]` — generic ticketed event booking (paid via Square)
- `/manage-booking/[id]` — public self-service (view, modify, cancel)

---

## Common pitfalls — known issues to avoid

- **`use client` directives:** Server Components are the default. Don't add `"use client"` unless you actually need state, effects, or browser APIs. Layouts (`layout.tsx`) under `(private)/` and `(public)/` are currently marked `"use client"` because they use `usePathname` — that's deliberate, don't change without thinking.
- **Cookie/JWT mismatch:** `proxy.ts` and the browser client use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the JWT). The server client uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Don't swap them.
- **`event_types` joins:** Supabase joins can return as array OR object depending on the query. Always handle both: `const et = Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types`.
- **Square BigInt:** Square payment amounts use `BigInt`. Don't try to `JSON.stringify` a payment link response without handling it.
- **Date strings vs Date objects:** DB stores `date` as `YYYY-MM-DD` strings. When parsing in JS, always use `new Date(dateStr + "T00:00:00")` to avoid timezone shifts.
- **`is_active` vs `is_bookable`:** An event can be `is_active: true` (visible on the schedule) but `is_bookable: false` (no booking form). Don't conflate them.

---

## Database tables (key ones)

| Table | Purpose |
|---|---|
| `bookings` | Quiz / bingo / event bookings — status: `confirmed`, `waitlisted`, `pending`, `cancelled` |
| `contacts` | Customer details (shared across booking types, keyed on email) |
| `events` / `event_types` | Schedule; events lazily created on first booking for a date |
| `booking_table_mappings` | Seating assignment for confirmed bookings |
| `tables` | Physical tables with `max_capacity` |
| `band_booking_requests` | Stage applications — `pending_review`, `approved`, `rejected` |
| `private_hire_requests` | Private hire enquiries — same flow |
| `quiz_category_configs` | Quiz rounds + question count targets |
| `past_quiz_questions` | Archive (fed back to Gemini to avoid repeats) |
| `gallery_images` | Media on the public gallery and homepage |
| `specials` | Drink deals on the homepage |
| `promo_content` | Social-style promo cards on the homepage |
| `menu_categories` / `menu_items` | Public menu |
| `company_information` | Address, socials, opening hours, capacity |
| `employees` | Staff records, separate from Supabase Auth users |

---

## What to do when unsure

1. Read this file and `STYLE_GUIDE.md`.
2. If a question isn't covered, look at existing patterns in the codebase and match them.
3. If there's no precedent and the choice is significant, **stop and ask**.
4. Never install a new dependency, change the theme, or introduce a new architectural pattern without flagging it.

## Things to never do without explicit permission

- Add a new dependency (npm package)
- Change the colour palette or fonts on either surface
- Move files out of the established folder structure
- Add CSS outside Tailwind (no new `.module.css`, no styled-components)
- Refactor `proxy.ts` to `middleware.ts` or rename the exported function
- Use API routes for mutations that could be Server Actions
- Disable TypeScript or ESLint rules
- Commit secrets — `.env.local` only, never committed
- Use `git add .` or `git add -A`
- Touch the admin theme when working on public pages, or vice versa
