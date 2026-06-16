"use client";

import { useEffect } from "react";

/**
 * LocatorJS in-page runtime — dev only.
 *
 * The Turbopack loader (configured in next.config.ts) injects `data-locatorjs`
 * attributes into the SSR'd HTML. This runtime reads those attributes straight
 * from the DOM (so it works for Server Components too) and enables Alt+click to
 * jump to source in VSCode. We use the runtime rather than the browser
 * extension because the extension can't read v0.5 attributes or React 19 fibers.
 *
 * Guarded by NODE_ENV so the dynamic import is dead-code-eliminated in prod.
 */
export function LocatorInit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    import("@locator/runtime").then(({ default: setup }) => {
      // "jsx" adapter reads the loader-injected data-locatorjs attributes
      // (incl. server components). The "react" adapter uses fiber _debugSource,
      // which React 19 no longer provides.
      setup({ adapter: "jsx" });
    });
  }, []);

  return null;
}
