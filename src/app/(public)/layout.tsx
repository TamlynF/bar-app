import { SmoothScroll } from "@/components/smooth-scroll";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SmoothScroll />
      <div className="max-sm:pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">{children}</div>
    </>
  );
}
