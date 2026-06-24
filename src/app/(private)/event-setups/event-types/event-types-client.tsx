"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Edit2, Trash2, Layers, Info, Image as ImageIcon, Loader2,
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Beer,
  ChevronDown, Banknote, Trophy, Wine, MoreVertical, Speaker, User,
} from "lucide-react";
import {
  saveTypeAction,
  deleteTypeAction,
  saveSubtypeAction,
  deleteSubtypeAction,
  saveBadgeAction,
  deleteBadgeAction,
} from "./actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EVENT_TYPE_COLORS, badgeClassFromColor, swatchHexFromColor } from "@/lib/event-type-colors";
import { BookingConfigEditor } from "@/components/booking-config-editor";
import type { BookingConfig } from "@/lib/booking-config";
import { BEHAVIOR_OPTIONS, BEHAVIOR_LABELS, type EventBehavior } from "@/lib/event-behavior";
import { BOOKING_GROUPING_OPTIONS, BOOKING_GROUPING_LABELS, type BookingGrouping } from "@/lib/booking-grouping";
import { IconPicker } from "@/components/icon-picker";

const ICON_OPTIONS = {
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer, Banknote, Trophy, Wine, Speaker, User,
};

export type Badge = {
  id: number;
  icon: string | null;
  title: string;
  description: string | null;
};

/** Booking-card branding fields shared by event_types / event_subtypes / events. */
export type BookingCardFields = {
  booking_card_title: string | null;
  booking_card_tagline: string | null;
  booking_card_icon: string | null;
  booking_card_badge: string | null;
};

export type Subtype = {
  id: number;
  event_types_id: number;
  name: string;
  default_event_title: string | null;
  tagline: string | null;
  color: string | null;
  behavior: EventBehavior;
  is_bookable: boolean;
  host_required: boolean;
  seating_required: boolean;
  payment_required: boolean;
  default_payment_amount: number | null;
  booking_config: BookingConfig | null;
  event_subtype_badges: Badge[];
} & BookingCardFields;

export type EventTypeRecord = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  booking_grouping: BookingGrouping;
  is_bookable: boolean;
  booking_config: BookingConfig | null;
  event_subtypes: Subtype[];
} & BookingCardFields;

const toTitleCase = (str?: string | null) =>
  !str ? "" : str.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

// ---- Editable form state shapes ----
/** Card fields in form state — empty strings instead of nulls. */
type CardForm = {
  booking_card_title: string;
  booking_card_tagline: string;
  booking_card_icon: string | null;
  booking_card_badge: string;
};

type TypeForm = {
  id?: number;
  name: string;
  description: string;
  color: string | null;
  booking_grouping: BookingGrouping;
  is_bookable: boolean;
  booking_config: BookingConfig;
} & CardForm;

type SubtypeForm = {
  id?: number;
  event_types_id: number;
  name: string;
  default_event_title: string;
  tagline: string;
  color: string | null;
  behavior: EventBehavior;
  is_bookable: boolean;
  host_required: boolean;
  seating_required: boolean;
  payment_required: boolean;
  default_payment_amount: string;
  booking_config: BookingConfig;
} & CardForm;

const EMPTY_CARD: CardForm = {
  booking_card_title: "",
  booking_card_tagline: "",
  booking_card_icon: null,
  booking_card_badge: "",
};

const cardFromRecord = (r: BookingCardFields): CardForm => ({
  booking_card_title: r.booking_card_title ?? "",
  booking_card_tagline: r.booking_card_tagline ?? "",
  booking_card_icon: r.booking_card_icon ?? null,
  booking_card_badge: r.booking_card_badge ?? "",
});

const appendCardFields = (fd: FormData, c: CardForm) => {
  fd.set("booking_card_title", c.booking_card_title);
  fd.set("booking_card_tagline", c.booking_card_tagline);
  fd.set("booking_card_icon", c.booking_card_icon ?? "");
  fd.set("booking_card_badge", c.booking_card_badge);
};

export default function EventTypesClient({ initialEventTypes = [] }: { initialEventTypes: EventTypeRecord[] }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();

  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
  const [expandedSubtype, setExpandedSubtype] = useState<number | null>(null);

  const [typeForm, setTypeForm] = useState<TypeForm | null>(null);
  const [subtypeForm, setSubtypeForm] = useState<SubtypeForm | null>(null);
  const [badgeForm, setBadgeForm] = useState<{ id?: number; event_subtypes_id: number; title: string; description: string; icon: string } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const types = [...initialEventTypes].sort((a, b) => a.name.localeCompare(b.name));

  const toggleType = (id: number) =>
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ---- Open helpers ----
  const openNewType = () =>
    setTypeForm({ name: "", description: "", color: null, booking_grouping: "per_event", is_bookable: false, booking_config: {}, ...EMPTY_CARD });

  const openEditType = (t: EventTypeRecord) =>
    setTypeForm({
      id: t.id, name: toTitleCase(t.name), description: t.description ?? "", color: t.color ?? null,
      booking_grouping: t.booking_grouping ?? "per_event",
      is_bookable: t.is_bookable, booking_config: t.booking_config ?? {},
      ...cardFromRecord(t),
    });

  const openNewSubtype = (t: EventTypeRecord) =>
    setSubtypeForm({
      event_types_id: t.id, name: "", default_event_title: "", tagline: "", color: null,
      behavior: "standard",
      is_bookable: false, host_required: false, seating_required: true, payment_required: false,
      default_payment_amount: "", booking_config: {},
      ...EMPTY_CARD,
    });

  const openEditSubtype = (s: Subtype) =>
    setSubtypeForm({
      id: s.id, event_types_id: s.event_types_id, name: toTitleCase(s.name),
      default_event_title: s.default_event_title ?? "", tagline: s.tagline ?? "", color: s.color ?? null,
      behavior: s.behavior,
      is_bookable: s.is_bookable, host_required: s.host_required, seating_required: s.seating_required,
      payment_required: s.payment_required, default_payment_amount: s.default_payment_amount != null ? String(s.default_payment_amount) : "",
      booking_config: s.booking_config ?? {},
      ...cardFromRecord(s),
    });

  // ---- Submit handlers ----
  const submitType = () => {
    if (!typeForm) return;
    if (!typeForm.name.trim()) { setError("Category name is required."); return; }
    const fd = new FormData();
    if (typeForm.id) fd.set("id", String(typeForm.id));
    fd.set("name", typeForm.name);
    fd.set("description", typeForm.description);
    fd.set("color", typeForm.color ?? "");
    fd.set("booking_grouping", typeForm.booking_grouping);
    fd.set("is_bookable", typeForm.booking_grouping === "per_type" && typeForm.is_bookable ? "on" : "");
    fd.set("booking_config", JSON.stringify(typeForm.booking_config));
    appendCardFields(fd, typeForm);
    setError(null);
    startTransition(async () => {
      const res = await saveTypeAction(fd);
      if (res?.error) setError(res.error); else setTypeForm(null);
    });
  };

  const submitSubtype = () => {
    if (!subtypeForm) return;
    if (!subtypeForm.name.trim()) { setError("Sub-type name is required."); return; }
    const fd = new FormData();
    if (subtypeForm.id) fd.set("id", String(subtypeForm.id));
    fd.set("event_types_id", String(subtypeForm.event_types_id));
    fd.set("name", subtypeForm.name);
    fd.set("default_event_title", subtypeForm.default_event_title);
    fd.set("tagline", subtypeForm.tagline);
    fd.set("color", subtypeForm.color ?? "");
    fd.set("behavior", subtypeForm.behavior);
    if (subtypeForm.is_bookable) fd.set("is_bookable", "on");
    if (subtypeForm.host_required) fd.set("host_required", "on");
    if (subtypeForm.seating_required) fd.set("seating_required", "on");
    if (subtypeForm.payment_required) fd.set("payment_required", "on");
    fd.set("default_payment_amount", subtypeForm.default_payment_amount || "0");
    fd.set("booking_config", JSON.stringify(subtypeForm.booking_config));
    appendCardFields(fd, subtypeForm);
    setError(null);
    startTransition(async () => {
      const res = await saveSubtypeAction(fd);
      if (res?.error) setError(res.error); else setSubtypeForm(null);
    });
  };

  const submitBadge = () => {
    if (!badgeForm) return;
    if (!badgeForm.title.trim()) { setError("Badge title is required."); return; }
    const fd = new FormData();
    if (badgeForm.id) fd.set("id", String(badgeForm.id));
    fd.set("event_subtypes_id", String(badgeForm.event_subtypes_id));
    fd.set("title", badgeForm.title);
    fd.set("description", badgeForm.description);
    fd.set("icon", badgeForm.icon);
    setError(null);
    startTransition(async () => {
      const res = await saveBadgeAction(fd);
      if (res?.error) setError(res.error); else setBadgeForm(null);
    });
  };

  const removeType = async (t: EventTypeRecord) => {
    const ok = await confirm({
      title: `Delete "${toTitleCase(t.name)}"`,
      description: "This deletes the category and all its sub-types and badges.",
      confirmLabel: "Delete", variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => { const res = await deleteTypeAction(t.id); if (res?.error) alert(res.error); });
  };

  const removeSubtype = async (s: Subtype) => {
    const ok = await confirm({
      title: `Delete "${toTitleCase(s.name)}"`,
      description: "This deletes the sub-type and its badges.",
      confirmLabel: "Delete", variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => { const res = await deleteSubtypeAction(s.id); if (res?.error) alert(res.error); });
  };

  const removeBadge = async (id: number) => {
    const ok = await confirm({ title: "Delete badge", description: "Delete this badge? This cannot be undone.", confirmLabel: "Delete", variant: "destructive" });
    if (!ok) return;
    startTransition(async () => { const res = await deleteBadgeAction(id); if (res?.error) alert(res.error); });
  };

  const renderIcon = (iconStr: string | null) => {
    if (!iconStr || !(iconStr in ICON_OPTIONS)) return <ImageIcon className="w-4 h-4 text-[#5F624F]" />;
    const I = ICON_OPTIONS[iconStr as keyof typeof ICON_OPTIONS];
    return <I className="w-4 h-4" />;
  };

  return (
    <div className="px-2 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#5F624F]">Manage your event categories and sub-types.</p>
        <button
          type="button"
          onClick={openNewType}
          className="h-8 px-3 rounded-lg bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-wide">New</span>
        </button>
      </div>

      <div className="space-y-2">
        {types.length === 0 ? (
          <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
            <Layers className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
            <p className="text-sm font-black text-[#1F1F1A]">No Event Categories</p>
            <p className="text-xs text-[#5F624F] mt-1">Add your first category to get started</p>
          </div>
        ) : (
          types.map((t) => {
            const open = expandedTypes.has(t.id) || types.length === 1;
            const subtypes = [...(t.event_subtypes ?? [])].sort((a, b) => a.name.localeCompare(b.name));
            return (
              <section
                key={t.id}
                className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden border-l-4"
                style={{ "--border-left-color": swatchHexFromColor(t.color) ?? "#E6DFC8" } as React.CSSProperties}
              >
                {/* Category header */}
                <div className="flex items-center bg-[#F7F4EA] px-4 sm:px-5 py-3 gap-2">
                  <button type="button" onClick={() => toggleType(t.id)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                    <span className={cn("text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-md border shrink-0", badgeClassFromColor(t.color))}>
                      {toTitleCase(t.name)}
                    </span>
                    <span className="text-[10px] font-black text-[#5F624F] shrink-0">({subtypes.length})</span>
                    <span className="hidden sm:inline-flex text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-[#E6DFC8]/60 text-[#5C4033] border border-[#E6DFC8] shrink-0">
                      {BOOKING_GROUPING_LABELS[t.booking_grouping ?? "per_event"]}
                    </span>
                  </button>

                  <div className="hidden sm:flex items-center gap-1">
                    <button type="button" onClick={() => openNewSubtype(t)} className="h-7 px-2.5 rounded-lg bg-[#5C4033] text-white hover:bg-[#5C4033]/85 transition-colors flex items-center gap-1 shrink-0">
                      <Plus className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-wide">Sub-Type</span>
                    </button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#5F624F] hover:text-[#5C4033]" onClick={() => openEditType(t)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeType(t)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>

                  <div className="sm:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5F624F]" onClick={(e) => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-9999 border-[#E6DFC8] shadow-lg min-w-50" style={{ ["--popover" as string]: "#ffffff", ["--accent" as string]: "#F7F4EA" }}>
                        <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => openNewSubtype(t)}><Plus className="w-4 h-4 mr-3 text-[#5C4033] stroke-[2.5]" /> Add Sub-Type</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                        <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => openEditType(t)}><Edit2 className="w-4 h-4 mr-3 text-[#5C4033] stroke-[2.5]" /> Edit Category</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                        <DropdownMenuItem className="py-3 text-[13px] text-red-600 font-medium focus:text-red-600" onClick={() => removeType(t)}><Trash2 className="w-4 h-4 mr-3 text-red-500 stroke-[2.5]" /> Delete Category</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <button type="button" onClick={() => toggleType(t.id)} className="shrink-0" title="Toggle group">
                    <ChevronDown className={cn("w-4 h-4 text-[#5F624F] transition-transform duration-200", open && "rotate-180")} />
                  </button>
                </div>

                {/* Subtypes */}
                {open && (
                  <div className="ml-5 sm:ml-8 mr-1 sm:mr-2 my-2 space-y-1.5">
                    {subtypes.length === 0 && (
                      <p className="text-[11px] text-[#5F624F] italic py-2">No sub-types yet.</p>
                    )}
                    {subtypes.map((s) => {
                      const isExpanded = expandedSubtype === s.id;
                      const badges = s.event_subtype_badges ?? [];
                      return (
                        <div
                          key={s.id}
                          className="rounded-xl bg-[#F7F4EA]/50 border border-[#E6DFC8] overflow-hidden border-l-4"
                          style={{ "--border-left-color": swatchHexFromColor(s.color) ?? "#E6DFC8" } as React.CSSProperties}
                        >
                          <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
                            <button type="button" onClick={() => setExpandedSubtype(isExpanded ? null : s.id)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 truncate max-w-35 sm:max-w-50", badgeClassFromColor(s.color))}>
                                {toTitleCase(s.name)}
                              </span>
                              <span className="text-[10px] text-[#5F624F] shrink-0">{badges.length} {badges.length === 1 ? "badge" : "badges"}</span>
                            </button>

                            <div className="hidden sm:flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-[#5F624F] hover:text-[#5C4033]" onClick={() => openEditSubtype(s)}><Edit2 className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeSubtype(s)}><Trash2 className="w-3 h-3" /></Button>
                            </div>

                            <div className="sm:hidden">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5F624F]"><MoreVertical className="w-4 h-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="z-9999 border-[#E6DFC8] shadow-lg min-w-45" style={{ ["--popover" as string]: "#ffffff", ["--accent" as string]: "#F7F4EA" }}>
                                  <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => setBadgeForm({ event_subtypes_id: s.id, title: "", description: "", icon: "" })}><Plus className="w-4 h-4 mr-3 text-[#5C4033] stroke-[2.5]" /> Add Badge</DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                                  <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => openEditSubtype(s)}><Edit2 className="w-4 h-4 mr-3 text-[#5C4033] stroke-[2.5]" /> Edit</DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                                  <DropdownMenuItem className="py-3 text-[13px] text-red-600 font-medium focus:text-red-600" onClick={() => removeSubtype(s)}><Trash2 className="w-4 h-4 mr-3 text-red-500 stroke-[2.5]" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <button type="button" onClick={() => setExpandedSubtype(isExpanded ? null : s.id)} className="shrink-0" title="Toggle details">
                              <ChevronDown className={cn("w-3.5 h-3.5 text-[#5F624F] transition-transform duration-200", isExpanded && "rotate-180")} />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-[#E6DFC8] space-y-2">
                              {s.tagline && <SummaryBox label="Tagline" value={s.tagline} />}
                              {s.default_event_title && <SummaryBox label="Default Event Title" value={s.default_event_title} />}

                              {/* Flag chips */}
                              <div className="flex flex-wrap gap-1.5">
                                <Chip label={BEHAVIOR_LABELS[s.behavior]} />
                                {s.is_bookable && t.booking_grouping === "per_subtype" && <Chip label="Bookable" />}
                                {s.host_required && <Chip label="Host Required" />}
                                {s.seating_required && <Chip label="Seating" />}
                                {s.payment_required && <Chip label={`Payment £${(s.default_payment_amount ?? 0).toFixed(2)}`} />}
                              </div>

                              {/* Shared booking config (read-only) — only when this category is grouped per sub-type */}
                              {s.is_bookable && t.booking_grouping === "per_subtype" && (
                                <BookingConfigEditor value={s.booking_config ?? {}} readOnly />
                              )}

                              {/* Badges */}
                              <div className="bg-white border border-[#E6DFC8] rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-[#E6DFC8]/50 bg-[#F7F4EA]/50">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F]">Display Badges</span>
                                  <button type="button" className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#5C4033] hover:text-[#5C4033]/70" onClick={() => setBadgeForm({ event_subtypes_id: s.id, title: "", description: "", icon: "" })}>
                                    <Plus className="w-3 h-3" /> Add
                                  </button>
                                </div>
                                {badges.length === 0 ? (
                                  <p className="text-xs text-[#5F624F] italic text-center py-4">No badges added yet.</p>
                                ) : (
                                  <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {badges.map((info) => (
                                      <div key={info.id} className="flex items-center gap-2.5 px-3 py-2 border border-[#E6DFC8] rounded-lg bg-[#F7F4EA]/30 relative group">
                                        <div className="shrink-0 w-7 h-7 flex items-center justify-center bg-[#F7F4EA] text-[#5C4033] rounded-lg">{renderIcon(info.icon)}</div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-bold text-[#1F1F1A] leading-none mb-0.5 truncate">{info.title}</p>
                                          {info.description && <p className="text-[10px] text-[#5F624F] truncate">{info.description}</p>}
                                        </div>
                                        <div className="sm:hidden shrink-0">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-[#5F624F]"><MoreVertical className="w-3 h-3" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="z-9999 border-[#E6DFC8] shadow-lg min-w-40" style={{ ["--popover" as string]: "#ffffff", ["--accent" as string]: "#F7F4EA" }}>
                                              <DropdownMenuItem className="py-3 text-[13px] text-[#5F624F] font-medium" onClick={() => setBadgeForm({ id: info.id, event_subtypes_id: s.id, title: info.title, description: info.description ?? "", icon: info.icon ?? "" })}><Edit2 className="w-4 h-4 mr-3 text-[#5C4033] stroke-[2.5]" /> Edit</DropdownMenuItem>
                                              <DropdownMenuSeparator className="bg-[#E6DFC8]" />
                                              <DropdownMenuItem className="py-3 text-[13px] text-red-600 font-medium focus:text-red-600" onClick={() => removeBadge(info.id)}><Trash2 className="w-4 h-4 mr-3 text-red-500 stroke-[2.5]" /> Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                        <div className="absolute top-1.5 right-1.5 hidden sm:flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button variant="ghost" className="p-1 h-auto text-[#5F624F] hover:text-[#5C4033]" onClick={() => setBadgeForm({ id: info.id, event_subtypes_id: s.id, title: info.title, description: info.description ?? "", icon: info.icon ?? "" })}><Edit2 className="w-3 h-3" /></Button>
                                          <Button variant="ghost" className="p-1 h-auto text-destructive hover:bg-destructive/10 rounded" onClick={() => removeBadge(info.id)}><Trash2 className="w-3 h-3" /></Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* ===== TYPE SHEET ===== */}
      <Sheet open={!!typeForm} onOpenChange={(o) => { if (!o) { setTypeForm(null); setError(null); } }}>
        <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_CLASS}>
          <SheetHeader title={typeForm?.id ? "Edit Category" : "New Category"} description="The top-level category for a group of events." />
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4">
            {typeForm && (
              <>
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                  <SectionLabel>Category</SectionLabel>
                  <TextField label="Name" required value={typeForm.name} placeholder="e.g. Music, Games..." onChange={(v) => setTypeForm({ ...typeForm, name: v })} />
                  <TextAreaField label="Description" value={typeForm.description} placeholder="Internal description (optional)" onChange={(v) => setTypeForm({ ...typeForm, description: v })} />
                  <ColorField label="Colour" value={typeForm.color} onChange={(c) => setTypeForm({ ...typeForm, color: c })} />
                </div>

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                  <SectionLabel>Booking Display</SectionLabel>
                  {/* Switching away from per_type clears the category-level bookable flag (it can't be edited there). */}
                  <GroupingSelector value={typeForm.booking_grouping} onChange={(v) => setTypeForm({ ...typeForm, booking_grouping: v, is_bookable: v === "per_type" ? typeForm.is_bookable : false })} />
                  {/* A per_type category owns one shared booking page for the whole category. */}
                  {typeForm.booking_grouping === "per_type" && (
                    <SwitchField label="Bookable" value={typeForm.is_bookable} onChange={(v) => setTypeForm({ ...typeForm, is_bookable: v })} />
                  )}
                </div>

                {/* Card branding lives on the category only when it owns the card (per_type). */}
                {typeForm.booking_grouping === "per_type" && (
                  <BookingCardSection value={typeForm} onChange={(patch) => setTypeForm({ ...typeForm, ...patch })} />
                )}

                {/* Shared booking page/form config for the whole category (per_type + bookable). */}
                {typeForm.booking_grouping === "per_type" && typeForm.is_bookable && (
                  <BookingConfigEditor value={typeForm.booking_config} onChange={(cfg) => setTypeForm({ ...typeForm, booking_config: cfg })} />
                )}
              </>
            )}
            {error && <ErrorBox message={error} />}
            <div className="h-4" />
          </div>
          <SheetFooter onCancel={() => { setTypeForm(null); setError(null); }} onSave={submitType} pending={isPending} saveLabel={typeForm?.id ? "Update" : "Save"} />
        </SheetContent>
      </Sheet>

      {/* ===== SUBTYPE SHEET ===== */}
      <Sheet open={!!subtypeForm} onOpenChange={(o) => { if (!o) { setSubtypeForm(null); setError(null); } }}>
        <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_CLASS}>
          <SheetHeader
            title={subtypeForm?.id ? "Edit Sub-Type" : "New Sub-Type"}
            description={`Within "${toTitleCase(types.find((t) => t.id === subtypeForm?.event_types_id)?.name)}".`}
          />
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4">
            {subtypeForm && (
              <>
                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                  <SectionLabel>Sub-Type</SectionLabel>
                  <TextField label="Name" required value={subtypeForm.name} placeholder="e.g. Quiz" onChange={(v) => setSubtypeForm({ ...subtypeForm, name: v })} />
                  <TextField label="Default Title" value={subtypeForm.default_event_title} placeholder="e.g. Quiz Night" onChange={(v) => setSubtypeForm({ ...subtypeForm, default_event_title: v })} />
                  <TextAreaField label="Tagline" value={subtypeForm.tagline} placeholder="Shown on the public booking page..." onChange={(v) => setSubtypeForm({ ...subtypeForm, tagline: v })} />
                  <ColorField label="Colour" value={subtypeForm.color} onChange={(c) => setSubtypeForm({ ...subtypeForm, color: c })} />
                </div>

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                  <SectionLabel>Behaviour</SectionLabel>
                  <BehaviorSelector value={subtypeForm.behavior} onChange={(v) => setSubtypeForm({ ...subtypeForm, behavior: v })} />
                </div>

                <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                  <SectionLabel>Booking Defaults</SectionLabel>
                  {/* A sub-type owns a shared booking page only when its category groups per_subtype. */}
                  {types.find((t) => t.id === subtypeForm.event_types_id)?.booking_grouping === "per_subtype" && (
                    <SwitchField label="Bookable" value={subtypeForm.is_bookable} onChange={(v) => setSubtypeForm({ ...subtypeForm, is_bookable: v })} />
                  )}
                  <SwitchField label="Host" value={subtypeForm.host_required} onChange={(v) => setSubtypeForm({ ...subtypeForm, host_required: v })} />
                  <SwitchField label="Seating" value={subtypeForm.seating_required} onChange={(v) => setSubtypeForm({ ...subtypeForm, seating_required: v })} />
                  <SwitchField label="Payment" value={subtypeForm.payment_required} onChange={(v) => setSubtypeForm({ ...subtypeForm, payment_required: v })} />
                  {subtypeForm.payment_required && (
                    <NumberField label="Default Amount (£)" value={subtypeForm.default_payment_amount} placeholder="0.00" onChange={(v) => setSubtypeForm({ ...subtypeForm, default_payment_amount: v })} />
                  )}
                </div>

                {subtypeForm.is_bookable &&
                  types.find((t) => t.id === subtypeForm.event_types_id)?.booking_grouping === "per_subtype" && (
                    <BookingConfigEditor value={subtypeForm.booking_config} onChange={(cfg) => setSubtypeForm({ ...subtypeForm, booking_config: cfg })} />
                  )}

                {/* Card branding lives on the sub-type only when its category groups per_subtype and it's bookable. */}
                {subtypeForm.is_bookable &&
                  types.find((t) => t.id === subtypeForm.event_types_id)?.booking_grouping === "per_subtype" && (
                    <BookingCardSection value={subtypeForm} onChange={(patch) => setSubtypeForm({ ...subtypeForm, ...patch })} />
                  )}
              </>
            )}
            {error && <ErrorBox message={error} />}
            <div className="h-4" />
          </div>
          <SheetFooter onCancel={() => { setSubtypeForm(null); setError(null); }} onSave={submitSubtype} pending={isPending} saveLabel={subtypeForm?.id ? "Update" : "Save"} />
        </SheetContent>
      </Sheet>

      {/* ===== BADGE SHEET ===== */}
      <Sheet open={!!badgeForm} onOpenChange={(o) => { if (!o) { setBadgeForm(null); setError(null); } }}>
        <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_CLASS}>
          <SheetHeader title={badgeForm?.id ? "Edit Badge" : "New Badge"} description="An icon and label shown on booking pages." />
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 min-h-0 touch-pan-y space-y-4">
            {badgeForm && (
              <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
                <TextField label="Title" required value={badgeForm.title} placeholder="e.g. Every Thursday" onChange={(v) => setBadgeForm({ ...badgeForm, title: v })} />
                <TextField label="Description" value={badgeForm.description} placeholder="e.g. 8:00PM start" onChange={(v) => setBadgeForm({ ...badgeForm, description: v })} />
                <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">Icon</span>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                    {Object.entries(ICON_OPTIONS).map(([name, IconComponent]) => (
                      <button
                        key={name} title={name} type="button"
                        onClick={() => setBadgeForm({ ...badgeForm, icon: name })}
                        className={cn(
                          "flex items-center justify-center aspect-square rounded-xl border transition-all duration-200 active:scale-95",
                          badgeForm.icon === name
                            ? "bg-[#5C4033] text-white border-[#5C4033] shadow-md ring-2 ring-[#5C4033]/20 scale-105"
                            : "hover:bg-[#F7F4EA] bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#5C4033]/30"
                        )}
                      >
                        <IconComponent className="w-5 h-5 sm:w-4 sm:h-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {error && <ErrorBox message={error} />}
            <div className="h-4" />
          </div>
          <SheetFooter onCancel={() => { setBadgeForm(null); setError(null); }} onSave={submitBadge} pending={isPending} saveLabel={badgeForm?.id ? "Update" : "Save"} />
        </SheetContent>
      </Sheet>

      {ConfirmDialogUI}
    </div>
  );
}

// ===== Shared bits =====

const SHEET_CLASS = "bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh] flex flex-col outline-none shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140 sm:h-auto sm:max-h-[80vh] sm:rounded-4xl sm:bottom-6 sm:border-2 sm:border-[#E6DFC8]";

function SheetHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-4xl">
      <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight">{title}</SheetTitle>
      <SheetDescription className="text-xs text-[#5F624F] mt-1">{description}</SheetDescription>
    </div>
  );
}

function SheetFooter({ onCancel, onSave, pending, saveLabel }: { onCancel: () => void; onSave: () => void; pending: boolean; saveLabel: string }) {
  return (
    <div className="shrink-0 px-6 py-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-4xl">
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending} className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white hover:bg-[#F7F4EA]">Cancel</Button>
        <Button type="button" disabled={pending} onClick={onSave} className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[#E6DFC8]/60"><span className="text-[11px] font-black uppercase tracking-wide text-[#5C4033]">{children}</span></div>;
}

function TextField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
        {required && <span className="text-red-500 text-[10px] font-black">*</span>}
      </div>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={label} className="text-base sm:text-sm font-bold text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      <input type="number" min="0" step="0.01" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={label} className="text-base sm:text-sm font-bold text-[#1F1F1A] text-right flex-1 bg-transparent outline-none placeholder:text-[#5F624F]/40" />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 text-[#5F624F] opacity-60 mb-2">
        <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
      </div>
      <textarea value={value} placeholder={placeholder} rows={2} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-full text-base sm:text-sm font-bold text-[#1F1F1A] bg-transparent outline-none placeholder:text-[#5F624F]/40 resize-none" />
    </div>
  );
}

function SwitchField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-4">
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#5F624F] opacity-60 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <span className={cn("text-[10px] font-black uppercase tracking-wide", value ? "text-green-600" : "text-[#5F624F]")}>{value ? "On" : "Off"}</span>
        <button type="button" title={`Toggle ${label}`} onClick={() => onChange(!value)} className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0 border", value ? "bg-green-500 border-green-600" : "bg-[#5F624F]/20 border-[#5F624F]/30")}>
          <span className={cn("absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", value ? "translate-x-5" : "translate-x-0")} />
        </button>
      </div>
    </div>
  );
}

function BehaviorSelector({ value, onChange }: { value: EventBehavior; onChange: (v: EventBehavior) => void }) {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">Pick one — what kind of night this is</span>
      <div className="flex flex-wrap gap-2">
        {BEHAVIOR_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all active:scale-95",
              value === o.value
                ? "bg-[#5C4033] text-white border-[#5C4033] shadow-md"
                : "bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#5C4033]/30"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupingSelector({ value, onChange }: { value: BookingGrouping; onChange: (v: BookingGrouping) => void }) {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">How this category&apos;s events show on the public booking hub</span>
      <div className="flex flex-wrap gap-2">
        {BOOKING_GROUPING_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all active:scale-95",
              value === o.value
                ? "bg-[#5C4033] text-white border-[#5C4033] shadow-md"
                : "bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#5C4033]/30"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[#5F624F] leading-relaxed">
        {value === "per_event" && "One card per event — each date links to its own booking page."}
        {value === "per_subtype" && "One card per sub-type — all dates of a sub-type share one page with a date dropdown."}
        {value === "per_type" && "One card for the whole category — all its events share one page with a date dropdown."}
      </p>
    </div>
  );
}

function BookingCardSection({ value, onChange }: { value: CardForm; onChange: (patch: Partial<CardForm>) => void }) {
  return (
    <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden divide-y divide-[#E6DFC8]">
      <SectionLabel>Booking Card</SectionLabel>
      <div className="px-4 sm:px-5 pt-2 -mb-1">
        <p className="text-[10px] text-[#5F624F] leading-relaxed">Shown on the public booking hub card. Blank fields fall back to the title, a calendar icon, and the auto badge.</p>
      </div>
      <TextField label="Card Title" value={value.booking_card_title} placeholder="e.g. Music Bingo" onChange={(v) => onChange({ booking_card_title: v })} />
      <TextAreaField label="Card Tagline" value={value.booking_card_tagline} placeholder="Short line shown under the title..." onChange={(v) => onChange({ booking_card_tagline: v })} />
      <TextField label="Card Badge" value={value.booking_card_badge} placeholder="e.g. Thursdays, Book Now" onChange={(v) => onChange({ booking_card_badge: v })} />
      <IconPicker label="Card Icon" value={value.booking_card_icon} onChange={(name) => onChange({ booking_card_icon: name })} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
      <span className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] opacity-60">{label}</span>
      <div className="flex flex-wrap gap-2 items-center">
        {EVENT_TYPE_COLORS.map((c) => (
          <button key={c.key} type="button" onClick={() => onChange(value === c.key ? null : c.key)} title={c.key}
            className={cn("w-7 h-7 rounded-full transition-all", c.swatchClass, value === c.key ? "swatch-selected scale-110" : "opacity-70 hover:opacity-100")} />
        ))}
        <button type="button" onClick={() => onChange(null)} title="default" className={cn("w-7 h-7 rounded-full bg-[#F7F4EA] transition-all", !value ? "swatch-selected scale-110" : "opacity-70 hover:opacity-100")} />
      </div>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 bg-white border border-[#E6DFC8] rounded-lg">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#5F624F] mb-1">{label}</p>
      <p className="text-xs text-[#1F1F1A] leading-relaxed">{value}</p>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg bg-[#E6DFC8]/60 text-[#5C4033] border border-[#E6DFC8]">{label}</span>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <p className="text-[11px] text-red-600 font-bold leading-snug">{message}</p>
    </div>
  );
}
