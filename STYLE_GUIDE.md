# STYLE_GUIDE.md - Don Fenticas Design Language

This file is the visual and interaction source of truth. Read it before touching any UI. It complements `CLAUDE.md` (which covers architecture and tech).

The app has **two surfaces** and they look intentionally different. Get the surface right first, then everything else follows.

---

## Page identity rules - NON-NEGOTIABLE

**The bar's name and logo appear exactly once per page: in the sticky top nav.**

Sub-pages (menu, gallery, contact, booking pages, manage-booking, login flows) **must not** repeat the logo as a hero word, hero image, or oversized brand statement above the page content. The user has just read the bar's name in the nav 40px above; reading it again at 5x the size in a giant heading is redundancy, not branding.

The H1 of every page is the **purpose of that page**, not the bar's name:

| Page | H1 |
|---|---|
| `/` (home) | `THE SCHEDULE` (or `WHAT'S ON`) - the schedule is the content priority |
| `/menu` | `MENU` |
| `/gallery` | `GALLERY` |
| `/contact` | `ABOUT US` or `GET IN TOUCH` |
| `/book` | `BOOK YOUR EXPERIENCE` |
| `/book/quiz` | `BOOK YOUR TABLE` (or quiz-specific) |
| `/manage-booking/[id]` | `YOUR BOOKING` |
| `/login` | `STAFF LOGIN` |

**The home page is the only exception** where the bar's identity gets hero treatment - a single `CompanyName.png` wordmark in the hero, plus the location pill and featured-event CTA. This exception applies to the home page only; all sub-pages still follow the single-logo-in-nav rule.

If you find yourself adding `<Image src="/CompanyName.png" ... className="w-[80%]" />` to a page wrapper, **stop**. You're recreating the redundancy this rule exists to prevent - this applies to sub-pages; the home hero is the one sanctioned use.

### What to lead each page with instead

Below the sticky nav, the top of every page should look like:

```
[Optional back link - "← Back" or "← Home"]
[Eyebrow pill - small, coloured, uppercase, tracked (e.g. "DRINKS & SNACKS")]
[H1 - the page's purpose, in display weight, uppercase, tracking-tighter]
[One-line subtitle - stone-400, regular weight]
[Content starts]
```

Keep the top of each page to ~120-150px before content begins. No more.

---

## Navigation patterns - when to use which

The decision is not "modern apps use bottom nav" or "hamburgers are bad" - it's **what's the user actually doing on this surface, and how many destinations are there?**

### Public site → visible top nav

Visitors arrive to find info (events, menu) or take an action (book, call). They are *not* cycling between sections like an app user. A visible top nav with the primary destinations + a primary CTA is the correct pattern.

The nav spans the **full screen width** at every breakpoint - no `max-w-*` container. Gutters are `px-4 sm:px-6 lg:px-10`, matching the full-bleed sections on the home page.

**Required composition - desktop (`sm:` and up):**
- Logo on the left (small, links home)
- Primary destinations (`What's On`, `Menu`, `Gallery`, `Contact`) - text links, centred
- `Staff Login` icon, then the gold `Book` CTA pill, far right
- No hamburger

**Required composition - mobile (below `sm:`):**
- Logo on the left, hamburger on the right - **nothing else in the bar**
- The drawer opens with the gold `Book` CTA as a full-width pill at the top, then `Home`, the primary destinations, and `Staff Login` last

Mobile deliberately trades the always-visible Book pill for a clean two-element bar (the Bongo's Bingo pattern). Book stays the first and most prominent thing in the drawer, so it is never more than two taps away, and the home hero carries its own Book CTA above the fold.

**The rule for what goes where:** on desktop, primary = visible, secondary = nowhere else to hide, so everything is inline. On mobile everything except the logo lives in the drawer, ordered by intent: CTA first, destinations next, `Staff Login` last (it's used by 2 people, not customers).

**Nav link type sizing:** `text-xs` (12px) `font-bold uppercase tracking-wide` from `sm:`, stepping to `text-sm` (14px) at `lg:` where the full-width bar has room. Drawer links are `text-sm`. Don't go below `text-xs` in the bar or below `10px` anywhere.

**When NOT to use a bottom nav on public pages:** never (unless the product becomes a full PWA with persistent in-app sections, which it currently isn't). A bottom nav competes with the Book CTA.

### Admin portal → sidebar + mobile bottom nav

Staff *are* cycling between Dashboard / Bookings / Events / Settings constantly during a shift. They need persistent, predictable navigation.

- **Desktop (≥sm):** fixed left sidebar, ~256px wide, collapsible sub-sections under Bookings / Events / Settings
- **Mobile (<sm):** persistent bottom nav with 4 items (Dashboard, Bookings, Events, Settings) - the four top-level destinations only. Sub-sections accessed via the page itself.

Both surfaces use the **dark olive nav chrome** (`nav-*` tokens), not the cream admin palette - see "Admin navigation chrome" under Surface 2.

This pattern is already implemented in `src/app/(private)/private-layout-client.tsx`. Don't duplicate it; reuse it.

---

## Surface 1 - Public site (the gritty bar)

Routes: `/`, `/book/*`, `/menu`, `/gallery`, `/contact`, `/manage-booking/*`, `/login`, `/accept-invite`, `/update-password`

The vibe is **a real bar, after dark**. Dim, warm, confident, a bit raucous. Not corporate. Not "luxury restaurant". Not Instagram-clean. Think bar signage, gig posters, neon over a wood-panelled wall.

### Palette

```
Base / canvas:
--bar-night       #1a2008    /* deepest background, almost-black olive */
--bar-olive       #26300D    /* primary brand background, established */
--bar-olive-soft  #2a3612    /* used for menu page frame */

Accents:
--bar-gold        #FDCC4B    /* hero accent, CTAs, headlines */
--bar-gold-warm   #e5b843    /* gold hover state */
--bar-burgundy    #7A1F1F    /* deep red, for "Specials" and urgency */
--bar-neon        #FF6B35    /* orange-red neon glow, sparingly for "tonight" / live */

Type on dark:
--bar-cream       #FFF4CC    /* main body text on dark, slightly warm */
--bar-stone-300   #d6d3d1    /* secondary text */
--bar-stone-500   #78716c    /* tertiary / metadata */
--bar-stone-700   #44403c    /* very low-contrast dividers */
```

**Rules:**
- The default page background is `#1a2008` (deepest). `#26300D` is reserved for cards/sections that should sit *up* from the canvas.
- Gold (`#FDCC4B`) is the hero accent - use it for the brand in the nav, primary CTAs, and at most one or two focal points per screen.
- Burgundy (`#7A1F1F`) flags "Specials" and offers - drink deals, last-call urgency.
- Neon orange (`#FF6B35`) is for "live now" / "tonight" / "selling fast" - used sparingly, with a subtle glow.

### Typography on the public site

- Display headings (page H1s): `font-black uppercase tracking-tighter` - they should feel like signage.
- Eyebrows/section labels: `text-[10px] font-black uppercase tracking-[0.2em]` to `tracking-widest`.
- Body: `text-sm font-medium` for descriptions, `text-xs` for metadata.
- Numerals always `tabular-nums` when in lists/tables.
- Never centre long body copy. Centre headlines and short taglines only.

### Texture & atmosphere

- **Soft glow blurs** behind hero content using gold and burgundy with `blur-[120px]` at low opacity (`/5` to `/10`).
- **Card surfaces** lift off the canvas with `bg-white/[0.04]` and `border border-white/[0.08]`. Hover: `bg-white/[0.07]`.
- **Dividers** between sections: thin lines, `bg-stone-800/50` for subtle, `bg-[#FDCC4B]/20` for emphasis.
- **Drop shadows** on hero accents: `drop-shadow-[0_8px_40px_rgba(253,204,75,0.15)]` - gives a "lit from above" glow.

### Mobile-first rules (375px width is the design target)

- The home page must show "what's on tonight / this week" above the fold without scrolling past the hero.
- Nav stays ≤ 5 items. On mobile the bar is logo + hamburger only; everything else is in the drawer.
- All tappable elements ≥ 44px on the shorter side (Tailwind `h-11` or `h-12`).
- Horizontal-scroll rows (events, gallery) need `snap-x snap-mandatory` and `no-scrollbar`.
- Sticky elements: only one at a time. Either the top nav OR a bottom CTA bar - never both.

### Section anatomy on the public site

Every section follows the same skeleton:

```
[eyebrow pill - small, coloured, uppercase, tracked]
[H2 headline - display, uppercase, tight]
[Optional subtitle - stone-500, regular weight]
[Content - cards / list / grid]
```

Sections are separated by `py-10 sm:py-16` (generous breathing room).

---

## Surface 2 - Admin portal (the working tool)

Routes: `/dashboard`, `/event-bookings/*`, `/event-setups/*`, `/settings/*`

The vibe is **a working notebook**. Cream paper, dark olive ink and accents, soft borders. Information-dense, but never noisy.

### Palette

| Role | Colour | Utility | Usage |
|---|---|---|---|
| App background | `#F4F1E8` | `bg-admin-bg` | Main page canvas |
| Card / sheet | `#FFFEFA` | `bg-admin-card` | Cards, dialogs, forms |
| Subtle surface | `#ECE9DE` | `bg-admin-surface` | Table headers, grouped sections, hover states |
| Border | `#D8D5C8` | `border-admin-line` | Dividers and input borders |
| Main text | `#20231A` | `text-admin-ink` | Headings and body text |
| Muted text | `#5E6654` | `text-admin-muted` | Labels, descriptions, metadata |
| Primary olive | `#34451F` | `bg-admin-primary` | Buttons, selected navigation, toggles |
| Primary hover | `#283719` | `bg-admin-primary-hover` | Button hover / pressed state |
| Primary soft | `#E5EBD8` | `bg-admin-primary-soft` | Selected rows, light badges |
| Brand gold | `#D7A928` | `bg-admin-gold` | Focus rings, active indicator, occasional highlights |

All of these are real Tailwind colours defined in `globals.css` and re-exported through `@theme inline`. **Prefer the utility over the hex in new code** (`bg-admin-card`, not `bg-[#FFFEFA]`); opacity modifiers work as normal. Existing code still carries raw hex from the migration off the old espresso/cream palette - both resolve to the same value, so convert opportunistically rather than in a sweep.

The old espresso palette (`#5C4033` primary, `#F7F4EA` canvas, `#E6DFC8` border, `#1F1F1A` ink, `#5F624F` muted) is **retired on admin surfaces**. Those hexes still appear on public pages, where they are unrelated - don't "fix" them there.

#### Admin navigation chrome - dark olive

The sidebar and mobile bottom nav are **deliberately not** on the cream palette. Dark olive chrome separates navigation from the working area and nods to the public site without copying its "After Dark" look.

```
--nav-bg          #263019    /* sidebar + bottom-nav background */
--nav-ink         #DDE2D1    /* normal and selected label text  */
--nav-muted       #AEB69D    /* idle icons, secondary labels    */
--nav-selected    #34451F    /* selected item fill              */
--nav-indicator   #D7A928    /* thin gold active marker         */
--nav-line        #AEB69D38  /* dividers, nested rails (22%)    */
```

These are real Tailwind colours, defined in `globals.css` and re-exported through `@theme inline`. **Use the utility, not the hex**: `bg-nav-bg`, `text-nav-ink`, `text-nav-muted`, `bg-nav-selected`, `border-nav-indicator`, `border-nav-line`. Opacity modifiers work as normal (`text-nav-muted/70`).

Rules:
- **Scope is navigation chrome only.** Never put `nav-*` on a card, sheet, form or any content surface - admin content stays on the cream/olive content palette above. Note `--nav-selected` and `--admin-primary` are the same olive (`#34451F`) by design: it's one primary, used as a fill in nav and as the solid button colour in content.
- **Selected item = fill + indicator, never gold fill.** A selected item gets `bg-nav-selected` plus a thin `border-l-2 border-nav-indicator`. Filling the whole item with gold makes it visually dominant and fights the working area for attention.
- **Give inactive items `border-l-2 border-transparent`** so the indicator doesn't shift the row by 2px when it becomes active.
- **Icons are muted when idle, ink when active** - `text-nav-muted` → `text-nav-ink`.
- On the mobile bottom nav there's no left edge to mark, so the active item gets the `bg-nav-selected` pill plus the gold dot underneath (`bg-nav-indicator`).
- The top header bar stays white/cream - it belongs to the working area, not the nav.

#### Semantic colours

Reserved for **meaning**, never decoration:

| Meaning | Strong (text, icon, dot) | Background |
|---|---|---|
| Success / confirmed | `#22613F` `text-admin-success` | `#E7F3EC` `bg-admin-success-bg` |
| Warning / pending | `#9A5B00` `text-admin-warning` | `#FFF4D6` `bg-admin-warning-bg` |
| Error / cancelled | `#B33A32` `text-admin-error` | `#FDECEA` `bg-admin-error-bg` |
| Information | `#28608F` `text-admin-info` | `#EAF2F8` `bg-admin-info-bg` |

**Don't give ordinary categories their own blue / purple / orange / red backgrounds.** A colour on an admin surface should mean "this needs attention" or "this succeeded" - not "this is a different kind of thing". Ordinary groupings use the neutral surface (`bg-admin-surface`) or the primary-soft tint (`bg-admin-primary-soft`). The only exception is the user-selected event-type identity swatches in `src/lib/event-type-colors.ts`, which staff choose deliberately per category.

#### Main content

- Cream canvas (`bg-admin-bg`) behind the page.
- White cards (`bg-admin-card`) with a **single-pixel** border (`border border-admin-line`).
- Shadows stay very restrained - `shadow-sm` at most. No `shadow-lg` on ordinary cards.
- Table headings, grouped sections and hover states use the soft neutral surface (`bg-admin-surface`).

### Typography on admin

**Archivo only. Never Archivo Black or Anton on an admin screen** - those stay on public-facing branding. The admin surface earns hierarchy from *size and weight*, not from shouting.

| Element | Mobile | Desktop | Weight |
|---|---:|---:|---:|
| Page title | 18px | 20-24px | 700 `font-bold` |
| Breadcrumb | 12px | 13px | 500 `font-medium` |
| Page description | 14px | 14px | 400 `font-normal` |
| Section heading | 14px | 15-16px | 700 `font-bold` |
| Card title | 16px | 16-18px | 700 `font-bold` |
| Body | 14px | 14px | 400-500 |
| Secondary information | 12-13px | 13px | 500 `font-medium` |
| Input text | 14-16px | 14px | 400 |
| Button / tab | 13-14px | 13-14px | 600 `font-semibold` |
| Badge / status | 11-12px | 11-12px | 600 `font-semibold` |
| Sidebar top-level | - | 13-14px | 600 `font-semibold` |
| Sidebar child | - | 12-13px | 500 `font-medium` |
| Mobile nav label | 10-11px | - | 600 `font-semibold` |
| Dashboard value | 24-32px | 28-36px | 700-800 |

**Never below 11px for anything that carries meaning.** 9px and 10px metadata is unreadable for a manager glancing at a phone behind the bar.

Line height: body ~1.5 (`leading-normal`), metadata ~1.4 (`leading-snug`), headings ~1.2-1.3 (`leading-tight`).

#### Sentence case, not uppercase

Ordinary interface text is **sentence case**: page titles, section headings, navigation, buttons, field labels, descriptions. "Add event", not "ADD EVENT". "Event categories", not "EVENT CATEGORIES".

Uppercase is reserved for genuinely compact labels where the word *is* the whole meaning - status pills (`Confirmed`, `Pending`), date abbreviations (`AUG`), and small chart/table axis labels. Even there, prefer `text-[11px] font-semibold tracking-wide` over `font-black tracking-widest`.

Tracking: page title `tracking-tight`; card title `tracking-tight` or default; body, navigation and buttons default; small uppercase pills `tracking-wide`. **`tracking-widest` is retired on admin.**

`font-black` is retired on admin - `font-bold` is the heaviest weight used. Keep `tabular-nums` on every numeral in a list, table or KPI.

### Cards & sheets

- Cards: `bg-admin-card border border-admin-line rounded-2xl shadow-sm` - one-pixel border, restrained shadow
- Hover: `hover:border-admin-primary hover:bg-admin-surface transition-all active:scale-[0.98]`
- Sheets: bottom sheet on mobile (`h-[85vh]`), centered on desktop (`sm:rounded-[2rem] sm:bottom-6 sm:w-[560px]`)
- Sticky sheet headers and footers with `bg-white/80 backdrop-blur-md`

### Action buttons (admin)

One accent carries weight: **solid olive means "this writes a record"**. Everything else steps back. Compose layout/sizing (`h-12 rounded-xl …`, or a small `h-7` header variant) around these.

Labels follow the admin type scale above - `text-[13px] font-semibold`, sentence case ("Save changes", not "SAVE CHANGES"). The colour is what distinguishes the actions, not the shouting.

| Action | Treatment |
|---|---|
| **Save / Create / Add / New / Upload** | Solid olive: `bg-[#34451F] hover:bg-[#283719] text-white` |
| **Edit** | Olive outline: `border border-[#34451F] text-[#34451F] hover:bg-[#E5EBD8]` |
| **Cancel / dismiss** | Neutral outline: `border border-[#D8D5C8] text-[#5E6654] hover:bg-[#ECE9DE]` |
| **Delete** | Red (`#B33A32`), and **only behind a confirmation** - never a bare one-tap destructive control |

Rules:
- **One solid olive button per view.** If two things are both solid olive, neither reads as primary. The secondary one becomes an outline.
- **Gold (`#D7A928`) is not a button colour.** It's for focus rings, selection and small brand details only. A gold-filled button competes with the content for attention.
- Don't reintroduce the old amber Edit (`#B45309`) or green Create (`#1B4332`) - both are now olive, distinguished by solid vs outline.
- Destructive confirmation dialogs are the place for red; a red button sitting in a toolbar is not.

---

## Cross-surface rules

### Tailwind class form - canonical over arbitrary
- Use the canonical scale token when a value is on the spacing/size scale: `min-w-50` not `min-w-[200px]`, `gap-2` not `gap-[8px]`, `text-sm` not `text-[14px]`. (`px ÷ 4` = the token.) This is what the IntelliSense `suggestCanonicalClasses` hint flags.
- Bracket values like `text-[10px]`, `tracking-[0.2em]`, and `h-[85vh]` used in this guide are **intentional exceptions** - they have no canonical token (off-grid px, or non-spacing units). Leave them as-is; don't "correct" them. Reserve `[...]` for: no-canonical values, non-spacing units (`vh`/`%`), custom palette hex (`border-[#D8D5C8]`), and dynamic CSS vars.

### Touch targets
- Minimum 44×44px on mobile (`h-11` / `h-12`). `h-9`/`h-10` fine on desktop only.

### Lists, bullets, formatting
- Avoid bullet lists where a card or row layout would work better.
- `tabular-nums` for numbers and dates.
- Truncate long text with `truncate` + `min-w-0` on the flex parent.

### Forms
- Labels above inputs, not floating.
- Inline validation on blur (not every keystroke unless it's a duplicate check).
- One field per row on mobile.
- Native `<input type="date">` and `<input type="time">` - don't reinvent.
- Submit buttons full-width on mobile.

### Loading states
- Skeleton loaders for content, not spinners.
- Spinners (`Loader2` + `animate-spin`) for inline pending states only.
- Server Actions use `useTransition` for pending state.

### Empty states
Always provide one:
- Soft icon at 20-30% opacity
- "No [thing] yet" headline - `font-black uppercase` on public, `text-sm font-semibold` sentence case on admin
- One sentence of helper text
- Optional CTA

### Motion
- Subtle. `transition-colors`, `transition-all duration-300`, `active:scale-[0.98]`.
- Use `tw-animate-css` utilities (`animate-in fade-in slide-in-from-bottom-2 duration-300`) for sheet entrances.
- Page transitions: Next.js defaults.

### Accessibility - non-negotiable
- Keyboard reachable
- Visible focus rings (don't strip without replacing)
- Semantic HTML (`<button>`, `<a>`, `<nav>`)
- `alt=""` for decorative, meaningful alt otherwise
- Labels on every input (visible or `sr-only`) - every form element (`<input>`, `<select>`, `<textarea>`), **including checkboxes/radios**, needs a programmatic label: a `<label htmlFor>`, an `aria-label`, or an `aria-labelledby`. A nearby `<span>` that merely sits next to the input does **not** count. Without one, Edge DevTools fires `axe/forms` ("Form elements must have labels").
- WCAG AA contrast: 4.5:1 body, 3:1 large text
- **Icon-only buttons/links must have discernible text** - a `<button>`/`<a>` whose only child is a Lucide icon (e.g. `<ChevronDown />`, `<Plus />`, `<X />`) needs an `aria-label` or `title` describing the action. Without one, Edge DevTools fires `axe/name-role-value` ("Buttons must have discernible text"). The icon's `className` is not a label. Example: `<button aria-label="Toggle section">`.

### Performance
- Lighthouse mobile 90+ on every public page.
- `next/image` for every image with `sizes` set.
- `next/font` if adding fonts.
- No client-side JS for content that doesn't need interactivity.
- Check `npm run build` bundle size before merging.

---

## Specific patterns already in use - reuse, don't reinvent

| Need | Existing pattern |
|---|---|
| Detail / edit panel (admin) | Bottom-sheet (`SheetContent side="bottom"`), sticky header + footer |
| Confirm destructive action | `useConfirm()` from `@/components/ui/confirm-dialog` |
| Status pill | `statusTheme` in `quiz-bookings/components/booking-list-client.tsx` |
| Event type badge | `badgeClassFromColor()` in `@/lib/event-type-colors` |
| Capacity bar | CSS variable `--bar-width` / `--capacity-width` |
| Quick stat card (admin) | `StatCard` in `dashboard/components/stat-card.tsx` |
| Section label (admin) | `SectionLabel` in `dashboard/components/section-label.tsx` |
| Public-site form input | `bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-4` with icon left, label above |
| Public page wrapper | `<main className="min-h-dvh w-full bg-[#1a2008] ...">` + inline `<style>` to force body bg |
| Public page top nav | See `TopNav` in `src/app/page.tsx` - reuse this component across public sub-pages |

If a pattern doesn't exist yet and you build a new one, build it *consistently* across the surface and add it here.

---

## Anti-patterns - clean up when you touch the file

1. **Hero logo / brand name repetition on sub-pages.** Delete on sight. The nav is the only place the brand appears (see "Page identity rules" above).
2. **Long pages without component extraction.** When you touch one, extract repeated JSX into `components/`.
3. **Inline hex colours scattered through admin.** Long-term these should be CSS variables. For now, don't introduce new shades.
4. **Mixed concerns in `actions.ts`.** Some actions do too much (booking + email + table allocation + revalidation in one function). Split helpers out.
5. **`console.log`s left in production code.** Strip when touching.
6. **`as unknown as` casts on Supabase joins.** Acceptable for now; a typed query helper would be better long-term.

---

## When in doubt

- Public site → "Would this look right on the wall of a bar?"
- Admin site → "Would this look right on a barista's clipboard at the end of a shift?"
- Both → "Could a thumb hit this without zooming?"
- Identity → "Is the bar's name already in the nav? Then it doesn't go on the page too."
