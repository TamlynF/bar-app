# design-sync notes - bar-app

## Scope of this sync
This is a **proof-of-concept** sync, not a full design-system import. Only
`Button` and `Input` from `src/components/ui/` are synced. The project is
**"Don Fenticas (POC)"** (`ba6ad8ad-ac14-4122-84b4-6611748705ed`).

## Why this repo is not a normal package-shape DS
`bar-app` is a Next.js 16 app, not a published component library - no Storybook,
no `dist/`, no exported package. To make the converter work we build a small
**self-contained mini-package** instead of pointing it at the repo:

- `.design-sync/poc-src/{button,input,index}.tsx` - copies of the two components
  (durable, committed).
- **`.design-sync/build-minipkg.mjs` (durable, committed) rebuilds the whole
  mini-package** - run it from the repo root before the driver:
  ```
  node .design-sync/build-minipkg.mjs
  ```
  It emits `node_modules/bar-app-ds/dist/index.js` (esbuild; react/react-dom/jsx
  external; clsx + tailwind-merge + cva + radix Slot inlined), the hand-faithful
  `dist/index.d.ts`, and `package.json`. `node_modules/bar-app-ds/` is NOT committed
  (it's under node_modules) - this script recreates it on a fresh clone. It imports
  esbuild from `.ds-sync/node_modules` (staged converter deps, recreated per clone
  by the SKILL step-7 `npm i`).
- **`.d.ts` GOTCHA (learned 2026-07-07):** the ts-morph extractor DROPS
  `VariantProps<typeof buttonVariants>` and `React.ComponentProps<"button">`
  (unresolved generics). A `.d.ts` that relies on them silently emits a
  `Button.d.ts` **missing `variant`/`size`** (only `asChild` + fallback props
  survive). `build-minipkg.mjs` therefore spells `variant`/`size` out as **direct
  literal members** with `extends React.*HTMLAttributes` for native attrs - do NOT
  "simplify" it back to the intersection form.
- **`.d.ts` GOTCHA part 2 - the `extends` chain is dropped too (found 2026-07-31).**
  The fix above only rescued the *direct literal members*. ts-morph ALSO drops
  `extends React.ButtonHTMLAttributes<…>` / `React.InputHTMLAttributes<…>`, so the
  native attrs those chains carry never reached the emitted contract. Button
  masked it (variant/size/asChild survived as literals); **`InputProps` is an empty
  body, so `Input.d.ts` shipped with only `className`/`id`/`style`/`children`** -
  the design agent saw an Input accepting no `placeholder`, `value`, `onChange` or
  `disabled`, and a Button with no `onClick`/`disabled`. Shipped that way from the
  first sync until 2026-07-31. **Fixed via `cfg.dtsPropsFor.{Button,Input}`** in
  config.json (the documented escape hatch - no script fork), which spells the
  practical native-attribute set out as literal members. Runtime was always fine
  (both components spread `...props`); it was purely a contract defect.
  **Do not delete those `dtsPropsFor` entries** - the extends chain will silently
  vanish again. If the upstream component gains a prop, add it there by hand.
- `node_modules/bar-app-ds/styles.css` - compiled Tailwind (see below); still a
  separate `@tailwindcss/cli` step, not part of `build-minipkg.mjs`.
- Converter/driver entry: `--entry ./node_modules/bar-app-ds/dist/index.js`.

## RESOLVED (2026-06-22) - the token layer now exists
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
scope - sourcing from globals.css keeps values in sync (no hardcoded drift). globals.css
also sets `html/body` to the **public** dark-olive page bg (#14180a); since Button/Input
are admin-surface primitives, `_tw-input.css` appends `html, body { background-color:
#F7F4EA; }` so preview cards render on the admin **cream** canvas, not dark olive.
If you ever see buttons with no fill again: confirm `_tw-input.css` still imports
globals.css (not the old bare `@import "tailwindcss"`).

## Tailwind CSS compile
`styles.css` is compiled via `@tailwindcss/cli` (installed into `.ds-sync`).
Output **directly into the mini-package** (under `node_modules`, so the editor's
Tailwind/CSS linter doesn't flag the generated output - don't leave a compiled
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
These are set at runtime by the app and are irrelevant to Button/Input - **leave
as a known warn, do not chase.**

## Run log
- **2026-07-31 re-sync (bundled skill 2.1.220).** Remote anchor was exactly the one
  the 2026-07-07 run uploaded (no concurrent sync; re-checked immediately before
  `finalize_plan` and still unmoved). Both components **verification-unchanged**
  (renderHashes + sourceKeys matched → capture skipped, `empty_worklist`, grades
  carried forward). Three builds: (1) baseline - `upload.any:true` with
  `bundle`/`styling`/`aux` true but `components:[]`; (2) after the `dtsPropsFor`
  contract fix (see `.d.ts` GOTCHA part 2) - `components:[Button,Input]`;
  (3) after the conventions-header edit, per the rebuild rule. styles.css grew
  **255 KB → 295 KB** (this session's app work: the 6-row TonightCard grid,
  gallery lightbox, `grid-rows-6`/`h-9.5`/`basis-[calc(…)]` utilities). Uploaded
  all 18 DS files, `deletePaths:[]`, render check 2/2 clean.
- **The `.d.ts` contract fix is the important part of this run** - the bundle and
  previews were already correct; what changed is what the design agent is *allowed
  to type*. Expect its generated code to start using `onChange`/`placeholder`/
  `disabled` on these primitives now.
- **2026-07-07 re-sync (bundled skill 2.1.202).** Remote anchor had moved since the
  last cached one (`styleSha` `7b17c76d…`→`8c66c2a0…`, everything else identical) - a
  prior styling-only re-upload. My fresh build: both components **verification-unchanged**
  (renderHashes + sourceKeys matched → no re-grade), `upload.any:true` with
  `styling:true` (styles.css grew to **255 KB** - app utilities, was 162 KB in the
  first sync), `bundle:true`/`aux:true` (toolchain churn: `scriptsSha` `093dbd51…`→
  `0f1e261b…`, newer staged scripts), and `components:[Button]` (Button's `.d.ts`/
  `.prompt.md` re-emitted with the fixed contract; Input's emitted files matched remote
  byte-for-byte). Uploaded all 18 DS files, `deletePaths:[]`. Render check 2/2 clean;
  only the known `[FONT_MISSING] "Cambria"` warn.
- **The project is actively USED by the design agent** - `list_files` shows `app/*`,
  `whatson-export/*`, `uploads/*`, `Don Fenticas - Home.html`, `port/*` etc. alongside
  the DS files. These are the agent building pages WITH the DS (not scaffold junk).
  The driver's `deletePaths` never lists them (it only manages `components/`, `_preview/`,
  `_ds_bundle*`, `styles.css`, `_vendor/`, aux) - **never delete them**, `deletes:[]`
  stays correct on this atomic path.
- Conventions header re-validated against the fresh build: all tokens (`--primary`…
  `--ring`), values (`#5C4033`×157 etc.) and semantic utilities (`bg-primary`,
  `border-input`, `ring-ring`…) resolve in the shipped `_ds_bundle.css` closure (note:
  `styles.css` is just `@import "./_ds_bundle.css";` - grep the bundle css, not styles.css).
  The only header items not in the closure are the illustrative public-surface arbitrary
  hex classes (`bg-[#FDCC4B]`/`text-[#26300D]`) - generated on use, never pre-shipped;
  expected, not drift. No rewrite.

## Windows / environment quirks (2026-07-31)
- **`EPERM: rm '…\ds-bundle'` on a driver run is transient.** The build wipes
  `--out` first, and Windows can still hold a handle from the previous run's
  playwright chromium (freshly written screenshots). The failed verdict reports
  `"shape":"storybook"` / `"anchor":"unknown"` - that's just the pre-config default
  after an early build failure, NOT a real shape flip; ignore it. **Just re-run the
  driver** - it succeeded immediately on retry. Do NOT go hunting for processes to
  kill: `Get-Process chrome/node` on this machine lists the user's own browser and
  dev server, none of which hold the lock.
- **`DesignSync(finalize_plan)` resolves a relative `localDir` against the Bash
  tool's persisted cwd, not the repo root.** A prior `cd ds-bundle` in an earlier
  command made `./ds-bundle` resolve to `…\ds-bundle\ds-bundle` (ENOENT). Pass the
  **absolute** path (`C:\DFRepo\bar-app\ds-bundle`), or `cd` back to the repo root
  first.

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
  `app/` empty - delete once if you want it clean, then ignore.

## Known render warns (checked, legitimate)
- `[TOKENS_MISSING]` - app runtime vars, see Tailwind compile section. Expected.
  (Count drifts with the app: 2026-06-23 driver run listed **15** vars; 2026-06-24
  driver run listed **18** vars - the same radix popover/dropdown +
  `--chip-c`/`--ev-theme`/`--spotify-bg`/`--badge-color`/`--bg` family plus new
  app runtime vars `--fh`/`--cc`/`--spine`. Same nature, not a new kind of warn.)
  **2026-06-25 driver run listed 28 vars** - the "After Dark" public theme
  (commits e865036/000ddb0/301a230/a0ffcdb) added more app runtime vars
  (`--fbd`/`--sub-border`/`--cat-bg` + the radix popover/dropdown family).
  Still app runtime vars, irrelevant to Button/Input (both render 2/2 clean).
  Same nature - leave as a known warn.)
  **2026-06-25 (second run, after refactor commit `4a71b79`) listed 9 vars** -
  the count *dropped* (radix dropdown/popover transform-origin/available-height +
  `--chip-c`/`--ev-theme`/`--spotify-bg`/`--badge-color`/`--bg`). globals.css moved
  again (`4a71b79` "Refactor code structure") so `styles.css` recompiled and
  re-uploaded (`upload` bundle/styling/aux all true, components unchanged, both
  Button/Input carried-forward good, render_churn canary confirmed clean). A drop
  is still the same family - fewer app utilities detected, no new KIND of var.)
  **2026-07-31 driver run listed 44 vars - the highest yet, and the current
  authoritative count.** New members: `--t`/`--top`/`--y`/`--x`/`--l` (layout +
  floor-plan inline vars), `--fp-ar`/`--venue-ar` (floor-plan aspect ratios) and
  `--radix-select-trigger-height`, on top of the usual radix popover/dropdown +
  `--chip-c`/`--ev-theme`/`--spotify-bg`/`--badge-color`/`--bg` family. Still app
  runtime vars set inline by the app, irrelevant to Button/Input (2/2 render
  clean). Same nature - leave as a known warn.)
- `[FONT_MISSING] "Cambria"` - **benign, accepted (checked 2026-06-23).** Cambria is
  NOT a brand font. It appears only inside Tailwind's default `.font-serif` fallback
  stack (`ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`) emitted into
  the shipped CSS. The validator's font scraper flags it because it isn't in its
  generic-allowlist, but it's a system serif fallback with nothing to ship. No
  `@font-face`, no `cfg.extraFonts` needed - leave as a known warn.
- `[RENDER_SKIPPED]` - the driver auto-skips the render check on a no-change re-sync
  (nothing to upload). Expected, not a new warn.

## Re-sync risks (what can go stale)
- `node_modules/bar-app-ds/` is gitignored-by-location - a fresh clone has no
  mini-package; run `node .design-sync/build-minipkg.mjs` (durable script) then the
  `@tailwindcss/cli` styles.css step before re-running the driver.
- If `src/components/ui/{button,input}.tsx` change upstream, the `poc-src/` copies
  and the hand-written `.d.ts` will drift - re-copy and re-bundle.
- **`cfg.dtsPropsFor` now owns both contracts (2026-07-31).** `Button.d.ts` and
  `Input.d.ts` are generated from the hand-written bodies in `.design-sync/config.json`,
  NOT from the mini-package's `dist/index.d.ts` (whose `extends React.*HTMLAttributes`
  chains ts-morph silently drops - see `.d.ts` GOTCHA part 2). Consequence: a prop
  added to the real component upstream will NOT appear in the synced contract until
  someone adds it to `dtsPropsFor` by hand. Check both when `src/components/ui/
  {button,input}.tsx` change.
- `.d.ts` props are hand-written, not extracted from source - verify against the
  real component if the API changes. (Checked 2026-06-22: upstream button/input
  variant+size enums unchanged - the only diff vs poc-src is the `@/lib/utils` →
  `../../src/lib/utils` import-path rewrite, which is intentional. `.d.ts` still current.)
- The token layer flip already happened (see RESOLVED above). The remaining risk is
  the **reverse**: if the admin token values in `globals.css` change, re-compiling
  `_tw-input.css` (which imports globals.css) picks them up automatically - but the
  hardcoded `#F7F4EA` cream-surface override in `_tw-input.css` would need updating
  if the admin background token ever changes.
- The `[TOKENS_MISSING]` warn lists app runtime vars (radix popover/dropdown,
  `--chip-c`, `--ev-theme`, `--spotify-bg`, `--badge-color`, `--bg`). Count drifts
  with the app - see the authoritative count in **Known render warns** above (28 as
  of 2026-06-25). Still expected app runtime vars - leave as a known warn.
- **`styles.css` re-uploads whenever `globals.css` changes, even when Button/Input
  are unchanged.** `_tw-input.css` imports `globals.css` and Tailwind v4 auto-detects
  content from the repo root, so app-wide public utilities (e.g. the After Dark theme)
  land in the compiled `styles.css`. On 2026-06-25 the driver reported `upload.any:true`
  with `styling:true`/`aux:true` but `components:[]`/`bundle:false`/`deletePaths:[]` -
  i.e. only the recompiled stylesheet + anchor changed. This is expected: recompile
  `styles.css` (the `@tailwindcss/cli` step) before the driver whenever globals.css
  moved, then upload normally. The component bundle stays identical.
  **Broaden the trigger (2026-06-25, third run):** styles.css drift is NOT limited to
  `globals.css` changes - Tailwind scans the **whole repo root**, so utilities added by
  ANY app page leak in. This run `globals.css` was untouched but the tables-settings
  redesign (`settings/tables/_components/tables-client.tsx`) added `translate-x-5` /
  `peer-checked:*` (a toggle) and the driver reported `upload.any:true` with ONLY
  `styling:true` (`bundle:false`/`aux:false`/`components:[]`). Harmless (extra unused CSS
  in the closure); upload or skip is a judgment call - the user chose to upload.
- **A concurrent newer-toolchain sync touched this project (observed 2026-06-25, third run).**
  The remote `_ds_sync.json` had moved since the prior run in the same session: `scriptsSha`
  `6bd093d3b53fd39e`→`093dbd516cd40af9`, `bundleSha12` `eb08f45d91e7`→`2a75cdd6fe76`,
  `styleSha`/`auxSha`/`renderHashes` all changed - but `sourceKeys`/`sourceHashes` were
  IDENTICAL (same Button/Input logic). After re-copying the staged scripts my build matched
  the remote on bundle/aux/scripts (so the project is being managed with the current bundled
  skill version too). If you see bundle/aux/scriptsSha move with identical source again, it's
  a concurrent sync, not a real change - re-fetch the anchor and trust the driver's diff.
