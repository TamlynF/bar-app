import Link from "next/link";
import { CompanyWordmark } from "@/components/company-wordmark";

const FOOTER_LINKS = [
  { href: "/whats-on", label: "What's On" },
  { href: "/menu", label: "Menu" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
  { href: "/book", label: "Book" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-hairline pt-10">
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

      <div className="mt-10 flex justify-center border-t border-hairline py-6">
        <p className="text-[9px] tracking-widest text-stone-600 uppercase">
          &copy; {new Date().getFullYear()}{" "}
          <CompanyWordmark className="inline-block h-2.5 align-[-0.15em] opacity-80" />{" "}
          &middot; Licensed venue &middot; Drink responsibly
        </p>
      </div>
    </footer>
  );
}