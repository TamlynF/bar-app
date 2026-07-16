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
    },
  },
]);

export default eslintConfig;
