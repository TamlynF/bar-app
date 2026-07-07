// Rebuilds the gitignored mini-package node_modules/bar-app-ds/ that the
// converter consumes. Run from the REPO ROOT before the re-sync driver:
//   node .design-sync/build-minipkg.mjs
// then compile styles.css (see .design-sync/NOTES.md "Tailwind CSS compile").
//
// esbuild is resolved from the staged converter deps (.ds-sync/node_modules),
// which are recreated per clone by the SKILL step-7 `npm i` — same lifecycle as
// the fork symlink. See NOTES.md "Why this repo is not a normal package-shape DS".
import { build } from "../.ds-sync/node_modules/esbuild/lib/main.js";
import { mkdirSync, writeFileSync } from "node:fs";

const PKG = "node_modules/bar-app-ds";
mkdirSync(`${PKG}/dist`, { recursive: true });

// 1. Bundle poc-src -> dist/index.js. react/react-dom/jsx stay external
//    (the converter re-bundles with react external to window.BarApp);
//    cva + tailwind-merge + clsx + radix Slot get inlined.
await build({
  entryPoints: [".design-sync/poc-src/index.ts"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  outfile: `${PKG}/dist/index.js`,
  absWorkingDir: process.cwd(),
  logLevel: "info",
});

// 2. Hand-faithful declaration the converter extracts <Name>Props from.
//    CRITICAL: spell variant/size out as DIRECT LITERAL members and use
//    `extends React.*HTMLAttributes`. The ts-morph extractor DROPS
//    `VariantProps<typeof buttonVariants>` and `React.ComponentProps<"button">`
//    (unresolved generics) — a reconstruction that relies on them silently
//    emits a Button.d.ts MISSING variant/size. Direct literal members survive;
//    native attrs come from the `extends`. (Learned 2026-07-07.)
writeFileSync(
  `${PKG}/dist/index.d.ts`,
  `import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Visual style. \`default\` = espresso admin button; override colour on the public surface. */
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    /** Control height / icon sizing. */
    size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
    /** Render as the single child element (Radix Slot) instead of a <button>. */
    asChild?: boolean;
}
export declare function Button(props: ButtonProps): React.JSX.Element;
export declare const buttonVariants: (...args: any[]) => string;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export declare function Input(props: InputProps): React.JSX.Element;
`,
);

// 3. package.json so the converter/node resolve the entry + types.
writeFileSync(
  `${PKG}/package.json`,
  JSON.stringify(
    {
      name: "bar-app-ds",
      version: "0.1.0",
      private: true,
      type: "module",
      module: "dist/index.js",
      main: "dist/index.js",
      types: "dist/index.d.ts",
      peerDependencies: { react: ">=19", "react-dom": ">=19" },
    },
    null,
    2,
  ) + "\n",
);

console.log("mini-package rebuilt: dist/index.js + dist/index.d.ts + package.json");
