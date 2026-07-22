import { SmoothScroll } from "@/components/smooth-scroll";

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
