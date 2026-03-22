# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build (also runs TypeScript check)
npm run lint     # ESLint
npm run start    # Start production server
```

There are no tests. Do not add a test framework unless explicitly requested.

## Architecture

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres + Auth + Storage) · Tailwind CSS 4 · Shadcn/UI · Resend (email) · Google Gemini (AI quiz generation)

### Route Groups

```
src/app/
├── (public)/               # No auth required
│   ├── book/               # Hub → redirects to quiz/band/private
│   │   ├── quiz/           # Quiz night booking form
│   │   ├── band/           # Band/artist stage application
│   │   └── private/        # Private hire enquiry
│   ├── manage-booking/[id] # Customer self-service (cancel/view)
│   └── _actions/           # Server actions for all public forms
├── (private)/              # Protected by proxy.ts
│   ├── dashboard/          # Stat cards + pending reviews + booking list
│   ├── events/
│   │   ├── quiz-bookings/  # Manage quiz night bookings (edit, cancel)
│   │   ├── music-bookings/ # Review band applications (confirm/reject)
│   │   └── private-bookings/ # Review private hire enquiries
│   ├── quiz-generator/     # AI quiz creation + question archive
│   └── settings/           # CRUD for tables, events, categories, contacts
└── login/                  # Staff login (Supabase email/password)
```

### Auth

Route protection lives in `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the exported function must be named `proxy`, not `middleware`). It uses `@supabase/ssr` `createServerClient` to check `supabase.auth.getUser()` on every request matching the config matcher. Unauthenticated requests to private routes redirect to `/login`; authenticated requests to `/login` redirect to `/dashboard`.

Login/logout server actions are in `src/app/login/actions.ts`.

### Supabase Clients

- **Server** (`src/lib/supabase/server.ts`): `createServerClient` from `@supabase/ssr` — use in Server Components, server actions, and `proxy.ts`. Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new Supabase format).
- **Browser** (`src/lib/supabase/client.ts`): `createBrowserClient` from `@supabase/ssr` — use in Client Components that need direct Supabase access (e.g. file uploads to Storage). Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `proxy.ts` also uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the JWT, required for session validation).

### Data Fetching Pattern

- **Page components** (async Server Components) fetch read-only data directly via the server Supabase client.
- **Mutations** live in `actions.ts` files co-located with the route (marked `"use server"`).
- **Client Components** call server actions via `useTransition` + async handlers — not via API routes.

### Database Tables

| Table | Purpose |
|---|---|
| `bookings` | Quiz night bookings — status: `confirmed`, `waitlisted`, `cancelled` |
| `contacts` | Customer details (shared across booking types) |
| `events` / `event_types` | Quiz night schedule — lazily created on first booking for a date |
| `booking_table_mappings` | Table assignment for confirmed quiz bookings |
| `tables` | Physical tables with capacity |
| `band_booking_requests` | Band/artist stage applications — status: `pending_review`, `confirmed`, `rejected` |
| `private_hire_requests` | Private event enquiries — same status flow as band |
| `quiz_category_configs` | Category name + question count targets |
| `past_quiz_questions` | Archive of used questions (fed back to Gemini to avoid repeats) |
| `employees` | Staff records (separate from Supabase Auth users) |

### Email (Resend)

Sender: `Don Fenticas <admin@bookingsdonfenticas.co.uk>`
Admin inbox: `admin@bookingsdonfenticas.co.uk`

Emails fire from server actions — never from client code. The app URL is resolved as `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → `http://localhost:3000`.

Three triggers: quiz booking confirmation/waitlist, band application receipt + admin alert, private hire receipt + admin alert. Outcome emails (confirm/reject) fire from the admin review server actions in `src/app/(private)/events/*/actions.ts`.

### Quiz Generator

Uses Google Gemini (`NEXT_PUBLIC_GEMINI_API_KEY`). Fetches the last 50 `past_quiz_questions` and includes them in the prompt to avoid repeats. Generated questions are staged for review before being saved. Categories and question-count targets come from `quiz_category_configs`.

### Supabase Storage

Bucket: `band-videos` (public, 50 MB limit, video MIME types only). Videos are uploaded directly from the browser using the browser Supabase client before form submission. Public URLs are stored in `band_booking_requests.video_urls` (text array).

### Key Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY          # JWT — used in proxy.ts and browser client
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   # New Supabase format — used in server client
RESEND_API_KEY
NEXT_PUBLIC_GEMINI_API_KEY
NEXT_PUBLIC_SITE_URL                   # e.g. https://yourdomain.com
```
