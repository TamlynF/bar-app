import { revalidatePath } from "next/cache";

// The public event surfaces are ISR'd at 300s, and an event poster can now come
// from three places (the event, its booked act, or its sub-category default), so
// a change in any of them has to flush all three pages. `/whats-on/[id]` is a
// dynamic route, which `revalidatePath("/whats-on")` does not cover - it needs
// the route-pattern form.
//
// Caveat: revalidatePath only purges the cache of the instance that ran the
// action. That is fine on Vercel (shared cache); a self-hosted multi-instance
// deploy without a shared cache handler will still serve stale from the other
// instances until their 300s window elapses.
export function revalidatePublicEventPages() {
  revalidatePath("/");
  revalidatePath("/whats-on");
  revalidatePath("/whats-on/[id]", "page");
}
