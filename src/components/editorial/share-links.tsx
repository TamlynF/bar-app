import { Mail } from "lucide-react";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";

export function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const targets = [
    {
      label: SOCIAL_BRANDS.facebook.label,
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      Icon: SOCIAL_BRANDS.facebook.Icon,
      className: SOCIAL_BRANDS.facebook.solid,
    },
    {
      label: SOCIAL_BRANDS.x.label,
      href: `https://x.com/intent/tweet?url=${u}&text=${t}`,
      Icon: SOCIAL_BRANDS.x.Icon,
      className: SOCIAL_BRANDS.x.solid,
    },
    {
      label: SOCIAL_BRANDS.whatsapp.label,
      href: `https://wa.me/?text=${t}%20${u}`,
      Icon: SOCIAL_BRANDS.whatsapp.Icon,
      className: SOCIAL_BRANDS.whatsapp.solid,
    },
    {
      label: "Email",
      href: `mailto:?subject=${t}&body=${u}`,
      Icon: Mail,
      className: "bg-gold text-on-gold",
    },
  ];

  return (
    <div className="flex items-center gap-2.5">
      {targets.map(({ label, href, Icon, className }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${label}`}
          className={
            "inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 " +
            className
          }
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
