# PORTING NOTES - "After Dark" home redesign → source code

Hand this file to Claude Code (VS Code) to port the **styling & colour scheme** of the
mockup into the real Next.js app. The mockup is a prototype (CDN React + inline styles);
this doc translates its visual system into the repo's Tailwind v4 vocabulary.

Scope of this doc: **colours, type, and the surface/accent theming only.** Layout and
interaction porting is component-by-component and out of scope here.

---

## 0. Verified against your repo (read this first)

Two things were confirmed by reading the actual source:

- **The After Dark scaffolding already exists.** `globals.css` already has the
  animations (`ad-marquee`, `ad-ping`, `ad-blink`, `ad-rise`, `ad-row`, `ad-kind`,
  `ad-stub-perf`) and `page.tsx` has the full section structure. So this port is the
  **palette + type delta only** - not a rebuild.
- **Token-name collision avoided.** Your `:root` already uses `--accent` / `--background`
  for the **admin** shadcn theme. The public tokens below are namespaced
  (`--canvas`, `--ink`, `--gold`, …) so they never touch admin styling.

**Ready-to-paste files are in `port/`:**
- `port/layout.tsx` - drop-in replacement for `src/app/layout.tsx` (wires Anton/Archivo/
  Archivo Black, sets `data-surface="dark"`, makes Archivo the default UI font).
- `port/globals-after-dark.css` - the token + `@theme` block to merge into `globals.css`,
  with the one-line background change (`#1a2008` → `#14180a`) documented at the top.

**The actual deltas to apply:** (1) background `#1a2008` → `#14180a`; (2) body text →
warm cream `#FFF4CC` / muted `#b4b294`; (3) add the three fonts. The gold accent
`#FDCC4B` is unchanged.

---

## 1. Colour scheme (the source of truth)

The mockup themes everything off CSS variables that flip between a **Dark** and **Light**
surface, plus a single swappable **accent**. Default = Dark surface, accent `#FDCC4B`.

### Dark surface (default)
| Token      | Value                  | Role                                   |
|------------|------------------------|----------------------------------------|
| `--bg`     | `#14180a`              | page background (deep olive-black)      |
| `--bg2`    | `#1b210f`              | card / panel background                 |
| `--ink`    | `#FFF4CC`              | primary text (warm cream)               |
| `--ink2`   | `#b4b294`              | secondary / muted text                  |
| `--line`   | `rgba(255,255,255,.10)`| hairline borders                        |

### Light surface
| Token      | Value                  |
|------------|------------------------|
| `--bg`     | `#efe7d0`              |
| `--bg2`    | `#fbf6e7`              |
| `--ink`    | `#20240f`              |
| `--ink2`   | `#5f5d44`              |
| `--line`   | `rgba(0,0,0,.13)`      |

### Accent + fixed brand colours (same in both surfaces)
| Token        | Value      | Role                                                    |
|--------------|------------|---------------------------------------------------------|
| `--accent`   | `#FDCC4B`  | primary gold - CTAs, eyebrows, prices, active states     |
| (on-accent)  | `#1a2008`  | text/icon colour placed ON the accent (dark olive)       |
| `--neon`     | `#FF6B35`  | "on tonight" / live flags, urgency                       |
| `--burgundy` | `#7A1F1F`  | ambient background glow only                             |

**Accent options** offered in the mockup's tweak panel (use as your accent palette):
`#FDCC4B` (gold), `#FF6B35` (orange), `#E0483C` (red), `#38E1C4` (teal), `#FF5D9E` (pink).

> Note: the repo's current home (`src/app/page.tsx`) already uses `#1a2008` and `#FDCC4B`.
> After Dark deepens the background to `#14180a` and warms the text to `#FFF4CC` - that's
> the main colour shift to apply.

---

## 2. Typography

Three families, all Google Fonts (already web-safe to add):

| Token       | Family          | Used for                                              |
|-------------|-----------------|-------------------------------------------------------|
| `--display` | **Anton**       | huge display / section titles / ticker / date numbers |
| `--black`   | **Archivo Black** | card & event titles (uppercase, heavy)             |
| `--ui`      | **Archivo**     | body, labels, buttons, eyebrows                       |

Body base: `font-family: "Archivo"`, antialiased. Eyebrows/labels are
`uppercase`, `font-weight:800`, `letter-spacing: .12em–.2em`. Display titles use
tight line-height (`.92–1`) and slight positive tracking (`.01em`).

Add to the app via `next/font/google` (Anton, "Archivo Black" → Archivo 900, Archivo 400/500/700/800).

---

## 3. How to express this in the repo (Tailwind v4)

The repo is Tailwind v4 with theme tokens in `src/app/globals.css`. Port the palette as
CSS variables under a theme block, then reference them. Two clean options:

**Option A - CSS variables + `data-surface` (closest to the mockup, recommended).**
In `globals.css`:
```css
:root,
[data-surface="dark"] {
  --bg: #14180a; --bg2: #1b210f;
  --ink: #fff4cc; --ink2: #b4b294;
  --line: rgb(255 255 255 / .10);
  --accent: #fdcc4b; --on-accent: #1a2008;
  --neon: #ff6b35; --burgundy: #7a1f1f;
}
[data-surface="light"] {
  --bg: #efe7d0; --bg2: #fbf6e7;
  --ink: #20240f; --ink2: #5f5d44;
  --line: rgb(0 0 0 / .13);
}
@theme inline {            /* expose to Tailwind utilities */
  --color-bg: var(--bg);
  --color-bg2: var(--bg2);
  --color-ink: var(--ink);
  --color-ink2: var(--ink2);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --color-neon: var(--neon);
}
```
Then in components: `bg-bg`, `bg-bg2`, `text-ink`, `text-ink2`, `border-line`,
`bg-accent text-on-accent`, etc. Set `data-surface="dark"` on `<html>` (or `<body>`).
Surface swap = flip that one attribute.

**Option B - Tailwind arbitrary values only (fastest, no theme edits).**
Replace the current literals directly: `bg-[#1a2008]` → `bg-[#14180a]`,
`text-stone-300` → `text-[#FFF4CC]` / `text-[#b4b294]`, keep `#FDCC4B` for accent.
Less reusable, but a minimal diff if you only want the colour refresh.

Prefer **Option A** - it makes the light/dark surface swap and accent swap trivial and
keeps colours out of the markup.

---

## 4. Mapping current classes → After Dark

| Current (`page.tsx` etc.)        | After Dark equivalent                         |
|----------------------------------|-----------------------------------------------|
| `bg-[#1a2008]`                   | `bg-canvas`  (`#14180a`)                       |
| `text-stone-300`                 | `text-ink-2` (`#b4b294`)                       |
| white body text                  | `text-ink` (`#FFF4CC`)                         |
| `bg-white/5`, `bg-white/15`      | `bg-canvas-2` (`#1b210f`)                      |
| `border-white/10`, `/20`         | `border-hairline`                             |
| `text-[#FDCC4B]` accents         | `text-gold` (value unchanged)                 |
| accent pills / buttons           | `bg-gold text-on-gold` (`#1a2008` text)       |
| "on tonight" / live badges       | `text-neon` (`#FF6B35`)                        |
| `font-black` titles              | unchanged - now renders Archivo at weight 900 |
| big section titles               | `font-[family-name:var(--font-display)]` (Anton) |

> The token names (`canvas`/`ink`/`gold`) intentionally differ from the names in older
> drafts of this doc - they avoid the admin `--accent` collision. Use these.

---

## 4b. Ready-to-paste Claude Code prompt

Open `bar-app` in VS Code with Claude Code and paste:

> Read `PORTING-NOTES.md`. Apply the "After Dark" palette + type port:
> 1. Replace `src/app/layout.tsx` with the contents of `port/layout.tsx`.
> 2. Merge `port/globals-after-dark.css` into `src/app/globals.css` (change the
>    `html, body` background `#1a2008` → `#14180a`, and paste the token + `@theme`
>    blocks after the existing admin `@theme inline` block).
> 3. Across the public components (`src/app/page.tsx`, `home-hero.tsx`,
>    `marquee-ticker.tsx`, `highlighted-events.tsx`, `editorial/event-card.tsx`,
>    `specials-section.tsx`, `special-detail-modal.tsx`, `gallery-peek.tsx`,
>    `find-us.tsx`, `public-nav.tsx`) apply the find/replace table in section 4 -
>    swap literal surface/text colours for the new tokens. Leave the gold `#FDCC4B`
>    accent and all `ad-*` animation classes as-is.
> Do not change component props, data shapes, or Supabase queries. Follow
> `STYLE_GUIDE.md`. Then run `npm run dev` and verify the home page at 375px and
> desktop.

---

## 5. Files to touch (styling only)

- `src/app/globals.css` - add the palette + `@theme` block + register the 3 fonts.
- `src/app/layout.tsx` - load fonts via `next/font/google`; set `data-surface="dark"`.
- `src/app/page.tsx` - swap the literal hexes/stone classes for the tokens above.
- Leaf components, same swap: `home-hero.tsx`, `marquee-ticker.tsx`,
  `highlighted-events.tsx`, `editorial/event-card.tsx`, `specials-section.tsx`,
  `special-detail-modal.tsx`, `gallery-peek.tsx`, `find-us.tsx`, `public-nav.tsx`.

Do **not** change component props, data shapes, or the Supabase queries - this is a
pure visual reskin.

---

## 6. Quick checklist for Claude Code

1. Add palette + `@theme` tokens + fonts in `globals.css` / `layout.tsx`.
2. Set `data-surface="dark"` on `<html>`.
3. Find/replace literal colours → tokens across `page.tsx` + the leaf components.
4. Apply Anton to section titles, Archivo Black to card titles, Archivo to body.
5. Run dev, verify at 375px (mobile) and desktop, light + dark surface.
6. Sanity-check contrast: `--ink` on `--bg`, and `--on-accent` (#1a2008) on `--accent`.
