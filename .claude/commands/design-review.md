---
description: Review a page at phone and desktop width with screenshots, then run the design critique and accessibility audit
argument-hint: <route, e.g. /book/quiz>
---

Run a design review of the route `$ARGUMENTS` (default to `/` if empty). Do not change any code during this command; the deliverable is the review.

## 1. Open the page

- Start the `dev` server with `preview_start` (name `dev`) and navigate to the route.
- Decide which surface it is from the route: public (`/`, `/book/*`, `/menu`, `/gallery`, `/contact`, `/manage-booking/*`, `/market`) or admin (`/dashboard`, `/event-bookings/*`, `/event-setups/*`, `/settings/*`). Admin routes need a signed-in session; if the page redirects to `/login`, say so and stop.

## 2. Capture

- `resize_window` to the `mobile` preset, reload, wait for images, take a full screenshot. Scroll through the page and screenshot each viewport-height section so nothing below the fold is missed.
- `resize_window` to `desktop`, reload, screenshot the same sections.
- `read_console_messages` with `onlyErrors` and `read_network_requests` for failed requests. Note anything found.
- Reset the viewport with the `desktop` preset when done.

## 3. Load the rules

- Read the "Two distinct UI surfaces", "Visual standards" and "Design references" sections of `CLAUDE.md`, and the matching surface section of `STYLE_GUIDE.md`.
- Load the `web-design-guidelines` skill and the `impeccable` skill.
- For a public route also load `frontend-design`, `tailwindcss-mobile-first`, `public-type-scale` and `public-components`.

## 4. Review

Read the source for the route (the `page.tsx` and the components it renders) and assess it against the screenshots. Cover, in this order:

1. **Phone layout** - anything cropped, overflowing horizontally, stacked awkwardly, touch targets under 44px, fixed elements ignoring safe-area insets, hover-only interactions.
2. **Typography** - on public routes run the console check from the `public-type-scale` skill. Flag any text under 11px, any `text-[Npx]` on text that has a role, `font-black` or wide tracking on labels, and uppercase outside stamps. Body should read at 14px on a phone and 16px on desktop.
3. **Hierarchy and composition** - does the eye land where it should, is there one clear primary action, does the layout read as templated (centred hero plus equal cards, uniform grid, filler sections).
4. **Consistency of repeated roles** - list every section header action, primary CTA, pill and card on the page and confirm each role renders through its one component (`SectionAction`, `ArrowCta`, `BookingButton`, `text-pill`). Two elements with the same job but a different border, height, colour, weight or alignment is a finding, even if each looks fine alone. Grep the route's components for `rounded-full border border-` and `inline-flex .* items-center .* rounded-` to catch hand-rolled buttons, and compare their computed height and padding in the browser.
5. **Surface fidelity** - public pages on the olive/gold gritty aesthetic with real photography; admin pages on the admin palette, Archivo scale, one solid olive button per view, semantic colour only for meaning.
6. **Accessibility** - the `web-design-guidelines` audit: labels, accessible names on icon buttons, focus visibility, contrast, heading order, form errors.
7. **Runtime health** - console errors, failed requests, layout shift on load, images without dimensions.

## 5. Report

Write the findings back in chat, most important first, as a short list. Each finding names the file and line, what is wrong, and the specific fix (a class change, a restructure, a copy change). Attach the phone and desktop screenshots that show the problem.

Close with a three-line summary: what is strong, the one change with the biggest payoff, and whether the page is ready to ship as is.

Do not propose new fonts, new npm packages, or theme changes; if a skill suggests one, list it under a separate "Needs a decision" heading instead of as a fix.
