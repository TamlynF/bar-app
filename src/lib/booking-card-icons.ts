// Single source of truth for the icon set used by the booking-card editors
// (admin) and the public /book card render, so the picker and the rendered
// glyph always agree. Mirrors the Lucide set used by the event-subtype badge
// editor.

import {
  CalendarDays, MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer, Banknote, Trophy, Wine, Speaker, User, Disc3, Building2,
  type LucideIcon,
} from "lucide-react";

export const BOOKING_CARD_ICONS: Record<string, LucideIcon> = {
  CalendarDays, MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer, Banknote, Trophy, Wine, Speaker, User, Disc3, Building2,
};

export const BOOKING_CARD_ICON_NAMES = Object.keys(BOOKING_CARD_ICONS);

/** Resolve a stored icon name to its component, defaulting to a calendar glyph. */
export function cardIcon(name: string | null | undefined): LucideIcon {
  return (name && BOOKING_CARD_ICONS[name]) || CalendarDays;
}
