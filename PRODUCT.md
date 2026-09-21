# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: locals in Hinckley and the surrounding area, mostly in their twenties to forties, on a phone, deciding tonight or this week what to do and whether to book a table. They arrive from social links or search, want to know what's on and when doors open, and either book in a minute or plan to walk in.

Secondary, confirmed:
- Bands and solo artists looking for a gig, applying to play the stage through the public band form.
- Groups and organisers enquiring about private hire.
- Staff on the admin portal (`/dashboard`, `/event-bookings`, `/event-setups`, `/settings`) running bookings, the schedule, tables, the quiz, sales and content, often on a phone behind the bar.

## Product Purpose

The public site is the front door for Don Fenticas, a bar and live music venue on Regent Street, Hinckley. It shows the schedule, takes bookings and applications, and gives the venue a home that is not a social feed. Success is a visitor finding tonight's event and booking or turning up, a band applying to play, and staff running the night from one tool.

## Positioning

Live music events are the headline. Don Fenticas is a live-music-first venue with its own stage that local bands can apply to play, backed by a weekly programme of nights (quiz, Music Bingo, Market Night, karaoke) that keep the room busy between gigs. The schedule is the content priority on every public surface.

## Operating Context

- Public visitors use the site on phones, often in the evening, sometimes in the venue on a poor connection. Market Night is installable to the home screen and pushes drink-price alerts.
- Staff use the admin portal on phones and laptops during service; details open in sheets rather than new pages.
- Bookings feed table allocation and a floor plan; confirmed bookings and band or private-hire confirmations place events on the schedule.
- Square handles paid bookings (Music Bingo, ticketed events) and nightly sales sync. Resend sends booking and outcome emails. Google Gemini generates quiz questions behind a provider registry.
- Deployed on Vercel, data in Supabase.

## Capabilities and Constraints

Public routes: `/` (schedule-led home), `/whats-on`, `/book` hub with `/book/quiz` (free, waitlist when full), `/book/bingo` (paid up front), `/book/event/[id]` (ticketed), `/book/band` (stage application), `/book/private` (private hire enquiry), `/book/group`, `/manage-booking/[id]` (self-service view, modify, cancel), `/menu`, `/gallery`, `/contact`, `/market` and `/market/board`.

Admin routes cover bookings by type, unpaid bookings, events and event types, quiz config, generator, history and leaderboards, and settings for company, venue, tables, floor plan, customers, teams, users, menu, specials, merchandise, promo content, gallery, music acts, price rounds, market, rivals, email templates, AI and website.

Constraints future work must keep:
- Two visual surfaces that never mix: dark olive and gold public site, warm cream admin portal. Rules live in `STYLE_GUIDE.md` and `CLAUDE.md`.
- Fonts are fixed: Anton for public display, Archivo for interface text, Archivo Black for public emphasis only. Changing them needs explicit permission.
- No new npm dependencies without asking. Animation stays on `tw-animate-css`. Tailwind only, no inline style props except CSS custom properties.
- Touch targets at least 44px, every icon-only control labelled, every form field labelled.
- The bar's name and logo appear once per page, in the sticky nav; the home hero is the only exception. Every page H1 is that page's purpose.
- Merchandise is display only, no checkout.
- Events come only from the admin event sheet, a band reaching `booked`, or private hire reaching `confirmed`.

Terminology: "What's On" for the schedule, "Book" for the hub, "Market Night" for the live-priced drinks night, "the stage" for band bookings, "private hire" for venue hire.

Undecided: whether ticketed events beyond Music Bingo run regularly; whether karaoke has its own booking flow.

## Brand Commitments

- Name: Don Fenticas. Wordmark at `public/CompanyName.png`, mark at `public/short_logo_transparent.png` and `public/df-mark.jpg`.
- Voice: short, confident, plain. Sentence case in interface text; poster-style uppercase reserved for public display headings and eyebrows. No emojis in production UI.
- Public palette: deep olive canvas, warm cream ink, gold accent, with burgundy and a neon accent as secondary. Admin palette: cream canvas, olive primary, gold only for focus and brand details.
- Real photography over illustration on the public site.

## Evidence on Hand

- Venue and event photos and videos in the Supabase `gallery` bucket, managed from Settings → Gallery. Poster images per event and event subtype.
- A small set of static images in `public/` (backdrop, quiz-night artwork with the Papa John's tie-in, stock crowd photo).
- Live schedule, specials, merchandise and promo content from the database.
- No customer testimonials, reviews, press quotes, awards or attendance figures on hand. Do not fabricate any. Leave social-proof slots out until real material is added here.

## Product Principles

1. The schedule leads. Tonight's event is the first thing a visitor sees and the thing every public page points back to.
2. Book in a minute on a phone. Every public action is completable one-handed with no account.
3. Real over rendered. Photos of the actual room and acts beat illustration, stock or generated imagery.
4. Staff run the night from one screen. Admin favours density, sheets and predictable placement over expression.
5. Two surfaces, one venue. Public and admin look different on purpose, but both carry the same name, mark and gold.

## Accessibility & Inclusion

WCAG 2.1 AA as the working target: 4.5:1 text contrast on both surfaces, 44px touch targets, visible focus rings, labelled controls and form fields, reduced-motion respected for the scroll reveals and marquee tickers.
