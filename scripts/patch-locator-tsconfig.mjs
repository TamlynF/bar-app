// Works around a packaging bug in @locator/babel-jsx (a dev-only click-to-source
// tool wired into next.config via @locator/webpack-loader). Its published
// tsconfig.json does `extends: "@locator/dev-config/tsconfig.base.json"`, but
// @locator/dev-config is a workspace-only config that is never published/installed.
// The VS Code TypeScript server then flags a phantom "File not found" error on
// that node_modules tsconfig.
//
// This creates a harmless empty stub so the `extends` resolves. It is editor-only:
// the app build is unaffected (next.config uses only @locator/webpack-loader, and
// the project tsconfig excludes node_modules). Runs from `postinstall` so the stub
// is recreated after every `npm install`.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Both @locator/babel-jsx and @locator/webpack-loader ship a tsconfig.json that
// extends this same missing base, so patch if either is installed.
const consumers = [
  "node_modules/@locator/babel-jsx/tsconfig.json",
  "node_modules/@locator/webpack-loader/tsconfig.json",
].map((p) => resolve(p));
const stubDir = resolve("node_modules/@locator/dev-config");
const stubFile = resolve(stubDir, "tsconfig.base.json");

// Only patch when a broken consumer is actually installed and not already stubbed.
if (consumers.some((c) => existsSync(c)) && !existsSync(stubFile)) {
  try {
    mkdirSync(stubDir, { recursive: true });
    writeFileSync(stubFile, "{}\n");
    console.log("[patch-locator-tsconfig] created stub:", stubFile);
  } catch (err) {
    // Never fail an install over an editor-only convenience.
    console.warn("[patch-locator-tsconfig] skipped:", err.message);
  }
}
