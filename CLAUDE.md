# CLAUDE.md

This file is read by Claude Code on every session. Treat it as authoritative. If a request would cause you to break something in here, **stop and ask** rather than guessing.

For visual / design decisions, also read `STYLE_GUIDE.md`. The two files together are the source of truth.

---

## Commands

```bash
npm run dev          # Dev server
npm run build        # Production build (also runs TypeScript check)
npm run lint         # ESLint
npm run start        # Start production server

npm test             # Unit tests (Vitest) - pure logic in src/lib
npm run test:e2e     # End-to-end (Playwright) - runs on phone + desktop viewports
npm run db:start     # Start local Supabase (Docker, Linux containers) for E2E
npm run db:reset     # Rebuild local DB from supabase/migrations + supabase/seed.sql
npm run db:stop      # Stop local Supabase
```

**Testing** (see `TESTING.md` for the full guide):
- **Unit tests** (Vitest) live beside the code in `src/lib/__tests__/*.test.ts` - pure functions only; don't unit-test Server Components.
- **E2E tests** (Playwright) live in `e2e/` and run against a **local** Supabase stack (`supabase/` migrations + seed), never production. Every spec runs on both a mobile and a desktop viewport.
- Always run `npm test` before committing; run the E2E suite when touching booking/event flows.
- The local stack runs with **RLS off**, so it can't be used to test policies - verify those against a real Supabase project.
- `supabase/migrations/` **is** the migration source of truth. It was reconciled with prod (`pubapp`, ref `vhbbbxljtemawsimqhfw`) on 2026-09-19 and again on 2026-10-01; both sides carry the same 96 versions, which is what the "Supabase Preview" GitHub check verifies on every push. Schema changes must go through a new migration file - applying them straight through the Supabase dashboard or the MCP `apply_migration` puts a version in prod with no local file, the two histories drift, and that check starts failing again. Keep version prefixes unique (`ls supabase/migrations | sed 's/_.*//' | sort | uniq -d` must be empty) or `supabase db reset` stalls on the collision.

## Git workflow

**Do not commit or push changes.** All git operations (staging, committing, pushing) are done manually by the user.

**Commit message conventions (for reference):**
- `add: <thing>` - new feature or file
- `fix: <thing>` - bug fix
- `update: <thing>` - enhancement to existing feature
- `refactor: <thing>` - restructure without behaviour change

Always run `npm run build` successfully before committing.

---

## Tech stack - do not deviate without asking

- **Framework:** Next.js 16 (App Router, Server Components by default, React 19, React Compiler enabled)
- **Language:** TypeScript, strict mode
- **Styling:** Tailwind CSS 4 only - no CSS modules in new code (existing `.module.css` files are tolerated, but don't add more). No styled-components. **No inline `style` props** - this triggers Edge DevTools `no-inline-styles` warnings. **Utility generation is now ON**: `src/app/globals.css` starts with `@import "tailwindcss";` (+ `@import "tw-animate-css";`) and `@source` globs, so Tailwind auto-generates any utility/arbitrary value you use - no need to hand-add utilities. Only genuinely custom semantic classes (`.olive-bg`, `.neon-*`, `.swatch-*`, the `[style*="--ev-c"]` colour hooks, `.rich-content`, etc.) live hand-written under `@layer utilities` at the bottom of `globals.css`; add new ones there only when a class can't be expressed as a Tailwind utility. (Historical note: this file used to be committed as pre-compiled CSS with utilities hand-maintained; that's no longer the case.) For dynamic values that can't be expressed as static Tailwind classes:
  1. **Preferred:** Set a CSS custom property via `style` and consume it via Tailwind arbitrary value - e.g. `style={{ "--badge-color": color } as React.CSSProperties}` + `className="bg-[var(--badge-color)]"`. This keeps the actual styling in classes.
  2. **Acceptable:** Use `style` only for CSS custom properties (`--var-name`), never for standard CSS properties like `backgroundColor`, `color`, `borderColor`, `minWidth`, etc.
  3. When refactoring existing inline styles, convert `style={{ backgroundColor: x, color: y }}` → `style={{ "--c": x, "--bg": y } as React.CSSProperties}` + Tailwind `text-[var(--c)] bg-[var(--bg)]`.

  Also **prefer the canonical scale token over an arbitrary px value** when the value is on the scale (`min-w-50` not `min-w-[200px]`) - see the "Prefer canonical Tailwind classes" rule under Visual standards below.
- **Component library:** shadcn/ui (new-york style), components live in `src/components/ui/`. Owned by us - edit freely.
- **Primitives:** Radix UI (via shadcn)
- **Icons:** Lucide React for UI/interface icons. For brand/social logos (Instagram, Facebook, YouTube, X, TikTok, etc.), use Simple Icons via `react-icons/si` (`SiInstagram`, `SiFacebook`, `SiYoutube`, …) - Lucide's brand icons are deprecated and being removed in v1.0. Don't add other icon libraries without asking.
- **Forms:** react-hook-form + zod where validation is non-trivial; plain `useState` is fine for simple forms
- **Auth:** Supabase Auth via `@supabase/ssr`
- **DB:** Supabase Postgres (no Prisma; use the Supabase client directly)
- **Email:** Resend. Never hardcode an address - `src/lib/email.ts` owns `EMAIL_FROM` (sender) and `ADMIN_EMAIL` (staff recipient), both env-overridable. The customer-facing contact address (replyTo, "questions?" copy, Square support) comes from `getContactEmail()` in `src/lib/company-info.ts`, which reads `company_information.email`. The sender is **not** DB-driven: Resend only sends from a verified domain
- **Payments:** Square (sandbox + production envs)
- **AI:** Google Gemini today, behind a provider registry. Every AI feature is an *area* in `src/lib/ai/areas.ts` and calls `src/lib/ai/client.ts` (`aiText`, `aiSearch`, `aiReadFile`, `aiImage`) - never a provider URL directly. Staff choose the provider, model and API base URL per area on Settings → AI settings; providers are adapters under `src/lib/ai/providers/` (add one file + one registry entry for a new vendor). Keys stay in env, one per provider
- **Storage:** Supabase Storage (`gallery`, `band-videos` buckets)
- **Music:** Spotify Web Playback SDK (quiz integration only)
- **Animations:** `tw-animate-css` + Tailwind animate utilities. No Framer Motion (yet) - ask before adding.
- **Toasts:** `sonner`
- **Date handling:** `date-fns` only
- **Charts/tables:** none currently; ask before adding

If you think a new dependency is needed, **stop and ask** before installing.

---

## Route structure

```
src/app/
├── (public)/              # No auth required, public-facing
│   ├── book/              # Hub → quiz/band/private + per-event and grouped pages
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

## Supabase clients - pick the right one

- **Server** (`@/lib/supabase/server.ts`) → Server Components, Server Actions, `proxy.ts`. Reads cookies via `next/headers`.
- **Browser** (`@/lib/supabase/client.ts`) → Client Components that need direct access (e.g. Storage uploads).
- **Admin** (`@/lib/supabase/admin.ts`) → Service role key, server-only, use sparingly (currently for invite acceptance flow).

Required env vars:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY            # JWT - used in proxy.ts and browser client
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     # New Supabase publishable key format
SUPABASE_SERVICE_ROLE_KEY                # Admin client only, never NEXT_PUBLIC_
RESEND_API_KEY
EMAIL_FROM                               # Resend sender, RFC 5322 e.g. 'Don Fenticas <admin@…>' - domain must be verified in Resend
ADMIN_EMAIL                              # Where internal staff notifications land
EMAIL_REPLY_DOMAIN                       # Subdomain with its MX on Resend inbound (e.g. reply.bookingsdonfenticas.co.uk); customer emails reply-to band-/act-/hire-/enq-<ref>@ or cust-<id>@ it. Unset = replies go to EMAIL_FROM
RESEND_WEBHOOK_SECRET                    # Signing secret of the Resend `email.received` webhook → /api/resend/inbound
NEXT_PUBLIC_GEMINI_API_KEY
NEXT_PUBLIC_SITE_URL                     # e.g. https://bar-app-tau.vercel.app
SQUARE_ACCESS_TOKEN
SQUARE_ENVIRONMENT                       # 'sandbox' | 'production'
SQUARE_LOCATION_ID
SQUARE_WEBHOOK_SIGNATURE_KEY
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
GOOGLE_MAPS_API_KEY                      # Static Maps image on /contact, proxied via /api/static-map (never sent to the browser)
NEXT_PUBLIC_VAPID_PUBLIC_KEY             # Web Push (Market Night phone alerts) - browser subscribes with this
VAPID_PRIVATE_KEY                        # Signs push requests server-side, never NEXT_PUBLIC_. Generate both: node scripts/generate-vapid-keys.mjs
VAPID_SUBJECT                            # mailto: or https: contact for push services; falls back to NEXT_PUBLIC_SITE_URL
TWILIO_ACCOUNT_SID                       # Market Night text alerts - all four TWILIO_* set = SMS option live on /market, any missing = "Coming soon"
TWILIO_AUTH_TOKEN                        # Also verifies the /api/twilio/inbound webhook signature
TWILIO_VERIFY_SERVICE_SID                # Verify service (VA…) that texts the sign-up code
TWILIO_SMS_FROM                          # Alphanumeric sender (e.g. DonFenticas), a Twilio number, or a Messaging Service SID (MG…)
TWILIO_WHATSAPP_FROM                     # Market Night WhatsApp alerts - the approved WhatsApp sender (whatsapp:+44…, the sandbox number, or an MG… SID). Set = WhatsApp option live
TWILIO_WHATSAPP_TEMPLATE_SID             # Approved content template (HX…) for alerts outside a 24h window; unset = free text (sandbox / reply window only)
TWILIO_WHATSAPP_SANDBOX_JOIN             # Optional "join <words>" line shown on the sign-up card while testing against the Twilio sandbox
MARKET_EMAIL_ALERTS                      # 'on' lights up the Email option on /market (sends through the existing Resend key); unset = "Coming soon"
```

---

## Data fetching & mutations

- **Reads** happen in async Server Components via the server Supabase client. Don't fetch in `useEffect` unless there's a specific client-side reason.
- **Writes** go through Server Actions co-located with the route (`actions.ts`). No API routes for mutations unless there's a specific reason (webhooks, third-party callbacks like Square).
- **Email sending** fires from Server Actions - never from client code.

For unauthenticated/public mutations (booking forms, manage-booking page), Server Actions are still fine; they don't require an authenticated session.

---

## Two distinct UI surfaces

This app has two faces and they look intentionally different. **Don't mix them.**

### Public site (`/`, `/book`, `/menu`, `/gallery`, `/contact`)
- Dark theme: `#26300D` (deep olive) background, `#FDCC4B` (gold) accent
- "Gritty bar" aesthetic - see `STYLE_GUIDE.md` for the full palette and rules
- Mobile-first; design at 375px width and scale up
- Phones get a four-slot bottom bar (`MobileBottomBar`: Home, Book, Menu, Contact) that hides on scroll-down and **no hamburger drawer**; everything else is reached from a home-page section (Gallery via `GalleryStrip`, What's On via the hero/Coming Up, the market via the live ticker) - see `STYLE_GUIDE.md`
- Big, confident typography; lots of uppercase tracking; serif or bold display vibes welcome
- Real photography over illustration

### Admin portal (`/dashboard`, `/event-bookings/*`, `/event-setups/*`, `/settings/*`)
- Light/warm theme: `#F4F1E8` canvas, `#FFFEFA` cards, `#ECE9DE` subtle surface, `#D8D5C8` borders, `#20231A` text, `#5E6654` muted text, `#34451F` primary olive (hover `#283719`, soft `#E5EBD8`), `#D7A928` brand gold. Use the `admin-*` Tailwind tokens in new code (`bg-admin-card`, `text-admin-muted`, `border-admin-line`, …) rather than raw hex - see `STYLE_GUIDE.md`. The old espresso palette (`#5C4033`/`#F7F4EA`/`#E6DFC8`/`#1F1F1A`/`#5F624F`) is retired on admin; it still appears on public pages, where it's unrelated
- Semantic colour is for meaning only - success `#22613F`/`#E7F3EC`, warning `#9A5B00`/`#FFF4D6`, error `#B33A32`/`#FDECEA`, info `#28608F`/`#EAF2F8` (`admin-success`, `admin-warning`, `admin-error`, `admin-info` + `-bg`). **Don't give ordinary categories their own blue/purple/orange/red backgrounds** - neutral `bg-admin-surface` or `bg-admin-primary-soft` instead. The user-picked event-type swatches in `src/lib/event-type-colors.ts` are the one exception
- Card-based information density - this is a working tool, not a marketing surface
- Sidebar nav on desktop (≥sm), persistent bottom nav on mobile (≤sm)
- **Nav chrome is dark olive, not cream.** The sidebar and bottom nav use the `nav-*` tokens: `bg-nav-bg` (`#263019`), `text-nav-ink` (`#DDE2D1`), `text-nav-muted` (`#AEB69D`), `bg-nav-selected` (`#34451F`), `border-nav-indicator` (`#D7A928`), `border-nav-line`. Selected item = `bg-nav-selected` + a thin `border-l-2 border-nav-indicator` - never a full gold fill. Navigation-only: don't put `nav-*` on cards, sheets or forms, and don't use espresso for nav state. Full rules in `STYLE_GUIDE.md`
- Sheet-based detail/edit views (bottom sheet on mobile, centered on desktop)

If you find yourself styling a public page with espresso/cream tones, or an admin page with olive/gold, **stop**. You're on the wrong surface.

---

## Visual standards (summary - full version in `STYLE_GUIDE.md`)

- **Touch targets ≥ 44×44px** on anything tappable on mobile (WCAG)
- **Icon-only buttons/links need `aria-label` or `title`** - a `<button>`/`<a>` containing only a Lucide icon must have an accessible name, or Edge DevTools fires `axe/name-role-value` ("Buttons must have discernible text"). Same class of Edge DevTools warning as `no-inline-styles`. See STYLE_GUIDE Accessibility.
- **Every form element needs a label** - `<input>`/`<select>`/`<textarea>`, including checkboxes, need a `<label htmlFor>` or `aria-label`. A `<span>` sitting next to the input is not a label. Missing → Edge DevTools `axe/forms` ("Form elements must have labels"). See STYLE_GUIDE Accessibility.
- **Prefer canonical Tailwind classes over arbitrary values.** If a value sits on the spacing/size scale, use the token, not the bracket form: `min-w-50` not `min-w-[200px]`, `gap-2` not `gap-[8px]`, `p-4` not `p-[16px]`, `text-sm` not `text-[14px]`, `w-px` not `w-[1px]`. (Scale token `N` = `N × 0.25rem` = `N × 4px` at the 16px root, so `px ÷ 4` gives the token, including half-steps like `h-5.5` for `22px`.) This applies beyond spacing/size too - check before reaching for `[...]`:
  - **Letter-spacing:** `tracking-widest` not `tracking-[0.1em]` (Tailwind's tracking scale tops out at `widest` = `0.1em` - don't bracket a value that already has a name).
  - **Aspect ratio:** `aspect-4/3` not `aspect-[4/3]` (Tailwind 4 supports bare fraction syntax - no brackets needed).
  - **Colour opacity modifiers:** `bg-[#FF4D6D]/12` not `bg-[#FF4D6D]/[.12]` (the `/NN` suffix already takes a percentage - never wrap it in its own brackets).
  - **Custom palette hex itself** (`border-[#E6DFC8]`), **non-spacing units** (`h-[85vh]`, `w-[90%]`), **dynamic CSS vars** (`bg-[var(--badge-color)]`), and any value genuinely off-scale (`text-[10px]`, `text-[13px]`) are the legitimate uses of `[...]` - keep the brackets there, just around the part that actually needs them.
  - This is exactly what the IntelliSense `suggestCanonicalClasses` hint flags - **treat that hint as a required fix before considering a component done**, the same way `no-inline-styles` and `axe/*` warnings are treated elsewhere in this file. Don't invent off-scale px values just to use a bracket, and don't leave a flagged class unfixed because "it still works."
- **Type scale (public surface):** role tokens from `globals.css`, fluid across devices - `text-h2` / `text-h3` for section headings (Archivo Black, uppercase), `text-body`, `text-btn`, `text-nav`, `text-meta`, `text-eyebrow` for interface text (Archivo, semibold, sentence case) and `text-pill` (11px, the floor) for date stamps and status pills. No `text-[Npx]` for text with a role, no `font-black` on labels, nothing tracked wider than `tracking-wide`. Full table in `STYLE_GUIDE.md` → "Typography on the public site" and the `public-type-scale` skill.
- **Type scale (admin surface):** Archivo only - **`font-black` (Archivo Black), `uppercase` and `tracking-widest` are retired on admin.** Hierarchy comes from size and weight: `font-bold` is the heaviest, ordinary interface text is sentence case, and nothing that carries meaning goes below 11px. Uppercase survives only on compact labels (status pills, date abbreviations, table column headers) at `text-[11px] font-semibold tracking-wide`. Full table in `STYLE_GUIDE.md` → "Typography on admin".
- **Colour usage:** Public pages use the olive/gold palette plus deep burgundy and a neon accent (see STYLE_GUIDE). Admin pages stay on the espresso/cream palette - except the sidebar and bottom nav, which use the dark-olive `nav-*` tokens.
- **Admin action buttons - solid olive means "this writes a record".** Label type is `text-[13px] font-semibold` in sentence case on all of them (see the admin type scale above - no `font-black`, no `uppercase`, no `tracking-widest`); only the colour changes. **Save / Create / Add / New / Upload** must contain `bg-[#34451F] hover:bg-[#283719] text-white`. **Edit** is an olive *outline*: `border border-[#34451F] text-[#34451F] hover:bg-[#E5EBD8]`. **Cancel** is a neutral outline (`border border-[#D8D5C8] text-[#5E6654] hover:bg-[#ECE9DE]`). **Delete** is red `#B33A32` and only behind a confirmation. Compose sizing/radius around these. At most one solid olive button per view - a second primary makes neither read as primary. **Gold `#D7A928` is never a button colour** (focus rings, selection and small brand details only). The retired amber Edit (`#B45309`) and green Create (`#1B4332`) must not come back. See STYLE_GUIDE "Action buttons".
- **Same role, same component (public).** Section "see more" links are `SectionAction`; primary CTAs are `ArrowCta`; booking CTAs are `BookingButton`. Never hand-style a link or button that already has a component - two elements with the same job and different looks is a defect, and `/design-review` flags it. See STYLE_GUIDE "Section anatomy on the public site".
- **Card radii:** `rounded-2xl` (cards) and `rounded-3xl` (sheets) are the defaults. Don't introduce new radius values without a reason.
- **Borders are visible but soft:** `border-[#E6DFC8]` on admin, `border-white/10` on public dark theme.
- **No emojis in production UI** unless explicitly requested by the user (some legacy emoji exist in emails; that's fine).

---

## Design references (skills in `.claude/skills/`)

Design skills are installed project-side. Load them with the Skill tool at the right moment; they supply taste and checklists, they do not override this file or `STYLE_GUIDE.md`.

**Before building or reshaping anything under `src/app/(public)/`:**
- `frontend-design` - aesthetic direction. The public surface is a gritty bar / pub / live-music venue: poster typography, real photography, texture and depth, asymmetric composition. Use it to avoid templated layouts (centred hero + three feature cards, evenly spaced grids, generic gradients).
- `tailwindcss-mobile-first` - phone layout. Design at 375px first, fluid type/spacing with `clamp()`, container queries for reusable sections, safe-area insets on anything fixed, 44px touch targets.
- `ui-ux-pro-max` - when you need a palette, font pairing or UX rule looked up rather than invented. Query it with the venue/rock/indie brief, then map results onto the existing olive/gold palette.
- `public-components` (project skill) - which shared component owns each repeated role (section actions, CTAs, booking buttons, pills). Load before styling any button, link or header on a public page.
- `public-type-scale` (project skill) - the role-based size tokens. Load it before adding or changing any text on a public page so headings, eyebrows, buttons and meta land on the scale rather than on an arbitrary pixel size.

**Before finishing any UI change (public or admin):**
- `web-design-guidelines` - audit the changed components against the Vercel web interface rules (accessibility, focus, forms, responsive behaviour). Fix what it flags.
- `impeccable` - critique pass on the page; use its polish / distill / bolder / quieter directions to tune, not to restyle from scratch.

**When adding features or data flows:**
- `vercel-react-best-practices` - Server Component, data fetching and bundle patterns for Next.js 16 / React 19.
- `ui-styling` - shadcn/ui and Radix usage; pair with the Shadcn UI MCP `list_blocks` / `get_block` for section layouts to restyle rather than invent.

**Limits that still apply when a skill suggests otherwise:**
- Fonts are fixed on both surfaces. A skill recommending a new typeface is a proposal to raise with the user, never an install.
- No new npm dependencies (Framer Motion, GSAP, icon packs, chart libraries) without asking. Animation stays on `tw-animate-css`.
- Admin pages keep the admin palette and Archivo type scale. The public-surface skills above are not licence to add texture, uppercase tracking or gold to admin.
- Verify visually: open the page in the built-in browser at the mobile preset and desktop, screenshot both, and check console errors before calling a UI change done.

---

## Code style

- **Do not add comments to code.** The code should be self-documenting - prefer a clearer name or a small extracted function over a comment explaining what something does.
- **Never add change-narration comments** (`// added X`, `// new`, `// updated to handle Y`, `// removed old handler`). The diff already says this.
- Only write a comment when the user explicitly asks for one, or when the surrounding file already comments that exact kind of construct and omitting it would be inconsistent.
- **Keep existing comments** - don't strip comments already in the file unless the code they describe is being deleted or the comment has become wrong.

---

## Booking page route map

The booking pages share a public dark theme but each has its own logic:

- `/book` - hub, lists quiz/band/private + upcoming bookable events
- `/book/band` - band/artist stage application (review queue)
- `/book/private` - private hire enquiry (review queue)
- `/book/event/[id]` - generic ticketed event booking (paid via Square)
- `/book/group/[scope]/[id]` - grouped booking (pick a date within a type or sub-type); the quiz and Music Bingo book here. The old `/book/bingo` and `/book/quiz` forms are gone: `next.config.ts` redirects `/book/bingo/manage-booking/:id` and `/book/quiz/manage-booking/:id` → `/manage-booking/:id` and any other `/book/bingo` path → `/book`, and `/book/quiz` is a server redirect to the next bookable quiz's page (`src/lib/quiz-booking-link.ts`, also behind the home page's "Book for the quiz" buttons)
- `/manage-booking/[id]` - public self-service (view, modify, cancel)

---

## Common pitfalls - known issues to avoid

- **`use client` directives:** Server Components are the default. Don't add `"use client"` unless you actually need state, effects, or browser APIs. Layouts (`layout.tsx`) under `(private)/` and `(public)/` are currently marked `"use client"` because they use `usePathname` - that's deliberate, don't change without thinking.
- **Cookie/JWT mismatch:** `proxy.ts` and the browser client use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the JWT). The server client uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Don't swap them.
- **`event_types` joins:** Supabase joins can return as array OR object depending on the query. Always handle both: `const et = Array.isArray(ev.event_types) ? ev.event_types[0] : ev.event_types`.
- **Square BigInt:** Square payment amounts use `BigInt`. Don't try to `JSON.stringify` a payment link response without handling it.
- **Date strings vs Date objects:** DB stores `date` as `YYYY-MM-DD` strings. When parsing in JS, always use `new Date(dateStr + "T00:00:00")` to avoid timezone shifts.
- **`is_active` vs `is_bookable`:** An event can be `is_active: true` (visible on the schedule) but `is_bookable: false` (no booking form). Don't conflate them.

---

## Database tables (key ones)

| Table | Purpose |
|---|---|
| `bookings` | Quiz / bingo / event bookings - status: `confirmed`, `waitlisted`, `pending`, `cancelled` |
| `contacts` | Customer details (shared across booking types, keyed on email) |
| `events` / `event_types` / `event_subtypes` | Schedule. Events are created from exactly three places: the admin event sheet, the band `booked` transition, and private-hire `confirmed` - there is no lazy creation on booking. Poster images resolve at render (`src/lib/event-image.ts`): `events.image_url` → the booked act's `music_acts.cover_image_url` → `event_subtypes.default_image_url`. A null `events.image_url` means "inherit", so changing a subtype default updates every non-overridden event; nothing is ever copied between rows |
| `booking_table_mappings` | Seating assignment for confirmed bookings |
| `tables` | Physical tables with `max_capacity` |
| `band_booking_requests` | Stage applications - five-stage pipeline: `new` → `reviewing` → `offered` → `booked` → `declined`. `booked` (with a date) places an active `events` row; every other status deactivates the linked event. `offered` emails an offer, `booked`/`declined` email the outcome; reschedule sends a request back to `offered`. Saving a changed fee on an offered or booked act asks whether to email `band.fee_updated` (the slot card with the new fee, plus an optional note), via `sendFeeUpdateEmail`. The offer and reschedule emails carry Accept / Discuss / Withdraw buttons into the act's own page `/band-offer/[id]` (no login, the uuid is the key; `src/lib/band-flow.ts` holds `respondAsAct` plus the event sync and email sender the admin actions share): accepting stamps `act_accepted_at` and books the request - event created, `band.booked` sent - unless the slot is incomplete or now clashes, in which case it stays `offered` for staff to sort; discuss writes the message to Team notes and Correspondence (`page_response`); withdraw stamps `act_withdrawn_at` and declines with no reason. Every answer emails `admin.band.act_response` to `ADMIN_EMAIL`. Any staff status move clears `act_accepted_at` (except booking) and Reopen clears `act_withdrawn_at`. Separate `payment_status` (`no_payment`/`unpaid`/`partially_paid`/`paid`/`over_paid`, derived from amounts) tracks the fee. `decline_reason` is the reason given to the act when it was declined (the only free-text staff field on the row): declining writes it and a Team note quoting it, and Reopen clears it and writes a Team note recording the old reason, as private hire does. Every Monday at 9am London time `/api/band-invoice-requests` (Vercel cron, called at 08:00 and 09:00 UTC so one lands at 9am in both GMT and BST) sends the `band.invoice` template to each booked act whose active event started in the last 7 days and has no outbound `email_messages` row of kind `invoice` yet; the invoice template PDF is that template's attachment. A reply carrying the completed template is read in `storeInboundEmail` (`src/lib/invoice-pdf.ts` reads the `pay_name`/`pay_sort`/`pay_acc` form fields; any other invoice - an act's own PDF, a scan or a photo - falls back to the `invoice_reading` AI area, only for replies after an invoice request or that mention an invoice): its bank details go onto the booking, onto the act's main `bank_*` columns when it has none, otherwise onto `music_acts.extra_bank_accounts` (jsonb list), and a booking note records what was copied |
| `private_hire_requests` | Private hire enquiries. Pipeline (rules in `src/lib/private-hire-status.ts`, every step in `src/lib/private-hire-flow.ts`): `new` → `awaiting_customer` (staff proposed other times) → `awaiting_deposit` (times agreed, deposit requested) → `confirmed`; `declined`, `cancelled` and `expired` close it and staff can reopen (`reopenPrivateHire` moves it back to `new`, keeps the slot and deposit amount, clears the approval and payment stamps, and writes a Team note recording any earlier payment so the refund isn't lost; expired requests instead "Reopen with new deadline", which is `approvePrivateHire`). Legacy `pending` is read as `new` (`statusValues("new")` filters both). The event is only created once the deposit is paid - by the Square webhook (order matched on `square_order_id`) or staff "Mark deposit paid" - and a £0 deposit skips straight to `confirmed`. A slot whose date has passed can't be approved, proposed or moved to (`slotProblem` in the flow, and the sheet blocks the button first); a guest count over `company_information.max_capacity` only warns (icon on the Guests row and a notice in the approve/propose dialogs). Every approval (`approvePrivateHire`) writes a Team note saying how the slot was agreed - staff approving, staff recording a customer's yes by email/phone, or an expired request reopened - plus the deposit asked for; the customer accepting on their own page writes its own note instead. Deposit amount defaults to `company_information.private_hire_deposit`; it's due `private_hire_deposit_days` after approval (never later than the day before the hire). While `awaiting_deposit` the request holds its slot: `heldPrivateHireSlots` is merged into the admin clash checks and band availability. Once the times are agreed (`awaiting_deposit` or `confirmed`), a new date/time - and, while the deposit is unpaid, a new deposit amount - goes through `changeAgreedHire` (never a plain field save; `updatePrivateHireFields` drops those fields at these stages): a moved hire emails `private_hire.rescheduled` (and syncs the event once confirmed; the due date is pulled earlier if the new date needs it), a deposit-only change emails `private_hire.deposit_updated`, and a £0 deposit confirms the hire. Whenever a checkout is replaced (`supersedeCheckout`), the old Square order id moves to `superseded_square_order_ids`, and the webhook matches those too, so a customer paying a stale checkout still confirms the hire. The Square payment link's own id is kept in `square_payment_link_id`, and `switchOffCheckout` deletes the link in Square whenever the checkout is replaced, the request closes, or a deposit is marked paid by hand. A deposit marked paid for less than asked is `payment_status = partially_paid` (balance shown on the sheet). A card payment arriving for a hire that's already confirmed, or one already closed, is written to Team notes and alerts the team (`admin.private_hire.extra_payment` / `admin.private_hire.closed_payment`) rather than being dropped. Deposits are refunded from the sheet (`refundHireDeposit`): a card refund goes through `squareClient.refunds.refundPayment` against `square_payment_id` and sits at `refund_status = pending` until the `refund.updated` webhook marks it `completed` (or `failed`, which puts the money back on the row, notes it and sends `admin.private_hire.refund_failed`); a refund paid back by bank transfer/cash is recorded as completed straight away. Part refunds are allowed - `refunded_amount` accumulates and `payment_status` only becomes `refunded` once it equals what was paid (`refundableAmount` / `paymentStatusAfterRefund`). Every refund writes a Team note and emails `private_hire.deposit_refunded`; the Cancel hire dialog can refund the card deposit in the same step, in which case the cancellation email's `{{depositOutcome}}` says so instead of "we'll be in touch". Second payments recorded only in notes (paid twice / paid after closing) are still refunded by hand in Square. The customer acts from `/private-hire/[id]` (no login, the uuid is the key - accept/turn down proposed times, pay the deposit, cancel); a message they type there goes into Team notes and into the request's correspondence as an unread inbound `email_messages` row (kind `page_response`), turning down a proposal emails them `private_hire.time_turned_down`, and the page's "Questions?" address is the request's `hire-<ref>@` reply address, so mail sent to it lands in the same correspondence; the daily `/api/private-hire/deposits` cron (07:00 UTC) sends one reminder two days before the due date and expires unpaid requests after it. "Resend" (`resendPrivateHireEmail`) sends the proposal or deposit request again with an optional staff message and writes a Team note; a deposit request whose deadline has already passed goes out with a fresh one (`renewedDepositDue`) and the reminder is re-armed. Cancelling or declining deactivates any linked event; refunds are done by hand in Square |
| `quiz_category_configs` | Quiz rounds + question count targets. `ai_prompt` is the generator prompt in use for the round, with `{{tokens}}` the code fills in - the built-in text from `src/lib/quiz/prompt-templates.ts` until staff edit it; null (pre-column rows only) reads as built-in |
| `past_quiz_questions` | Archive (fed back to Gemini to avoid repeats) |
| `ai_settings` | One row: `providers` and `areas` jsonb maps keyed by the code registries in `src/lib/ai/`, each entry carrying label, model, optional `api_base_url`, `active` and audit stamps. Reconciled against the code on every load/save of Settings → AI settings, so removed areas show as inactive rather than vanishing |
| `gallery_images` | Media on the public gallery and homepage |
| `gallery_categories` / `gallery_image_categories` | Gallery groupings (Outside, Karaoke nights, ...). An item can be in several categories (link table) and shows in each; items with no active category show under "Everything else" (`/gallery/everything-else`, a reserved slug). The home page shows one tile per non-empty active category, each opening `/gallery/<slug>`; grouping lives in `src/lib/gallery-categories.ts`, loading in `src/lib/gallery-data.ts`. `cover_image_id` picks the tile image, null = newest photo |
| `specials` | Drink deals on the homepage |
| `merchandise` | Branded goods shown on the homepage - display only, no checkout. `display_order` is auto-resequenced 1..N across active rows (see `src/lib/merchandise-order.ts`); inactive rows sit at 0 |
| `promo_content` | Social-style promo cards on the homepage |
| `menu_categories` / `menu_items` | Public menu |
| `email_messages` | Email correspondence with customers, both directions - band requests, music acts, private hires, enquiries and direct customer emails. Every customer email is sent through `sendCorrespondenceEmail` (`src/lib/email/correspondence-data.ts`), which sets the reply-to and logs the row; replies arrive via the Resend inbound webhook and are matched by reply-to address, then In-Reply-To, then sender email. Linked to `band_booking_requests`, `music_acts`, `private_hire_requests` and `enquiries` (reply-to `band-`/`act-`/`hire-`/`enq-` + the 8-char ref) and always to `contacts` via `contact_id` (`cust-<id>` for direct emails), so a customer's record shows every thread; every send BCCs `ADMIN_EMAIL`; attachments are copied to the private `email-attachments` bucket. HTML bodies are shown only after `cleanEmailHtml` (`src/lib/email/email-html.ts`, DOMPurify) inside a sandboxed iframe with no script permission and a CSP that blocks remote images until staff click "Show images" (our own outbound emails load them straight away); `text_body` is the fallback |
| `email_templates` / `email_brand` | Staff overrides for the automatic emails. The scenario list and default copy live in `src/lib/email/scenarios.ts`; a row overrides copy slot-by-slot and `blocks` (jsonb, null = standard layout) replaces the body with text/image/button/divider/spacer blocks plus the generated booking blocks, which can move but not be removed. `email_brand` is one row of shared logo/font/colours/footer - null fields keep each of the three designs (band, booking card, plain) on its own look. `renderTemplate` attaches both to the slots and `src/lib/email/layout.ts` draws them; logos and images live in the public `email-assets` bucket. `attachments` (jsonb) lists files in the private `email-attachments` bucket under `templates/<key>/` that go out with every send of that template - correspondence sends pass `templateSlots`, direct Resend sends spread `resendTemplateAttachments(slots)`; an unreadable file is skipped, never blocking the email. `variant_name` null is the Standard row for a scenario (unique per scenario); a named row is a **version** - only the seven customer booking emails in `src/lib/email/booking-email-versions.ts` (`BOOKING_EMAILS`) can have them. `event_types`, `event_subtypes` and `events` each carry `booking_emails` (jsonb, email slot → `email_templates.id`, `0` = force Standard, missing/null = inherit); each email resolves on its own event → sub-type → type → Standard, independent of `booking_grouping`. Send sites call `renderBookingTemplate` (`src/lib/email/booking-email-choice.ts`); a deleted or mismatched version falls back to Standard, and deleting a version strips it from every `booking_emails` |
| `company_information` | Address, socials, opening hours, capacity. `whatsapp_url` is the venue's WhatsApp group invite or Channel link (`src/lib/whatsapp-link.ts` only accepts `chat.whatsapp.com/<code>` or `whatsapp.com/channel/<id>`); when set, `/market` shows a Join card and a WhatsApp tile in the notification picker. Staff post there by hand - the WhatsApp Business API can't write to a group |
| `market_push_subscriptions` | Web Push endpoints from the public Market Night page - one row per phone. `watched_instrument_ids` is the drinks whose bell was tapped and **empty = no alerts at all** (`relevantTo` in `push-alerts.ts`, shared by every channel): a subscriber only hears about watched drinks plus a market crash. The page's `WatchList` row (`watch-list.tsx`) says so, keys the bell states and opens a panel listing the watched drinks. Written only via the admin client from `src/app/(public)/market/actions.ts`; sent to after each tick by `src/lib/market/push-alerts.ts`, dead endpoints (404/410) self-delete |
| `market_sms_subscriptions` | Verified UK mobiles for Market Night text alerts, the SMS twin of the push table - behind the `TWILIO_*` env flag (`smsAlertsEnabled()` in `src/lib/sms/twilio.ts`; nothing installed, plain `fetch` to Twilio). Sign-up is number → Verify code (`startSmsAlerts` / `confirmSmsAlerts` in the market `actions.ts`); the phone keeps `manage_token` in localStorage and needs it to change its watched list or stop. Sent after each tick by `src/lib/market/sms-alerts.ts`: one text per tick inside a single 160-char segment, at most `SMS_MAX_PER_NIGHT` (4) per phone per trading night (`sent_night`/`sent_count`), same relevance rules as push, and only while a session is live (alerts fire from the tick). Every text ends with a "Stop texts" link to `/market/stop?t=<stop_code>` (12-hex column, `stopSmsByCode`) because an alphanumeric sender can't take replies; the page's own Turn off button and, when the sender is a number, STOP/START replies to `/api/twilio/inbound` (signature-checked) also set/clear `opted_out_at`. A send Twilio refuses as unsubscribed (21610) opts the row out too |
| `market_whatsapp_subscriptions` | Verified numbers for Market Night WhatsApp alerts, the fourth channel, behind `TWILIO_WHATSAPP_FROM` (`whatsappAlertsEnabled()` in `src/lib/sms/twilio.ts`, same account and Verify service as SMS - the sign-up code arrives on WhatsApp via Verify's `whatsapp` channel). Same row shape, `manage_token` model, stop link (`/market/stop?t=<stop_code>&c=w`, shared helpers in `src/lib/market/alert-stop.ts`) and inbound STOP/START handling as SMS (the webhook strips the `whatsapp:` prefix and picks the table). Sent after each tick by `src/lib/market/whatsapp-alerts.ts`, at most `WHATSAPP_MAX_PER_NIGHT` (6) per number per night: as the approved content template (`TWILIO_WHATSAPP_TEMPLATE_SID`, four variables - heading, joined drink lines, board link, stop link - see `whatsapp-copy.ts`) when one is set, else free text. Production needs a Meta-verified WhatsApp sender and that template; the Twilio sandbox works for testing once a phone has sent its "join" phrase |
| `market_email_subscriptions` | Verified addresses for Market Night email alerts, behind `MARKET_EMAIL_ALERTS=on` (`emailAlertsEnabled()` in `src/lib/market/email-alerts.ts`, sent with Resend from `EMAIL_FROM`). Sign-up is address → six-digit code (`startEmailAlerts` / `confirmEmailAlerts`): the code is stored hashed with a 10-minute expiry, five attempts and a one-minute resend gap, and the row only counts once `verified_at` is set. Same `manage_token` model as SMS; it also signs the unsubscribe link (`/market/unsubscribe?e=&t=`) in every email and the `List-Unsubscribe` headers. Sent after each tick by `sendMarketEmailAlerts`, at most `EMAIL_MAX_PER_NIGHT` (6) per address per trading night. The sign-up card for both channels is `alert-signup.tsx` |
| `square_sales` / `square_sale_lines` | Square orders pulled nightly by `/api/square/sync` (Vercel cron) into one row per order for the dashboard's venue sales and one row per line item (every item, linked to the menu or not) for the market's normal sales. `src/lib/square-sync.ts` plans each run with `src/lib/square-sync-plan.ts`: the first run ever backfills six months in seven-day windows, saving `square_sync_state.backfill_cursor` after each so a timeout or outage costs one window and the next run (cron, or "Sync now" in admin) carries on; once `backfill_done_at` is set, runs top up from `last_synced_at` with a three-day lookback, also windowed. Every run then prunes orders whose `business_date` is older than seven months from the app only (lines cascade; Square is never written to). Square calls retry three times with a pause; a run that still fails is logged in `square_sync_runs` (one row per run, the error log), bumps `consecutive_failures`, and mails `ADMIN_EMAIL` on the first failure of a streak and every third one (`src/lib/square-sync-alert.ts`). `trading_night` is the London date rolled back a day before 06:00, so a 01:45 sale belongs to the night before. A market event's `weekdays` ("Sales history days") only filter which weekdays' nights feed its normals (`effectiveWeekdays`: none picked = all seven); they never open or close the market |
| `employees` | Staff records, separate from Supabase Auth users |

---

## What to do when unsure

1. Read this file and `STYLE_GUIDE.md`.
2. If a question isn't covered, look at existing patterns in the codebase and match them.
3. If there's no precedent and the choice is significant, **stop and ask**.
4. Never install a new dependency, change the theme, or introduce a new architectural pattern without flagging it.

## Things to never do without explicit permission

- Add a new dependency (npm package)
- Change the fonts on either surface
- Move files out of the established folder structure
- Add CSS outside Tailwind (no new `.module.css`, no styled-components)
- Refactor `proxy.ts` to `middleware.ts` or rename the exported function
- Use API routes for mutations that could be Server Actions
- Disable TypeScript or ESLint rules
- Commit secrets - `.env.local` only, never committed
- Use `git add .` or `git add -A`
- Touch the admin theme when working on public pages, or vice versa
