import { Mail } from "lucide-react";
import { SiFacebook, SiX, SiWhatsapp } from "react-icons/si";

export function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const targets = [
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      Icon: SiFacebook,
    },
    { label: "X", href: `https://x.com/intent/tweet?url=${u}&text=${t}`, Icon: SiX },
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, Icon: SiWhatsapp },
    { label: "Email", href: `mailto:?subject=${t}&body=${u}`, Icon: Mail },
  ];

  return (
    <div className="flex items-center gap-2.5">
      {targets.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${label}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white/5 text-ink transition-colors hover:border-gold/40 hover:bg-white/10 hover:text-gold"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
