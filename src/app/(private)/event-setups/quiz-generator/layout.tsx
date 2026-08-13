import type { ReactNode } from "react";

/* The page itself is a Client Component, which cannot carry route segment
   config, so the generator's duration ceiling lives here. */
export const maxDuration = 300;

export default function QuizGeneratorLayout({ children }: { children: ReactNode }) {
  return children;
}
