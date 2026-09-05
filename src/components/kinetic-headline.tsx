import { cn } from "@/lib/utils";

export type KineticLine = { text: string; accent?: boolean };

export function KineticHeadline({
  lines,
  className,
  align = "start",
  as: Tag = "h1",
}: {
  lines: KineticLine[];
  className?: string;
  align?: "start" | "center";
  as?: "h1" | "h2" | "p";
}) {
  const label = lines.map((l) => l.text).join(" ");
  let index = 0;

  return (
    <Tag
      aria-label={label}
      className={cn(
        "m-0 flex flex-col font-black tracking-tighter text-ink uppercase",
        className,
        // After className on purpose: tailwind-merge treats a font-size class
        // (text-[clamp(...)]) as overriding line-height, so a leading placed
        // before it would be dropped.
        "leading-[0.9]"
      )}
    >
      {lines.map((line, lineIndex) => (
        <span
          key={lineIndex}
          aria-hidden="true"
          className={cn(
            "ad-extrude flex whitespace-nowrap",
            align === "center" ? "justify-center" : "justify-start",
            line.accent && "ad-extrude-gold text-gold"
          )}
        >
          {Array.from(line.text).map((ch, charIndex) => {
            const i = index++;
            return (
              <span
                key={charIndex}
                style={{ "--i": i } as React.CSSProperties}
                className={cn("ad-letter block", ch === " " && "w-[0.22em]")}
              >
                {ch === " " ? " " : ch}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
