import { SmoothScroll } from "@/components/smooth-scroll";

/**
 * Layout for the public route group (/book, /menu, /gallery, /contact,
 * /whats-on). Minimal passthrough whose only job is to mount Lenis
 * smooth-scroll across the public surface. Each page still renders its own
 * <main> + <PublicNav>. The home page lives outside this group and mounts
 * SmoothScroll itself.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SmoothScroll />
      {children}
    </>
  );
}
