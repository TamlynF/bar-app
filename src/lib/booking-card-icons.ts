
import {
  CalendarDays, MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer, Banknote, Trophy, Wine, Speaker, User, Disc3, Building2, Ghost,
  type LucideIcon,
} from "lucide-react";

export const BOOKING_CARD_ICONS: Record<string, LucideIcon> = {
  CalendarDays, MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer, Banknote, Trophy, Wine, Speaker, User, Disc3, Building2, Ghost
};

export const BOOKING_CARD_ICON_NAMES = Object.keys(BOOKING_CARD_ICONS);

export function cardIcon(name: string | null | undefined): LucideIcon {
  return (name && BOOKING_CARD_ICONS[name]) || CalendarDays;
}
