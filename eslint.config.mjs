import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/vendored design-system bundle + sync tooling — not source.
    "ds-bundle/**",
    ".ds-sync/**",
  ]),
  {
    plugins: {
      "unused-imports": unusedImports,
      "better-tailwindcss": betterTailwindcss,
    },
    settings: {
      "better-tailwindcss": {
        // Tailwind v4 uses a CSS-based config; point the plugin at the entry point.
        entryPoint: "src/app/globals.css",
      },
    },
    rules: {
      // Unused imports/vars: swap the base (non-fixable) rule for the
      // auto-fixable equivalent so unused imports are stripped on save.
      // Kept at "warn" (not "error"): `eslint --fix` removes them either way
      // (on-save + pre-commit), so this auto-cleans without turning existing
      // unused imports into build-breaking errors.
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          vars: "all",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Auto-sort Tailwind classes (autofixable). Only the ordering rule is
      // enabled to stay surgical; other opinionated rules are left off.
      "better-tailwindcss/enforce-consistent-class-order": "warn",
      // Catch class strings that aren't real Tailwind. An invalid class is just a
      // string: TypeScript never validates it and the ordering rule above happily
      // sorts it, so a mangled className (e.g. `tracdhrink-0`, `tre`) ships with
      // the styling silently dead while `tsc` and `eslint` both report clean.
      // "error" so `npm run lint` fails loudly on a corrupted class string rather
      // than it shipping unnoticed. Wire `npm run lint` into pre-commit/CI to gate.
      // `ignore` lists the hand-written semantic utilities that live in
      // globals.css `@layer utilities` — they're not Tailwind-generated, so the
      // plugin can't resolve them and would otherwise flag them. Keep in sync
      // when adding a new custom class there (see CLAUDE.md "Styling").
      "better-tailwindcss/no-unknown-classes": [
        "error",
        {
          ignore: [
            "^ad-", // ad-blink, ad-kind, ad-marquee-track, ad-ping, ad-rise, ad-row, ad-stub-perf
            "^animate-reveal$",
            "^animate-spin-slow$",
            "^bg-dropdown$",
            "^cat-", // cat-banner, cat-items, cat-note
            "^dir-(ltr|rtl)$",
            "^ev-", // ev-dot, ev-text — the [style*="--ev-c"] colour hooks
            "^input-scheme-dark$",
            "^is-lit$",
            "^menu-", // menu-col, menu-frame, menu-grid, menu-row, ...
            "^neon-", // neon-bg, neon-border, neon-glow, neon-text, ...
            "^no-print$",
            "^no-scrollbar$",
            "^olive-bg$",
            "^pending$",
            "^pt-safe-top$",
            "^rich-content", // rich-content, rich-content--admin, rich-content--public
            "^rich-editor$",
            "^spirits-pill$",
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
