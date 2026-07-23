export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-10 sm:mb-14">
      <span className="mb-3 block font-black text-[10px] tracking-[0.3em] text-[#FDCC4B] uppercase sm:text-xs">
        {eyebrow}
      </span>
      <h1 className="font-black text-[clamp(2rem,7vw,3.5rem)] leading-[0.92] tracking-tighter text-ink uppercase">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}
