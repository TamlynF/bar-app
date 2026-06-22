# design-sync notes — bar-app

## Scope of this sync
This is a **proof-of-concept** sync, not a full design-system import. Only
`Button` and `Input` from `src/components/ui/` are synced. The project is
**"Don Fenticas (POC)"** (`ba6ad8ad-ac14-4122-84b4-6611748705ed`).

## Why this repo is not a normal package-shape DS
`bar-app` is a Next.js 16 app, not a published component library — no Storybook,
no `dist/`, no exported package. To make the converter work we build a small
**self-contained mini-package** instead of pointing it at the repo:

- `.design-sync/poc-src/{button,input,index}.tsx` — copies of the two components
  (durable, committed).
- esbuild bundles `poc-src/index.ts` → `node_modules/bar-app-ds/dist/index.js`
  (react/react-dom/jsx external; clsx + tailwind-merge + cva + radix Slot bundled in).
- `node_modules/bar-app-ds/dist/index.d.ts` — hand-written prop contracts for
  `Button`/`Input` (the converter extracts `<Name>Props` from these).
- `node_modules/bar-app-ds/styles.css` — compiled Tailwind (see below).
- Build command:
  ```
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules ./node_modules --entry ./node_modules/bar-app-ds/dist/index.js \
    --out ./ds-bundle
  ```
  `node_modules/bar-app-ds/` is NOT committed (it's under node_modules) — recreate
  it on a fresh clone with the esbuild + d.ts + css steps above before building.

## CRITICAL FINDING — no semantic token layer
The shadcn primitives reference `bg-primary`, `text-primary-foreground`,
`bg-secondary`, `bg-destructive`, `border-input`, `ring-ring`, etc., but the app
**defines none of those theme variables** — there is no `@theme`/`:root` token
block anywhere in `src/app/globals.css`. Consequence:
- `Input` renders correctly (border/radius/padding don't need colour tokens).
- `Button` renders **structurally only** — sizing + `outline` border apply, but
  colour variants have no fill and render as plain text. `destructive` is
  white-on-nothing (invisible) — that cell was dropped from the Button preview.
This is the app's real behaviour, not a sync bug. A real DS import would first add
a proper token layer (or sync the on-brand composites + full `globals.css`).

## Tailwind CSS compile
`styles.css` is compiled via `@tailwindcss/cli` (installed into `.ds-sync`).
Output **directly into the mini-package** (under `node_modules`, so the editor's
Tailwind/CSS linter doesn't flag the generated output — don't leave a compiled
`.css` under `.design-sync/`, it produces a noisy `propertyIgnoredDueToDisplay`
hint on Tailwind's own preflight):
```
node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs \
  -i .design-sync/.cache/_tw-input.css \
  -o node_modules/bar-app-ds/styles.css
```
Tailwind v4 **auto-detects content from the repo root** in addition to the
`@source` globs, so the compiled CSS pulls in app-wide utilities. That is why
`package-validate` prints a non-blocking `[TOKENS_MISSING]` for app runtime vars
(`--spotify-bg`, `--badge-color`, `--chip-c`, `--ev-theme`, radix popover vars).
These are set at runtime by the app and are irrelevant to Button/Input — **leave
as a known warn, do not chase.**

## Things that DON'T work / dead ends
- **Junction trick (`node_modules/bar-app` → repo root): DO NOT USE.** It makes the
  converter treat the whole repo as the package; ts-morph then parses all of
  Next.js + app types and the build **OOMs** (~5 min, heap exhaustion). The
  mini-package approach above exists specifically to avoid this.

## Upload / project quirks
- The newly-created design-system project came **pre-seeded** by claude.ai/design
  with a sample app scaffold (`app/*.jsx`, `assets/DonFenticas-*.jpg`,
  `Canvas.dc.html`, `support.js`). The sync uses the **atomic path** (non-empty
  target) and deletes that scaffold.
- The project's own generator keeps re-adding sample files under `app/` (e.g.
  `app/DirectionGigPoster.jsx`) asynchronously. These are harmless to the DS pane
  (cards build from `components/` + `_ds_bundle.js`). Don't loop trying to keep
  `app/` empty — delete once if you want it clean, then ignore.

## Known render warns (checked, legitimate)
- `[TOKENS_MISSING]` — app runtime vars, see Tailwind compile section. Expected.

## Re-sync risks (what can go stale)
- `node_modules/bar-app-ds/` is gitignored-by-location — a fresh clone has no
  mini-package; rebuild it (esbuild + d.ts + css) before re-running the converter.
- If `src/components/ui/{button,input}.tsx` change upstream, the `poc-src/` copies
  and the hand-written `.d.ts` will drift — re-copy and re-bundle.
- `.d.ts` props are hand-written, not extracted from source — verify against the
  real component if the API changes.
- The whole premise (plain primitives) flips the day the app adds a token layer;
  at that point re-compile the CSS and the buttons will gain colour.
