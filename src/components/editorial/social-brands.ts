import { SiFacebook, SiInstagram, SiTiktok, SiWhatsapp, SiX, SiYoutube } from "react-icons/si";
import type { IconType } from "react-icons";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "x"
  | "whatsapp";

export const SOCIAL_BRANDS: Record<
  SocialPlatform,
  { label: string; Icon: IconType; solid: string; tint: string }
> = {
  instagram: {
    label: "Instagram",
    Icon: SiInstagram,
    solid: "bg-linear-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white",
    tint: "text-[#DD2A7B]",
  },
  facebook: {
    label: "Facebook",
    Icon: SiFacebook,
    solid: "bg-[#1877F2] text-white",
    tint: "text-[#1877F2]",
  },
  youtube: {
    label: "YouTube",
    Icon: SiYoutube,
    solid: "bg-[#FF0000] text-white",
    tint: "text-[#FF0000]",
  },
  tiktok: {
    label: "TikTok",
    Icon: SiTiktok,
    solid: "bg-black text-white ring-1 ring-white/25",
    tint: "text-white",
  },
  x: {
    label: "X",
    Icon: SiX,
    solid: "bg-black text-white ring-1 ring-white/25",
    tint: "text-white",
  },
  whatsapp: {
    label: "WhatsApp",
    Icon: SiWhatsapp,
    solid: "bg-[#25D366] text-[#07301C]",
    tint: "text-[#25D366]",
  },
};
