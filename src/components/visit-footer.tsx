import Link from "next/link";
import { ChevronDown, ChevronRight, Clock, MapPin, Send, type LucideIcon } from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import { instagramHandle, instagramUrl } from "@/lib/company-info";
import type { CompanyInfo } from "@/lib/company-info";
import { summariseOpeningHours } from "@/lib/opening-hours";
import { CompanyWordmark } from "@/components/company-wordmark";

type Cell = {
  Icon: LucideIcon;
  title: string;
  lines: string[];
  href: string | null;
  external?: boolean;
};

/* Three-cell visit block (find us / opening hours / directions) followed
   by socials and the legal line. Phones fold the same details into an
   accordion so the bottom of the page stays short. */
export function VisitFooter({ info }: { info: CompanyInfo }) {
  const mapsHref = info?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`
    : null;
  const hours = summariseOpeningHours(info?.opening_hours);
  const ig = info?.instagram?.replace("@", "");
  const igUrl = instagramUrl(info?.instagram);
  const igHandle = instagramHandle(info?.instagram);
  const fb = info?.facebook;

  const cells: Cell[] = [
    {
      Icon: MapPin,
      title: "Find us",
      lines: [info?.address ?? "Good music. Good people.", "See you at the bar."],
      href: "/contact",
    },
    {
      Icon: Clock,
      title: "Opening hours",
      lines: hours.length ? hours : ["Hours on the contact page"],
      href: "/contact",
    },
    {
      Icon: Send,
      title: "Get directions",
      lines: ["Tap to open maps", "and plan your visit."],
      href: mapsHref,
      external: true,
    },
  ];

  const summaryCls =
    "flex min-h-13 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 select-none [&::-webkit-details-marker]:hidden";
  const iconCls = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/12 text-gold";
  const linkRow =
    "flex min-h-11 items-center justify-between gap-3 rounded-xl border border-ink/15 bg-canvas px-3.5 text-[12px] font-bold text-ink transition-[scale,background-color] duration-150 active:scale-[0.985] active:bg-white/5";

  return (
    <footer className="mx-4 mt-6 sm:mx-6 md:mt-5 lg:mx-10">
      <div className="overflow-hidden rounded-2xl border border-ink/15 bg-canvas-2 md:hidden">
        <details className="group border-b border-ink/10">
          <summary className={summaryCls}>
            <span className={iconCls}>
              <Clock className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black text-xs tracking-wide text-ink uppercase">Opening hours</span>
              <span className="mt-0.5 block truncate text-[10px] text-ink-2 tabular-nums group-open:hidden">
                {hours[0] ?? "Hours on the contact page"}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-2 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="m-0 list-none px-3.5 pb-3.5 pl-16 text-[12px] leading-relaxed text-ink tabular-nums">
            {(hours.length ? hours : ["Hours on the contact page"]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>

        <details className="group">
          <summary className={summaryCls}>
            <span className={iconCls}>
              <MapPin className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black text-xs tracking-wide text-ink uppercase">Find us &amp; directions</span>
              <span className="mt-0.5 block truncate text-[10px] text-ink-2 group-open:hidden">
                {info?.address ?? "See you at the bar."}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-2 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="flex flex-col gap-2 px-3.5 pb-3.5">
            {info?.address && <p className="m-0 text-[12px] leading-snug text-ink">{info.address}</p>}
            {mapsHref && (
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={linkRow}>
                <span className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4 text-gold" aria-hidden="true" />
                  Open in maps
                </span>
                <ChevronRight className="h-4 w-4 text-ink-2" aria-hidden="true" />
              </a>
            )}
            <Link href="/contact" className={linkRow}>
              Contact &amp; venue info
              <ChevronRight className="h-4 w-4 text-ink-2" aria-hidden="true" />
            </Link>
          </div>
        </details>

        {igUrl && (
          <a href={igUrl} target="_blank" rel="noopener noreferrer" className={`${summaryCls} border-t border-ink/10 transition-colors active:bg-white/5`}>
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${SOCIAL_BRANDS.instagram.solid}`}>
              <SiInstagram className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black text-xs tracking-wide text-ink uppercase">Follow us</span>
              {igHandle && <span className="mt-0.5 block truncate text-[10px] text-ink-2">{igHandle} · nights, gigs and specials</span>}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          </a>
        )}
      </div>

      <ul className="m-0 hidden list-none overflow-hidden rounded-2xl border border-ink/15 bg-canvas-2 p-0 md:grid md:grid-cols-3 md:rounded-[20px]">
        {cells.map(({ Icon, title, lines, href, external }, i) => {
          const body = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/12 text-gold md:h-11 md:w-11">
                <Icon className="h-4.5 w-4.5 md:h-5.5 md:w-5.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-xs tracking-wide text-ink uppercase md:text-[13px]">{title}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-ink-2 tabular-nums md:mt-1 md:text-[11px] md:leading-relaxed">
                  {lines.map((l, j) => (
                    <span key={j} className={j > 0 ? "md:block" : undefined}>
                      {j > 0 && <span className="md:hidden"> · </span>}
                      {l}
                    </span>
                  ))}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-2 md:hidden" aria-hidden="true" />
            </>
          );
          const cls = `flex min-h-15 items-center gap-3 px-3.5 py-2.5 md:min-h-0 md:gap-3.5 md:px-6 md:py-5.5 ${i > 0 ? "border-t border-ink/10 md:border-t-0 md:border-l" : ""}`;
          return (
            <li key={title} className="flex">
              {href ? (
                external ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} w-full transition-colors hover:bg-white/5`}>{body}</a>
                ) : (
                  <Link href={href} className={`${cls} w-full transition-colors hover:bg-white/5`}>{body}</Link>
                )
              ) : (
                <div className={`${cls} w-full`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-col items-center gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-between">
        <div className="hidden items-center gap-2 md:flex">
          {ig && (
            <a
              href={`https://instagram.com/${ig}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Don Fenticas on Instagram"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 ${SOCIAL_BRANDS.instagram.solid}`}
            >
              <SiInstagram className="h-4 w-4" />
            </a>
          )}
          {fb && (
            <a
              href={fb.startsWith("http") ? fb : `https://facebook.com/${fb}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Don Fenticas on Facebook"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 ${SOCIAL_BRANDS.facebook.solid}`}
            >
              <SiFacebook className="h-4 w-4" />
            </a>
          )}
        </div>
        <p className="m-0 text-center text-[9px] tracking-widest text-stone-600 uppercase">
          &copy; {new Date().getFullYear()}{" "}
          <CompanyWordmark className="inline-block h-2.5 align-[-0.15em] opacity-80" />{" "}
          &middot; Licensed venue &middot; Drink responsibly
        </p>
      </div>
    </footer>
  );
}
