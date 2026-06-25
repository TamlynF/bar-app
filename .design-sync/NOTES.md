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

## RESOLVED (2026-06-22) — the token layer now exists
The earlier sync recorded "no semantic token layer". **That has flipped.**
`src/app/globals.css` now defines a full `:root` block (`--primary` #5C4033 espresso,
`--secondary`/`--border`/`--input` #E6DFC8, `--destructive` #DC2626, `--background`/
`--accent` #F7F4EA cream, etc.) re-exported via `@theme inline` as `--color-*`.
Consequence:
- `Button` variants now render with **real fill** (default = espresso on cream,
  secondary = tan, destructive = red, outline = bordered, ghost = transparent, link).
- The dropped `destructive` cell was **restored** to the Button preview's `Variants`.
- The tokens are the **admin** palette (espresso/cream), so `variant="default"` is an
  admin-surface button. Public surface still overrides colour with explicit hex.
This is the app's real behaviour. conventions.md was rewritten to match.

### How the token layer reaches the compiled CSS (IMPORTANT for re-sync)
Tailwind v4 only emits a colour utility (`bg-primary`) when its `--color-*` token is
registered. The POC's `_tw-input.css` therefore **imports the app's real globals.css**
(`@import "../../src/app/globals.css"`) so the `:root` + `@theme inline` tokens are in
scope — sourcing from globals.css keeps values in sync (no hardcoded drift). globals.css
also sets `html/body` to the **public** dark-olive page bg (#14180a); since Button/Input
are admin-surface primitives, `_tw-input.css` appends `html, body { background-color:
#F7F4EA; }` so preview cards render on the admin **cream** canvas, not dark olive.
If you ever see buttons with no fill again: confirm `_tw-input.css` still imports
globals.css (not the old bare `@import "tailwindcss"`).

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
  (Count drifts with the app: 2026-06-23 driver run listed **15** vars; 2026-06-24
  driver run listed **18** vars — the same radix popover/dropdown +
  `--chip-c`/`--ev-theme`/`--spotify-bg`/`--badge-color`/`--bg` family plus new
  app runtime vars `--fh`/`--cc`/`--spine`. Same nature, not a new kind of warn.)
  **2026-06-25 driver run listed 28 vars** — the "After Dark" public theme
  (commits e865036/000ddb0/301a230/a0ffcdb) added more app runtime vars
  (`--fbd`/`--sub-border`/`--cat-bg` + the radix popover/dropdown family).
  Still app runtime vars, irrelevant to Button/Input (both render 2/2 clean).
  Same nature — leave as a known warn.)
  **2026-06-25 (second run, after refactor commit `4a71b79`) listed 9 vars** —
  the count *dropped* (radix dropdown/popover transform-origin/available-height +
  `--chip-c`/`--ev-theme`/`--spotify-bg`/`--badge-color`/`--bg`). globals.css moved
  again (`4a71b79` "Refactor code structure") so `styles.css` recompiled and
  re-uploaded (`upload` bundle/styling/aux all true, components unchanged, both
  Button/Input carried-forward good, render_churn canary confirmed clean). A drop
  is still the same family — fewer app utilities detected, no new KIND of var.)
- `[FONT_MISSING] "Cambria"` — **benign, accepted (checked 2026-06-23).** Cambria is
  NOT a brand font. It appears only inside Tailwind's default `.font-serif` fallback
  stack (`ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`) emitted into
  the shipped CSS. The validator's font scraper flags it because it isn't in its
  generic-allowlist, but it's a system serif fallback with nothing to ship. No
  `@font-face`, no `cfg.extraFonts` needed — leave as a known warn.
- `[RENDER_SKIPPED]` — the driver auto-skips the render check on a no-change re-sync
  (nothing to upload). Expected, not a new warn.

## Re-sync risks (what can go stale)
- `node_modules/bar-app-ds/` is gitignored-by-location — a fresh clone has no
  mini-package; rebuild it (esbuild + d.ts + css) before re-running the converter.
- If `src/components/ui/{button,input}.tsx` change upstream, the `poc-src/` copies
  and the hand-written `.d.ts` will drift — re-copy and re-bundle.
- `.d.ts` props are hand-written, not extracted from source — verify against the
  real component if the API changes. (Checked 2026-06-22: upstream button/input
  variant+size enums unchanged — the only diff vs poc-src is the `@/lib/utils` →
  `../../src/lib/utils` import-path rewrite, which is intentional. `.d.ts` still current.)
- The token layer flip already happened (see RESOLVED above). The remaining risk is
  the **reverse**: if the admin token values in `globals.css` change, re-compiling
  `_tw-input.css` (which imports globals.css) picks them up automatically — but the
  hardcoded `#F7F4EA` cream-surface override in `_tw-input.css` would need updating
  if the admin background token ever changes.
- The `[TOKENS_MISSING]` warn lists app runtime vars (radix popover/dropdown,
  `--chip-c`, `--ev-theme`, `--spotify-bg`, `--badge-color`, `--bg`). Count drifts
  with the app — see the authoritative count in **Known render warns** above (28 as
  of 2026-06-25). Still expected app runtime vars — leave as a known warn.
- **`styles.css` re-uploads whenever `globals.css` changes, even when Button/Input
  are unchanged.** `_tw-input.css` imports `globals.css` and Tailwind v4 auto-detects
  content from the repo root, so app-wide public utilities (e.g. the After Dark theme)
  land in the compiled `styles.css`. On 2026-06-25 the driver reported `upload.any:true`
  with `styling:true`/`aux:true` but `components:[]`/`bundle:false`/`deletePaths:[]` —
  i.e. only the recompiled stylesheet + anchor changed. This is expected: recompile
  `styles.css` (the `@tailwindcss/cli` step) before the driver whenever globals.css
  moved, then upload normally. The component bundle stays identical.
