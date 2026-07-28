import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    "supabase/.temp/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
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
        entryPoint: "src/app/globals.css",
      },
    },
    rules: {
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
      "better-tailwindcss/enforce-consistent-class-order": "off",
      "better-tailwindcss/no-conflicting-classes": "error",
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
