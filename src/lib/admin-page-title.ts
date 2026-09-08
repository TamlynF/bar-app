import { useSyncExternalStore } from "react";

/* A page that knows its record's name (the layout only knows the URL) can
   publish it here and the admin header shows it in place of the id. */
let current: string | null = null;
const listeners = new Set<() => void>();

export function setAdminPageTitle(title: string | null) {
  current = title;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminPageTitle(): string | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
