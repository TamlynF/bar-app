"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Edit2, Trash2, Layers, Info, Loader2, Ghost,
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Beer,
  ChevronDown, Banknote, Trophy, Wine, Speaker, User,
  Search, X, SlidersHorizontal, Ticket, Armchair, PoundSterling, Disc3, Mic, Tag, Check, 
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
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EVENT_TYPE_COLORS, colorHexFromKey } from "@/lib/event-type-colors";
import { BookingConfigEditor } from "@/components/booking-config-editor";
import type { BookingConfig } from "@/lib/booking-config";
import { BEHAVIOR_OPTIONS, type EventBehavior } from "@/lib/event-behavior";
import { BOOKING_GROUPING_OPTIONS, type BookingGrouping } from "@/lib/booking-grouping";
import { IconPicker } from "@/components/icon-picker";

const ICON_OPTIONS = {
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle,
  Music, Utensils, GlassWater, Heart, Smile, Sparkles, AlertCircle, Info,
  Beer, Banknote, Trophy, Wine, Speaker, User, Disc3, Mic, Tag, Check, Ghost,
};

/** Lucide icon per sub-category behaviour. */
const BEHAVIOR_ICON: Record<EventBehavior, React.ComponentType<{ className?: string }>> = {
  standard: Sparkles, quiz: Trophy, bingo: Disc3, karaoke: Mic, music_act: Music, private: Users,
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
  title: string | null;
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
  title: string | null;
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

type BadgeDraft = { id?: number; title: string; description: string; icon: string | null };

type TypeForm = {
  id?: number;
  name: string;
  title: string;
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
  title: string;
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
  badges: BadgeDraft[];
} & CardForm;

type BadgeForm = { id?: number; event_subtypes_id: number; subName: string; title: string; description: string; icon: string };

type Filters = { q: string; category: number | "all"; behavior: EventBehavior | "all"; bookable: boolean; hasBadges: boolean };
const EMPTY_FILTERS: Filters = { q: "", category: "all", behavior: "all", bookable: false, hasBadges: false };

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

/** CSS custom properties driving a category card's tint (header bg + name + accent). */
const catVars = (color: string | null): React.CSSProperties => {
  const c = colorHexFromKey(color);
  return { "--accent": c.solid, "--cat-bg": c.bg, "--cat-text": c.text } as React.CSSProperties;
};

/** CSS custom properties driving a sub-category card's tint (accent + name + badge icon). */
const subVars = (color: string | null): React.CSSProperties => {
  const c = colorHexFromKey(color);
  return { "--accent": c.solid, "--sub-bg": c.bg, "--sub-text": c.text, "--sub-border": c.border } as React.CSSProperties;
};

/** Filtered view of the categories driven by the filter bar. */
function applyFilters(types: EventTypeRecord[], f: Filters): EventTypeRecord[] {
  const q = f.q.trim().toLowerCase();
  return types
    .filter((t) => f.category === "all" || t.id === f.category)
    .map((t) => {
      const catMatch = !!q && t.name.toLowerCase().includes(q);
      const subs = [...(t.event_subtypes ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((s) => {
          if (f.behavior !== "all" && s.behavior !== f.behavior) return false;
          if (f.bookable && !s.is_bookable) return false;
          if (f.hasBadges && !(s.event_subtype_badges?.length)) return false;
          if (q && !catMatch) {
            const hay = (
              s.name + " " + t.name + " " +
              (s.event_subtype_badges ?? []).map((b) => b.title + " " + (b.description ?? "")).join(" ")
            ).toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
      return { ...t, event_subtypes: subs };
    })
    .filter((t) => t.event_subtypes.length > 0 || f.category !== "all");
}

export default function EventTypesClient({ initialEventTypes = [] }: { initialEventTypes: EventTypeRecord[] }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const [typeForm, setTypeForm] = useState<TypeForm | null>(null);
  const [subtypeForm, setSubtypeForm] = useState<SubtypeForm | null>(null);
  const [badgeForm, setBadgeForm] = useState<BadgeForm | null>(null);

  const [error, setError] = useState<string | null>(null);

  const types = useMemo(
    () => [...initialEventTypes].sort((a, b) => a.name.localeCompare(b.name)),
    [initialEventTypes],
  );
  const filtered = useMemo(() => applyFilters(types, filters), [types, filters]);

  const toggleCollapse = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ---- Open helpers ----
  const openNewType = () =>
    setTypeForm({ name: "", title: "", description: "", color: null, booking_grouping: "per_event", is_bookable: false, booking_config: {}, ...EMPTY_CARD });

  const openEditType = (t: EventTypeRecord) =>
    setTypeForm({
      id: t.id, name: toTitleCase(t.name), title: t.title ?? "", description: t.description ?? "", color: t.color ?? null,
      booking_grouping: t.booking_grouping ?? "per_event",
      is_bookable: t.is_bookable, booking_config: t.booking_config ?? {},
      ...cardFromRecord(t),
    });

  const openNewSubtype = (t: EventTypeRecord) =>
    setSubtypeForm({
      event_types_id: t.id, name: "", title: "", default_event_title: "", tagline: "", color: null,
      behavior: "standard",
      is_bookable: false, host_required: false, seating_required: true, payment_required: false,
      default_payment_amount: "", booking_config: {}, badges: [],
      ...EMPTY_CARD,
    });

  const openEditSubtype = (s: Subtype) =>
    setSubtypeForm({
      id: s.id, event_types_id: s.event_types_id, name: toTitleCase(s.name), title: s.title ?? "",
      default_event_title: s.default_event_title ?? "", tagline: s.tagline ?? "", color: s.color ?? null,
      behavior: s.behavior,
      is_bookable: s.is_bookable, host_required: s.host_required, seating_required: s.seating_required,
      payment_required: s.payment_required, default_payment_amount: s.default_payment_amount != null ? String(s.default_payment_amount) : "",
      booking_config: s.booking_config ?? {},
      badges: (s.event_subtype_badges ?? []).map((b) => ({ id: b.id, title: b.title, description: b.description ?? "", icon: b.icon })),
      ...cardFromRecord(s),
    });

  // ---- Submit handlers ----
  const submitType = () => {
    if (!typeForm) return;
    if (!typeForm.name.trim()) { setError("Category name is required."); return; }
    if (typeForm.booking_grouping === "per_type" && !typeForm.title.trim()) { setError("Title is required for a per-category booking page."); return; }
    const fd = new FormData();
    if (typeForm.id) fd.set("id", String(typeForm.id));
    fd.set("name", typeForm.name);
    fd.set("title", typeForm.title);
    fd.set("description", typeForm.description);
    fd.set("color", typeForm.color ?? "");
    fd.set("booking_grouping", typeForm.booking_grouping);
    fd.set("is_bookable", typeForm.booking_grouping === "per_type" && typeForm.is_bookable ? "on" : "");
    fd.set("booking_config", JSON.stringify(typeForm.booking_config));
    appendCardFields(fd, typeForm);
    setError(null);
    startTransition(async () => {
      const res = await saveTypeAction(fd);
      if (res?.error) setError(res.error);
      else { toast.success(typeForm.id ? "Category updated" : "Category created"); setTypeForm(null); }
    });
  };

  const submitSubtype = () => {
    if (!subtypeForm) return;
    if (!subtypeForm.name.trim()) { setError("Sub-category name is required."); return; }
    const parent = types.find((t) => t.id === subtypeForm.event_types_id);
    if (parent?.booking_grouping === "per_subtype" && !subtypeForm.title.trim()) { setError("Title is required for a per-sub-category booking page."); return; }
    const fd = new FormData();
    if (subtypeForm.id) fd.set("id", String(subtypeForm.id));
    fd.set("event_types_id", String(subtypeForm.event_types_id));
    fd.set("name", subtypeForm.name);
    fd.set("title", subtypeForm.title);
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
    fd.set("badges", JSON.stringify(subtypeForm.badges.filter((b) => b.title.trim())));
    appendCardFields(fd, subtypeForm);
    setError(null);
    startTransition(async () => {
      const res = await saveSubtypeAction(fd);
      if (res?.error) setError(res.error);
      else { toast.success(subtypeForm.id ? "Sub-category updated" : "Sub-category created"); setSubtypeForm(null); }
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
      if (res?.error) setError(res.error);
      else { toast.success(badgeForm.id ? "Badge updated" : "Badge added"); setBadgeForm(null); }
    });
  };

  const removeType = async (t: EventTypeRecord) => {
    const ok = await confirm({
      title: `Delete "${toTitleCase(t.name)}"`,
      description: "This deletes the category and all its sub-categories and badges.",
      confirmLabel: "Delete", variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteTypeAction(t.id);
      if (res?.error) toast.error(res.error); else toast.success("Category deleted");
    });
  };

  const removeSubtype = async (s: Subtype) => {
    const ok = await confirm({
      title: `Delete "${toTitleCase(s.name)}"`,
      description: "This deletes the sub-category and its badges.",
      confirmLabel: "Delete", variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteSubtypeAction(s.id);
      if (res?.error) toast.error(res.error); else toast.success("Sub-category deleted");
    });
  };

  const removeBadge = (id: number) => {
    startTransition(async () => {
      const res = await deleteBadgeAction(id);
      if (res?.error) toast.error(res.error); else toast.success("Badge deleted");
    });
  };

  const hasAny = types.length > 0;

  // Live per-field validation for the open sheet. Recomputed each render so messages
  // appear inline under the offending field and Save can be disabled until resolved.
  const typeErrors: { name?: string; title?: string } = {};
  if (typeForm) {
    if (!typeForm.name.trim()) typeErrors.name = "Category name is required.";
    if (typeForm.booking_grouping === "per_type" && !typeForm.title.trim()) typeErrors.title = "Title is required for a per-category booking page.";
  }
  const typeHasErrors = Object.keys(typeErrors).length > 0;

  const subtypeParent = subtypeForm ? types.find((t) => t.id === subtypeForm.event_types_id) : undefined;
  const subtypeOwnsBookingPage = subtypeParent?.booking_grouping === "per_subtype";
  const subtypeErrors: { name?: string; title?: string } = {};
  if (subtypeForm) {
    if (!subtypeForm.name.trim()) subtypeErrors.name = "Sub-category name is required.";
    if (subtypeOwnsBookingPage && !subtypeForm.title.trim()) subtypeErrors.title = "Title is required for a per-sub-category booking page.";
  }
  const subtypeHasErrors = Object.keys(subtypeErrors).length > 0;

  const badgeErrors: { title?: string } = {};
  if (badgeForm && !badgeForm.title.trim()) badgeErrors.title = "Badge title is required.";
  const badgeHasErrors = Object.keys(badgeErrors).length > 0;

  return (
    <div className="space-y-4 px-2 sm:px-4 md:px-6 py-3 max-w-3xl">
      {/* Header */}
      <div className="flex justify-between items-center gap-3">
        <p className="font-medium text-[#5F624F] text-[13px]">Manage your event categories and sub-categories.</p>
        <button
          type="button"
          onClick={openNewType}
          className="flex items-center gap-1.5 bg-[#1B4332] hover:bg-[#1B4332]/85 px-4 rounded-[10px] h-9 text-white transition-colors shrink-0"
        >
          <Plus className="stroke-[2.5] w-3.5 h-3.5" />
          <span className="font-black text-[11px] uppercase tracking-widest">Category</span>
        </button>
      </div>

      {hasAny && <FilterBar filters={filters} setFilters={setFilters} types={types} />}

      <div className="flex flex-col gap-3">
        {!hasAny ? (
          <div className="px-5 py-12 text-[#5F624F] text-center">
            <Layers className="opacity-40 mx-auto mb-2.5 w-8 h-8" />
            <p className="font-black text-[#1F1F1A] text-sm">No Event Categories</p>
            <p className="text-xs">Add your first category to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-[#5F624F] text-center">
            <Search className="opacity-40 mx-auto mb-2.5 w-6.5 h-6.5" />
            <p className="font-black text-[#1F1F1A] text-sm">Nothing matches your filters</p>
            <p className="text-xs">Try clearing the search or filters.</p>
          </div>
        ) : (
          filtered.map((t) => {
            const open = !collapsed.has(t.id);
            const subtypes = t.event_subtypes;
            const catBookable = t.booking_grouping === "per_type" && t.is_bookable;
            return (
              <section
                key={t.id}
                style={catVars(t.color)}
                className="bg-[#FFFDF7] border border-[#E6DFC8] rounded-2xl overflow-hidden"
              >
                {/* Category header */}
                <header className="flex items-center gap-2 px-4 py-3 bg-(--cat-bg) sm:px-5">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(t.id)}
                    className="flex flex-wrap flex-1 items-center gap-2.5 min-w-0 text-left"
                  >
                    <span className="font-black text-[15px] tracking-[0.04em] whitespace-nowrap text-(--cat-text) uppercase">
                      {toTitleCase(t.name)}
                    </span>
                    <span className="font-black text-[#5F624F] text-xs">({subtypes.length})</span>
                    {catBookable && <BookingMark title="Bookable · one booking page for the whole category" />}
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openNewSubtype(t)}
                      aria-label="Add sub-category"
                      className="flex items-center gap-1.5 bg-[#1B4332] hover:bg-[#1B4332]/85 px-2.5 rounded-lg h-9 sm:h-7 text-white transition-colors"
                    >
                      <Plus className="stroke-[2.5] w-3.5 h-3.5" />
                      <span className="hidden sm:inline font-black text-[10px] uppercase tracking-widest">Sub-Category</span>
                    </button>
                    <IconBtn label="Edit category" onClick={() => openEditType(t)}><Edit2 className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn label="Delete category" danger onClick={() => removeType(t)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn label="Toggle category" onClick={() => toggleCollapse(t.id)}>
                      <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
                    </IconBtn>
                  </div>
                </header>

                {/* Sub-categories — badges always visible inline */}
                {open && (
                  <div className="flex flex-col gap-2 px-3 sm:px-4 pt-1 pb-3.5">
                    {subtypes.length === 0 && (
                      <p className="px-1 py-1.5 text-[#5F624F] text-xs italic">No sub-categories match.</p>
                    )}
                    {subtypes.map((s) => {
                      const badges = s.event_subtype_badges ?? [];
                      const subBookable = s.is_bookable && t.booking_grouping === "per_subtype";
                      return (
                        <div
                          key={s.id}
                          style={subVars(s.color)}
                          className="bg-[#F7F4EA] border border-[#E6DFC8] border-l-[3px] border-l-accent rounded-xl overflow-hidden"
                        >
                          <div className="flex items-start justify-between gap-2.5 px-3 py-2.5 bg-[color-mix(in_srgb,var(--sub-bg)_45%,#fff)] border-b border-(--sub-border) sm:px-3.5">
                            <div className="flex flex-wrap flex-1 items-center gap-2.5 min-w-0">
                              <span className="font-black text-[14px] tracking-[0.01em] whitespace-nowrap text-(--sub-text) capitalize">
                                {toTitleCase(s.name)}
                              </span>
                              {subBookable && <BookingMark title="Bookable · one booking page per sub-category" />}
                              {t.booking_grouping === "per_event" && <BookingMark inverted title="Booked per individual event" />}
                              <FlagDots s={s} />
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <IconBtn label="Edit sub-category" onClick={() => openEditSubtype(s)}><Edit2 className="w-3.5 h-3.5" /></IconBtn>
                              <IconBtn label="Delete sub-category" danger onClick={() => removeSubtype(s)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                            </div>
                          </div>

                          {/* Always-visible badge chips + inline add */}
                          <div className="flex flex-wrap gap-2 px-3 sm:px-3.5 py-3">
                            {badges.map((bg) => (
                              <BadgeChip
                                key={bg.id}
                                badge={bg}
                                accent
                                onEdit={() => setBadgeForm({ id: bg.id, event_subtypes_id: s.id, subName: s.name, title: bg.title, description: bg.description ?? "", icon: bg.icon ?? "" })}
                                onDelete={() => removeBadge(bg.id)}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => setBadgeForm({ event_subtypes_id: s.id, subName: s.name, title: "", description: "", icon: "" })}
                              aria-label="Add badge"
                              className="inline-flex items-center gap-1.5 bg-[#E7EFEA] hover:bg-[#D7E5DD] px-2.5 py-1.5 border border-[#A9C4B7] hover:border-[#1B4332] rounded-[9px] font-black text-[#1B4332] text-[11px] hover:text-[#102A20] uppercase tracking-wide whitespace-nowrap transition-colors"
                            >
                              <Plus className="stroke-[2.5] w-3 h-3" />
                              <span className="hidden sm:inline">{badges.length === 0 ? "Add badge" : "Add"}</span>
                            </button>
                          </div>
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
          <SheetGrab />
          <SheetHead
            kicker="Category"
            title={typeForm?.id ? `Edit ${typeForm.name ? toTitleCase(typeForm.name) : "Category"}` : "New Category"}
            onClose={() => { setTypeForm(null); setError(null); }}
          />
          <div className="flex-1 space-y-3.5 px-4 sm:px-5 py-5 min-h-0 overflow-y-auto touch-pan-y">
            {typeForm && (
              <>
                <CollapsibleCard title="Identity">
                  <FieldRow label="Name" required error={typeErrors.name}>
                    <SheetInput value={typeForm.name} placeholder="e.g. Games" onChange={(v) => setTypeForm({ ...typeForm, name: v })} />
                  </FieldRow>
                  <FieldCol label="Description">
                    <SheetTextarea value={typeForm.description} placeholder="Internal description (optional)" onChange={(v) => setTypeForm({ ...typeForm, description: v })} />
                  </FieldCol>
                  <FieldCol label="Colour">
                    <ColorSwatches value={typeForm.color} onChange={(c) => setTypeForm({ ...typeForm, color: c })} />
                  </FieldCol>
                </CollapsibleCard>

                <CollapsibleCard title="Booking display">
                  <FieldCol label="How events group on the booking hub">
                    <SegRow
                      options={BOOKING_GROUPING_OPTIONS.map((o) => o.value)}
                      value={typeForm.booking_grouping}
                      onChange={(v) => setTypeForm({ ...typeForm, booking_grouping: v, is_bookable: v === "per_type" ? typeForm.is_bookable : false })}
                      render={(v) => BOOKING_GROUPING_OPTIONS.find((o) => o.value === v)?.label ?? v}
                    />
                    <p className="text-[#5F624F] text-[11px] leading-relaxed">
                      {typeForm.booking_grouping === "per_event" && "One card per event — each date links to its own booking page."}
                      {typeForm.booking_grouping === "per_subtype" && "One card per sub-category — all dates share one page with a date dropdown."}
                      {typeForm.booking_grouping === "per_type" && "One card for the whole category — all its events share one page with a date dropdown."}
                    </p>
                  </FieldCol>
                  {typeForm.booking_grouping === "per_type" && (
                    <FieldRow label="Title" required error={typeErrors.title}>
                      <SheetInput value={typeForm.title} placeholder="e.g. Band applications" onChange={(v) => setTypeForm({ ...typeForm, title: v })} />
                    </FieldRow>
                  )}
                  {typeForm.booking_grouping === "per_type" && (
                    <ToggleRow label="Bookable" sub="Customers can book the whole category online" value={typeForm.is_bookable} onChange={(v) => setTypeForm({ ...typeForm, is_bookable: v })} />
                  )}
                </CollapsibleCard>

                {typeForm.booking_grouping === "per_type" && typeForm.is_bookable && (
                  <BookingGroup>
                    <BookingCardSection value={typeForm} onChange={(patch) => setTypeForm({ ...typeForm, ...patch })} />
                    <BookingConfigEditor value={typeForm.booking_config} onChange={(cfg) => setTypeForm({ ...typeForm, booking_config: cfg })} />
                  </BookingGroup>
                )}
              </>
            )}
            {error && <ErrorBox message={error} />}
          </div>
          <SheetFooter onCancel={() => { setTypeForm(null); setError(null); }} onSave={submitType} pending={isPending} disableSave={typeHasErrors} saveLabel={typeForm?.id ? "Save changes" : "Create"} />
        </SheetContent>
      </Sheet>

      {/* ===== SUBTYPE SHEET ===== */}
      <Sheet open={!!subtypeForm} onOpenChange={(o) => { if (!o) { setSubtypeForm(null); setError(null); } }}>
        <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_CLASS}>
          <SheetGrab />
          <SheetHead
            kicker={`Sub-category in ${toTitleCase(types.find((t) => t.id === subtypeForm?.event_types_id)?.name)}`}
            title={subtypeForm?.id ? `Edit ${subtypeForm.name ? toTitleCase(subtypeForm.name) : "Sub-Category"}` : "New Sub-Category"}
            onClose={() => { setSubtypeForm(null); setError(null); }}
          />
          <div className="flex-1 space-y-3.5 px-4 sm:px-5 py-5 min-h-0 overflow-y-auto touch-pan-y">
            {subtypeForm && (() => {
              const parent = types.find((t) => t.id === subtypeForm.event_types_id);
              const ownsBookingPage = parent?.booking_grouping === "per_subtype";
              return (
                <>
                  <CollapsibleCard title="Identity">
                    <FieldRow label="Name" required error={subtypeErrors.name}>
                      <SheetInput value={subtypeForm.name} placeholder="e.g. Quiz" onChange={(v) => setSubtypeForm({ ...subtypeForm, name: v })} />
                    </FieldRow>
                    {ownsBookingPage && (
                      <FieldRow label="Title" required error={subtypeErrors.title}>
                        <SheetInput value={subtypeForm.title} placeholder="e.g. Quiz Night" onChange={(v) => setSubtypeForm({ ...subtypeForm, title: v })} />
                      </FieldRow>
                    )}
                    <FieldRow label="Default Title">
                      <SheetInput value={subtypeForm.default_event_title} placeholder="e.g. Thursday Quiz Night" onChange={(v) => setSubtypeForm({ ...subtypeForm, default_event_title: v })} />
                    </FieldRow>
                    <FieldCol label="Tagline">
                      <SheetTextarea value={subtypeForm.tagline} placeholder="Shown on the public booking page…" onChange={(v) => setSubtypeForm({ ...subtypeForm, tagline: v })} />
                    </FieldCol>
                    <FieldCol label="Colour">
                      <ColorSwatches value={subtypeForm.color} onChange={(c) => setSubtypeForm({ ...subtypeForm, color: c })} />
                    </FieldCol>
                  </CollapsibleCard>

                  <CollapsibleCard title="Behaviour">
                    <FieldCol label="What kind of night this is">
                      <BehaviorGrid value={subtypeForm.behavior} onChange={(v) => setSubtypeForm({ ...subtypeForm, behavior: v })} />
                    </FieldCol>
                  </CollapsibleCard>

                  <CollapsibleCard title="Requirements">
                    {ownsBookingPage && (
                      <ToggleRow label="Bookable" sub="Customers can book this online" value={subtypeForm.is_bookable} onChange={(v) => setSubtypeForm({ ...subtypeForm, is_bookable: v })} />
                    )}
                    <ToggleRow label="Host" value={subtypeForm.host_required} onChange={(v) => setSubtypeForm({ ...subtypeForm, host_required: v })} />
                    <ToggleRow label="Seating" value={subtypeForm.seating_required} onChange={(v) => setSubtypeForm({ ...subtypeForm, seating_required: v })} />
                    <ToggleRow label="Payment" value={subtypeForm.payment_required} onChange={(v) => setSubtypeForm({ ...subtypeForm, payment_required: v })} />
                    {subtypeForm.payment_required && (
                      <FieldRow label="Default Amount (£)">
                        <SheetInput type="number" value={subtypeForm.default_payment_amount} placeholder="0.00" onChange={(v) => setSubtypeForm({ ...subtypeForm, default_payment_amount: v })} />
                      </FieldRow>
                    )}
                  </CollapsibleCard>

                  {subtypeForm.is_bookable && ownsBookingPage && (
                    <BookingGroup>
                      <BookingCardSection value={subtypeForm} onChange={(patch) => setSubtypeForm({ ...subtypeForm, ...patch })} />
                      <BookingConfigEditor value={subtypeForm.booking_config} onChange={(cfg) => setSubtypeForm({ ...subtypeForm, booking_config: cfg })} />
                    </BookingGroup>
                  )}

                  <CollapsibleCard
                    title="Display badges"
                    count={subtypeForm.badges.length}
                    action={
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSubtypeForm({ ...subtypeForm, badges: [...subtypeForm.badges, { title: "", description: "", icon: "Star" }] }); }}
                        className="inline-flex items-center gap-1 bg-[#1B4332] hover:bg-[#1B4332]/85 px-2.5 py-1.5 rounded-lg font-black text-[10px] text-white uppercase tracking-widest"
                      >
                        <Plus className="stroke-[2.5] w-3 h-3" /> Add
                      </button>
                    }
                    bodyClassName="p-3.5 flex flex-col gap-2.5"
                  >
                    <p className="text-[#5F624F] text-[11px] leading-relaxed">Shown on this sub-category&apos;s booking page. Each badge is an icon, a title and an optional line of detail.</p>
                    {subtypeForm.badges.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-5 text-[#5F624F]">
                        <Tag className="opacity-40 w-5 h-5" />
                        <span className="font-bold text-xs">No badges yet</span>
                        <button type="button" onClick={() => setSubtypeForm({ ...subtypeForm, badges: [{ title: "", description: "", icon: "Star" }] })} className="hover:bg-[#E7EFEA] px-4 py-2 border border-[#A9C4B7] hover:border-[#1B4332] border-dashed rounded-[9px] font-black text-[#1B4332] text-[11px] uppercase tracking-wide">Add the first badge</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {subtypeForm.badges.map((bg, i) => (
                          <BadgeEditorRow
                            key={i}
                            badge={bg}
                            onChange={(nb) => setSubtypeForm({ ...subtypeForm, badges: subtypeForm.badges.map((x, j) => (j === i ? nb : x)) })}
                            onDelete={() => setSubtypeForm({ ...subtypeForm, badges: subtypeForm.badges.filter((_, j) => j !== i) })}
                          />
                        ))}
                      </div>
                    )}
                  </CollapsibleCard>
                </>
              );
            })()}
            {error && <ErrorBox message={error} />}
          </div>
          <SheetFooter onCancel={() => { setSubtypeForm(null); setError(null); }} onSave={submitSubtype} pending={isPending} disableSave={subtypeHasErrors} saveLabel={subtypeForm?.id ? "Save changes" : "Create"} />
        </SheetContent>
      </Sheet>

      {/* ===== BADGE SHEET (quick single-badge editor from the list) ===== */}
      <Sheet open={!!badgeForm} onOpenChange={(o) => { if (!o) { setBadgeForm(null); setError(null); } }}>
        <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={cn(SHEET_CLASS, "sm:w-120")}>
          <SheetGrab />
          <SheetHead
            kicker={badgeForm ? `${toTitleCase(badgeForm.subName)} · badge` : "Badge"}
            title={badgeForm?.id ? "Edit Badge" : "New Badge"}
            onClose={() => { setBadgeForm(null); setError(null); }}
          />
          <div className="flex-1 space-y-3.5 px-4 sm:px-5 py-5 min-h-0 overflow-y-auto touch-pan-y">
            {badgeForm && (
              <>
                {/* Live preview */}
                <div className="flex justify-center py-1">
                  <BadgeChip badge={{ id: -1, title: badgeForm.title || "Badge title", description: badgeForm.description || null, icon: badgeForm.icon || null }} large />
                </div>
                <CollapsibleCard title="Badge">
                  <FieldRow label="Title" required error={badgeErrors.title}>
                    <SheetInput value={badgeForm.title} placeholder="e.g. Every Thursday" onChange={(v) => setBadgeForm({ ...badgeForm, title: v })} />
                  </FieldRow>
                  <FieldRow label="Description">
                    <SheetInput value={badgeForm.description} placeholder="e.g. 8:00PM start" onChange={(v) => setBadgeForm({ ...badgeForm, description: v })} />
                  </FieldRow>
                  <FieldCol label="Icon">
                    <IconGrid value={badgeForm.icon} onChange={(ic) => setBadgeForm({ ...badgeForm, icon: ic })} />
                  </FieldCol>
                </CollapsibleCard>
              </>
            )}
            {error && <ErrorBox message={error} />}
          </div>
          <SheetFooter onCancel={() => { setBadgeForm(null); setError(null); }} onSave={submitBadge} pending={isPending} disableSave={badgeHasErrors} saveLabel={badgeForm?.id ? "Save badge" : "Add badge"} />
        </SheetContent>
      </Sheet>

      {ConfirmDialogUI}
    </div>
  );
}

// ===== Filter bar =====

function FilterBar({ filters, setFilters, types }: { filters: Filters; setFilters: (f: Filters) => void; types: EventTypeRecord[] }) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const active =
    (filters.category !== "all" ? 1 : 0) + (filters.behavior !== "all" ? 1 : 0) +
    (filters.bookable ? 1 : 0) + (filters.hasBadges ? 1 : 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 bg-[#FFFDF7] px-3 py-1.5 pl-3 border border-[#E6DFC8] rounded-[13px]">
        <Search className="w-4.25 h-4.25 text-[#5F624F] shrink-0" />
        <input
          value={filters.q}
          aria-label="Search categories, sub-categories and badges"
          placeholder="Search types, sub-categories, badges…"
          onChange={(e) => set({ q: e.target.value })}
          className="flex-1 bg-transparent outline-none min-w-0 font-medium text-[#1F1F1A] placeholder:text-[#5F624F]/60 text-sm"
        />
        {filters.q && (
          <button type="button" aria-label="Clear search" onClick={() => set({ q: "" })} className="place-items-center grid hover:bg-[#F7F4EA] rounded-[7px] w-6 h-6 text-[#5F624F]">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Toggle filters"
          className={cn(
            "flex items-center gap-1.5 px-3 border rounded-[9px] h-8 font-black text-[11px] uppercase tracking-wide transition-colors shrink-0",
            open || active > 0 ? "border-[#5C4033] bg-[#5C4033] text-white" : "border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F] hover:border-[#5C4033]/40",
          )}
        >
          <SlidersHorizontal className="w-3.75 h-3.75" />
          <span>Filters</span>
          {active > 0 && <span className="place-items-center grid bg-white/25 px-1 rounded-full min-w-4 h-4 text-[10px] leading-none">{active}</span>}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3.5 bg-[#FFFDF7] p-3.5 border border-[#E6DFC8] rounded-[14px]">
          <FilterGroup label="Category">
            <FChip active={filters.category === "all"} onClick={() => set({ category: "all" })} label="All" />
            {types.map((c) => (
              <FChip key={c.id} active={filters.category === c.id} onClick={() => set({ category: c.id })} label={toTitleCase(c.name)} color={c.color} />
            ))}
          </FilterGroup>
          <FilterGroup label="Behaviour">
            <FChip active={filters.behavior === "all"} onClick={() => set({ behavior: "all" })} label="All" />
            {BEHAVIOR_OPTIONS.map((b) => (
              <FChip key={b.value} active={filters.behavior === b.value} onClick={() => set({ behavior: b.value })} label={b.label} />
            ))}
          </FilterGroup>
          <div className="flex flex-row flex-wrap items-center gap-2.5">
            <FToggle on={filters.bookable} onClick={() => set({ bookable: !filters.bookable })} label="Bookable only" />
            <FToggle on={filters.hasBadges} onClick={() => set({ hasBadges: !filters.hasBadges })} label="Has badges" />
            {active > 0 && (
              <button type="button" onClick={() => set({ category: "all", behavior: "all", bookable: false, hasBadges: false })} className="ml-auto font-black text-[#5C4033] text-[11px] hover:underline uppercase tracking-wide">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-black text-[#5F624F] text-[10px] uppercase tracking-[0.12em]">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string | null }) {
  const c = color ? colorHexFromKey(color) : null;
  const activeColorStyle = active && c ? ({ "--fb": c.bg, "--ft": c.text, "--fbd": c.border } as React.CSSProperties) : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={activeColorStyle}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-[9px] font-black text-[11px] transition-colors",
        active && c && "border-(--fbd) bg-(--fb) text-(--ft)",
        active && !c && "border-[#5C4033] bg-[#5C4033] text-white",
        !active && "border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F] hover:border-[#5C4033]",
      )}
    >
      {c && <span style={{ "--fd": c.solid } as React.CSSProperties} className="h-2 w-2 bg-(--fd) rounded-full" />}
      {label}
    </button>
  );
}

function FToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 font-bold text-[#1F1F1A] text-xs">
      <span className={cn("place-items-center grid border-[1.5px] rounded-md w-4.5 h-4.5 transition-colors", on ? "border-[#5C4033] bg-[#5C4033] text-white" : "border-[#E6DFC8] bg-[#F7F4EA]")}>
        {on && <Check className="stroke-3 w-3 h-3" />}
      </span>
      {label}
    </button>
  );
}

// ===== List display bits =====

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "place-items-center grid rounded-lg w-9 sm:w-7 h-9 sm:h-7 transition-colors shrink-0",
        danger ? "text-[#c0584d] hover:bg-[#fdecec] hover:text-[#DC2626]" : "text-[#5F624F] hover:bg-[#F7F4EA] hover:text-[#5C4033]",
      )}
    >
      {children}
    </button>
  );
}

function BadgeChip({ badge, accent, onEdit, onDelete, large }: { badge: Badge; accent?: boolean; onEdit?: () => void; onDelete?: () => void; large?: boolean }) {
  return (
    <span
      onClick={onEdit}
      title={onEdit ? "Edit badge" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 bg-[#FFFDF7] border border-[#E6DFC8] rounded-[9px] max-w-full",
        large ? "px-2.5 py-2" : "px-2.5 py-1.5 pl-1.5",
        onEdit && "cursor-pointer transition-colors hover:border-[#5C4033] hover:bg-[#F7F4EA]",
      )}
    >
      <span className={cn("place-items-center grid bg-[#F7F4EA] rounded-md shrink-0", large ? "h-6.5 w-6.5" : "h-5 w-5", accent ? "text-(--sub-text)" : "text-[#5C4033]")}>
        {renderBadgeIcon(badge.icon, large ? "w-3.75 h-3.75" : "w-3.25 h-3.25")}
      </span>
      <span className={cn("font-black text-[#1F1F1A] truncate whitespace-nowrap", large ? "text-sm" : "text-xs")}>{badge.title}</span>
      {badge.description && <span className="pl-1.5 border-[#E6DFC8] border-l text-[#5F624F] text-[11px] truncate whitespace-nowrap">{badge.description}</span>}
      {onDelete && (
        <button
          type="button"
          aria-label="Delete badge"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="place-items-center grid hover:bg-[#fdecec] ml-0.5 rounded-[5px] w-4.25 h-4.25 text-[#5F624F] hover:text-[#DC2626] shrink-0"
        >
          <X className="stroke-[2.5] w-3 h-3" />
        </button>
      )}
    </span>
  );
}

function FlagDots({ s }: { s: Subtype }) {
  const flags: { Icon: React.ComponentType<{ className?: string }>; label: string; tone: string }[] = [];
  if (s.host_required) flags.push({ Icon: User, label: "Host", tone: "bg-[#e0910e] border-[#e0910e] text-white" });
  if (s.seating_required) flags.push({ Icon: Armchair, label: "Seating", tone: "bg-[#0D9488] border-[#0D9488] text-white" });
  if (s.payment_required) flags.push({ Icon: PoundSterling, label: "Payment", tone: "bg-[#1F8A5B] border-[#1F8A5B] text-white" });
  if (!flags.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {flags.map(({ Icon, label, tone }) => (
        <span key={label} title={label} className={cn("place-items-center grid border rounded-md w-5.5 h-5.5", tone)}>
          <Icon className="w-2.75 h-2.75" />
        </span>
      ))}
    </span>
  );
}

/** Prominent ticket marker. `inverted` signals per-event booking (outlined). */
function BookingMark({ inverted = false, title = "Bookable" }: { inverted?: boolean; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center shrink-0">
      <span
        className={cn(
          "place-items-center grid rounded-[7px] w-5.75 h-5.75",
          inverted ? "border-[1.5px] border-[#862041] bg-white text-[#862041]" : "bg-[#862041] text-white shadow-[0_1px_4px_-1px_rgba(134,32,65,0.6)]",
        )}
      >
        <Ticket className="stroke-[2.2] w-3.25 h-3.25" />
      </span>
    </span>
  );
}

// ===== Sheet chrome =====

const SHEET_CLASS = "bg-[#F7F4EA] border-t border-[#E6DFC8] rounded-t-[28px] p-0 h-[92vh] flex flex-col outline-none shadow-2xl gap-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-165 sm:h-auto sm:max-h-[84vh] sm:rounded-[28px] sm:bottom-5.5 sm:border sm:border-[#E6DFC8]";

function SheetGrab() {
  return <div className="bg-[#E6DFC8] mx-auto mt-2.5 rounded-full w-10.5 h-1.25 shrink-0" />;
}

function SheetHead({ kicker, title, onClose }: { kicker: string; title: string; onClose: () => void }) {
  return (
    <div className="flex justify-between items-start gap-3 px-5 pt-3 pb-4 border-[#E6DFC8] border-b shrink-0">
      <div className="min-w-0">
        <SheetDescription className="mb-1 font-black text-[#5F624F] text-[10px] uppercase tracking-[0.13em]">{kicker}</SheetDescription>
        <SheetTitle className="font-black text-[#1F1F1A] text-[22px] uppercase leading-none tracking-tight">{title}</SheetTitle>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="place-items-center grid bg-[#F7F4EA] border border-[#E6DFC8] rounded-[10px] w-9 h-9 text-[#5F624F] hover:text-[#1F1F1A] shrink-0">
        <X className="w-4.5 h-4.5" />
      </button>
    </div>
  );
}

function SheetFooter({ onCancel, onSave, pending, saveLabel, disableSave }: { onCancel: () => void; onSave: () => void; pending: boolean; saveLabel: string; disableSave?: boolean }) {
  return (
    <div className="gap-2.5 grid grid-cols-2 bg-[#FFFDF7] px-4 sm:px-5 py-3.5 pb-8 border-[#E6DFC8] border-t shrink-0">
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={pending}
        className="bg-[#F7F4EA] hover:bg-[#EFEADD] border border-[#E6DFC8] hover:border-[#5C4033] rounded-xl h-12 font-black text-[#5F624F] hover:text-[#5C4033] text-xs uppercase tracking-wide"
      >
        Cancel
      </Button>
      <Button
        type="button"
        disabled={pending || disableSave}
        title={disableSave ? "Resolve the highlighted fields before saving" : undefined}
        onClick={onSave}
        className="bg-[#1B4332] hover:bg-[#2D5F49] disabled:opacity-50 rounded-xl h-12 font-black text-white text-xs uppercase tracking-wide disabled:pointer-events-none"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : saveLabel}
      </Button>
    </div>
  );
}

/** Collapsible white section card used across the sheets. */
function CollapsibleCard({ title, count, action, defaultOpen = true, bodyClassName, children }: {
  title: string; count?: number; action?: React.ReactNode; defaultOpen?: boolean; bodyClassName?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 bg-[#EFEADD] hover:bg-[#E6DFC8] pr-3 transition-colors">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-1.5 px-4 py-3 text-left">
          <span className="font-black text-[#5C4033] text-[11px] uppercase tracking-wide">{title}</span>
          {count != null && <span className="inline-grid place-items-center bg-[#5C4033] px-1.5 rounded-full min-w-4.5 h-4.5 text-[10px] text-white">{count}</span>}
        </button>
        {action}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Toggle ${title}`} className="place-items-center grid w-7 h-7 text-[#5F624F]">
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && <div className={bodyClassName ?? ""}>{children}</div>}
    </div>
  );
}

/** Green wrapper grouping the bookable-only booking page + form-field sections. */
function BookingGroup({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-2.5 bg-[#1F8A5B]/5 p-2.5 border-[#bfe3cf] border-[1.5px] rounded-[18px]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 px-1.5 pt-1 pb-0.5 font-black text-[#1F8A5B] text-[10px] uppercase tracking-widest">
        <span className="place-items-center grid bg-[#1F8A5B] rounded-md w-5 h-5 text-white shrink-0"><Ticket className="stroke-[2.2] w-3 h-3" /></span>
        <span>Booking setup</span>
        <span className="ml-auto font-bold text-[#1F8A5B]/70 normal-case tracking-normal">shown while bookable</span>
        <ChevronDown className={cn("w-4 h-4 text-[#1F8A5B] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

// ===== Field primitives =====

function FieldRow({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-[#E6DFC8] border-t first:border-t-0">
      <div className="flex items-center gap-3">
        <span className={cn("font-black text-[10px] uppercase tracking-wide shrink-0", error ? "text-[#DC2626]" : "text-[#5F624F]")}>
          {label}{required && <span className="ml-0.5 text-[#DC2626]">*</span>}
        </span>
        <div className="flex flex-1 justify-end min-w-0">{children}</div>
      </div>
      {error && <FieldError message={error} />}
    </div>
  );
}

function FieldCol({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-[#E6DFC8] border-t first:border-t-0">
      <span className={cn("font-black text-[10px] uppercase tracking-wide", error ? "text-[#DC2626]" : "text-[#5F624F]")}>{label}</span>
      {children}
      {error && <FieldError message={error} />}
    </div>
  );
}

/** Inline validation message shown under a field. */
function FieldError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1 mt-1.5 font-bold text-[#DC2626] text-[11px] leading-snug">
      <AlertCircle className="w-3 h-3 shrink-0" />
      {message}
    </p>
  );
}

function SheetInput({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: "text" | "number" }) {
  return (
    <input
      type={type ?? "text"}
      min={type === "number" ? "0" : undefined}
      step={type === "number" ? "0.01" : undefined}
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent outline-none w-full font-semibold text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-sm text-right"
    />
  );
}

function SheetTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      rows={2}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#F7F4EA] px-3 py-2.5 border border-[#E6DFC8] focus-visible:border-[#5C4033] rounded-[10px] outline-none focus-visible:ring-[#5C4033]/10 focus-visible:ring-[3px] w-full font-medium text-[#1F1F1A] placeholder:text-[#5F624F]/40 text-sm leading-relaxed resize-none"
    />
  );
}

/** Segmented control (e.g. booking grouping). */
function SegRow<T extends string>({ options, value, onChange, render }: { options: T[]; value: T; onChange: (v: T) => void; render?: (v: T) => string }) {
  return (
    <div className="flex gap-0.75 bg-[#F7F4EA] p-0.75 border border-[#E6DFC8] rounded-xl">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "flex-1 px-2 py-2.5 rounded-lg font-extrabold text-[11px] uppercase tracking-wide transition-colors",
            value === o ? "bg-[#5C4033] text-white" : "text-[#5F624F] hover:text-[#5C4033]",
          )}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex justify-between items-center gap-3 px-4 py-3 border-[#E6DFC8] border-t first:border-t-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-bold text-[#1F1F1A] text-[13px]">{label}</span>
        {sub && <span className="text-[#5F624F] text-[11px]">{sub}</span>}
      </div>
      <Switch value={value} onChange={onChange} label={label} />
    </div>
  );
}

function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={`Toggle ${label}`}
      onClick={() => onChange(!value)}
      className={cn("relative rounded-full w-11 h-6.25 transition-colors shrink-0", value ? "bg-[#22a356]" : "bg-[#d8d0bb]")}
    >
      <span className={cn("top-[2.5px] left-[2.5px] absolute bg-white shadow rounded-full w-5 h-5 transition-transform", value && "translate-x-4.75")} />
    </button>
  );
}

function BehaviorGrid({ value, onChange }: { value: EventBehavior; onChange: (v: EventBehavior) => void }) {
  return (
    <div className="gap-1.75 grid grid-cols-3">
      {BEHAVIOR_OPTIONS.map((o) => {
        const I = BEHAVIOR_ICON[o.value];
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-col items-center gap-1.5 px-1.5 py-2.5 border rounded-xl font-extrabold text-[10px] uppercase tracking-wide transition-colors",
              value === o.value
                ? "border-[#5C4033] bg-[#5C4033] text-white"
                : "border-[#E6DFC8] bg-[#F7F4EA] text-[#5F624F] hover:border-[#5C4033] hover:text-[#5C4033]",
            )}
          >
            <I className="w-3.75 h-3.75" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.75">
      {EVENT_TYPE_COLORS.map((c) => {
        const sel = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            title={c.key}
            aria-label={`Colour ${c.key}`}
            aria-pressed={sel}
            onClick={() => onChange(sel ? null : c.key)}
            style={{ "--sw": colorHexFromKey(c.key).solid } as React.CSSProperties}
            className={cn(
              "grid h-6.5 w-6.5 place-items-center rounded-full bg-(--sw) transition-transform hover:scale-110",
              sel ? "scale-110 ring-2 ring-[#5C4033] ring-offset-2 ring-offset-[#F7F4EA]" : "opacity-80 hover:opacity-100",
            )}
          >
            {sel && <Check className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] w-3.5 h-3.5 text-white" />}
          </button>
        );
      })}
    </div>
  );
}

function BookingCardSection({ value, onChange }: { value: CardForm; onChange: (patch: Partial<CardForm>) => void }) {
  return (
    <CollapsibleCard title="Booking Card">
      <div className="px-4 pt-3">
        <p className="text-[#5F624F] text-[11px] leading-relaxed">Shown on the public booking hub card. Blank fields fall back to the title, a calendar icon, and the auto badge.</p>
      </div>
      <FieldRow label="Card Title">
        <SheetInput value={value.booking_card_title} placeholder="e.g. Music Bingo" onChange={(v) => onChange({ booking_card_title: v })} />
      </FieldRow>
      <FieldCol label="Card Tagline">
        <SheetTextarea value={value.booking_card_tagline} placeholder="Short line shown under the title…" onChange={(v) => onChange({ booking_card_tagline: v })} />
      </FieldCol>
      <FieldRow label="Card Badge">
        <SheetInput value={value.booking_card_badge} placeholder="e.g. Thursdays, Book Now" onChange={(v) => onChange({ booking_card_badge: v })} />
      </FieldRow>
      <div className="border-[#E6DFC8] border-t">
        <IconPicker label="Card Icon" value={value.booking_card_icon} onChange={(name) => onChange({ booking_card_icon: name })} />
      </div>
    </CollapsibleCard>
  );
}

// ===== Badge editing bits =====

const renderBadgeIcon = (iconStr: string | null, size = "w-4 h-4") => {
  if (!iconStr || !(iconStr in ICON_OPTIONS)) return <Tag className={size} />;
  const I = ICON_OPTIONS[iconStr as keyof typeof ICON_OPTIONS];
  return <I className={size} />;
};

/** Icon picker grid shared by the badge editors (8 columns, redesign). */
function IconGrid({ value, onChange }: { value: string | null; onChange: (name: string) => void }) {
  return (
    <div className="gap-1.5 grid grid-cols-6 sm:grid-cols-8">
      {Object.entries(ICON_OPTIONS).map(([name, IconComponent]) => (
        <button
          key={name}
          title={name}
          type="button"
          aria-label={`Icon ${name}`}
          aria-pressed={value === name}
          onClick={() => onChange(name)}
          className={cn(
            "place-items-center grid border rounded-lg aspect-square active:scale-95 transition-colors",
            value === name
              ? "border-[#5C4033] bg-[#5C4033] text-white"
              : "border-[#E6DFC8] bg-[#FFFDF7] text-[#5F624F] hover:border-[#5C4033] hover:bg-[#F7F4EA] hover:text-[#5C4033]",
          )}
        >
          <IconComponent className="w-4.25 h-4.25" />
        </button>
      ))}
    </div>
  );
}

/** Inline badge row inside the sub-category sheet (saved with the sub-category). */
function BadgeEditorRow({ badge, onChange, onDelete }: { badge: BadgeDraft; onChange: (b: BadgeDraft) => void; onDelete: () => void }) {
  const [pickOpen, setPickOpen] = useState(false);
  return (
    <div className="bg-[#F7F4EA] p-2.5 border border-[#E6DFC8] rounded-xl">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label="Change icon"
          onClick={() => setPickOpen((o) => !o)}
          className="relative place-items-center grid bg-white border border-[#E6DFC8] rounded-[10px] w-10 h-10 text-[#5C4033] shrink-0"
        >
          {renderBadgeIcon(badge.icon, "w-4.5 h-4.5")}
          <span className="-right-1 -bottom-1 absolute place-items-center grid bg-[#5C4033] rounded-full w-4 h-4 text-white">
            <ChevronDown className="stroke-3 w-2.5 h-2.5" />
          </span>
        </button>
        <div className="flex flex-col flex-1 gap-1.5 min-w-0">
          <input value={badge.title} placeholder="Badge title" aria-label="Badge title" onChange={(e) => onChange({ ...badge, title: e.target.value })} className="bg-transparent py-0.5 border-transparent focus:border-[#E6DFC8] border-b outline-none w-full font-extrabold text-[#1F1F1A] text-[13px] placeholder:text-[#5F624F]/40" />
          <input value={badge.description} placeholder="Short description" aria-label="Badge description" onChange={(e) => onChange({ ...badge, description: e.target.value })} className="bg-transparent py-0.5 border-transparent focus:border-[#E6DFC8] border-b outline-none w-full text-[#5F624F] placeholder:text-[#5F624F]/40 text-xs" />
        </div>
        <button type="button" aria-label="Remove badge" onClick={onDelete} className="place-items-center grid hover:bg-[#fdecec] rounded-lg w-7 h-7 text-[#5F624F] hover:text-[#DC2626] shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {pickOpen && (
        <div className="mt-2.5 pt-2.5 border-[#E6DFC8] border-t">
          <IconGrid value={badge.icon} onChange={(ic) => { onChange({ ...badge, icon: ic }); setPickOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-50 p-3 border border-red-200 rounded-2xl">
      <AlertCircle className="mt-0.5 w-4 h-4 text-red-500 shrink-0" />
      <p className="font-bold text-[11px] text-red-600 leading-snug">{message}</p>
    </div>
  );
}
