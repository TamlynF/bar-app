import { useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

/* A page that owns a primary action (the layout only knows the URL) can
   publish it here and the admin header renders it in its action slot. */
export type AdminPageAction = { label: string; Icon: LucideIcon; onClick: () => void };

let current: AdminPageAction | null = null;
const listeners = new Set<() => void>();

export function setAdminPageAction(action: AdminPageAction | null) {
  current = action;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminPageAction(): AdminPageAction | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
