import { VideoFacade } from "@/components/video-facade";
import { SOCIAL_BRANDS } from "@/components/editorial/social-brands";
import type { BandInfo } from "@/lib/events-display";

const SOCIAL_META: {
  key: keyof BandInfo["socialLinks"];
  Icon: typeof SOCIAL_BRANDS.instagram.Icon;
  label: string;
  className: string;
}[] = (["instagram", "facebook", "youtube", "tiktok"] as const).map((key) => ({
  key,
  Icon: SOCIAL_BRANDS[key].Icon,
  label: SOCIAL_BRANDS[key].label,
  className: SOCIAL_BRANDS[key].solid,
}));

export function BandMedia({ band, title }: { band: BandInfo; title: string }) {
  const socials = SOCIAL_META.map((s) => ({ ...s, url: band.socialLinks[s.key] })).filter(
    (s) => s.url
  );
  const videos = band.videos.filter((v) => v.url);

  if (socials.length === 0 && videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {socials.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {socials.map(({ key, url, Icon, label, className }) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${title} on ${label}`}
              className={
                "inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 " +
                className
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {videos.map((v, i) => (
            <div key={i} className="min-w-0">
              <VideoFacade url={v.url} title={v.description || `Video ${i + 1}`} />
              <p
                title={v.description || undefined}
                className="mt-1.5 line-clamp-2 text-[11px] font-medium text-stone-400"
              >
                {v.description || `Video ${i + 1}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
