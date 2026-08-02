import Link from "next/link";
import { MapPin } from "lucide-react";
import { SiInstagram, SiFacebook } from "react-icons/si";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import type { CompanyInfo } from "@/components/find-us";

const FOOTER_LINKS = [
  { href: "/whats-on", label: "What's On" },
  { href: "/menu", label: "Menu" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
  { href: "/book", label: "Book" },
];

export function PublicFooter({ info }: { info?: CompanyInfo }) {
  const ig = info?.instagram?.replace("@", "");
  const fb = info?.facebook;
  const mapsHref = info?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`
    : null;
  const hasVisit = Boolean(info?.address || ig || fb);

  return (
    <footer className="border-t border-hairline pt-10">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div>
          <p className="font-black text-[10px] tracking-[0.4em] text-stone-500 uppercase">
            Don Fenticas
          </p>
          <p className="mt-2 max-w-60 text-xs leading-relaxed text-stone-500">
            Live music, DJs, quiz nights and karaoke - your local late-night
            bar.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="font-black text-[10px] tracking-widest text-stone-600 uppercase">
            Explore
          </p>
          <ul className="mt-3 space-y-2">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-xs font-bold tracking-wide text-stone-400 uppercase transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {hasVisit && (
        <div>
          <p className="font-black text-[10px] tracking-widest text-stone-600 uppercase">
            Visit
          </p>
          {info?.address && mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-stone-400 transition-colors hover:text-ink"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FDCC4B]/70" aria-hidden="true" />
              <span>{info.address}</span>
            </a>
          )}
          {(ig || fb) && (
            <div className="mt-4 flex items-center gap-2">
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
          )}
        </div>
        )}
      </div>

      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-hairline py-6 sm:flex-row">
        <p className="text-[9px] tracking-widest text-stone-600 uppercase">
          &copy; {new Date().getFullYear()}{" "}
          Don Fenticas &middot; Licensed venue &middot; Drink responsibly
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-[9px] font-bold tracking-widest text-stone-600 uppercase transition-colors hover:text-stone-400 sm:min-h-0"
        >
          Staff Login
        </Link>
      </div>
    </footer>
  );
}