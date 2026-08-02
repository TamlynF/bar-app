"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Plus, Pencil, Trash2, ChevronDown, ArrowLeft, Search, X, Layers, Check, Info,
  AlertCircle, Loader2, Globe, EyeOff, User, Armchair, Banknote, Image as ImageIcon,
  Sparkles, Trophy, Disc3, Mic, Music, Users,
  MapPin, Clock, Calendar, DollarSign, Star, CheckCircle, Utensils, GlassWater,
  Heart, Smile, Beer, Wine, Speaker, Tag, Ghost,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EVENT_TYPE_COLORS, colorHexFromKey } from "@/lib/event-type-colors";
import { BOOKING_CARD_ICONS, BOOKING_CARD_ICON_NAMES } from "@/lib/booking-card-icons";
import { normalizeBookingConfig, type BookingConfig, type ResolvedBookingConfig, type FieldKey } from "@/lib/booking-config";
import type { EventBehavior } from "@/lib/event-behavior";
import type { BookingGrouping } from "@/lib/booking-grouping";
import {
  saveTypeAction,
  deleteTypeAction,
  saveSubtypeAction,
  deleteSubtypeAction,
} from "./actions";

const storageClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const IMAGE_BUCKET = "booking-images";

/* Badge icons persist as these keys — keep them stable so existing badges keep rendering. */
const ICON_OPTIONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, Clock, Calendar, Users, DollarSign, Star, CheckCircle, Music, Utensils,
  GlassWater, Heart, Smile, Sparkles, AlertCircle, Info, Beer, Banknote, Trophy,
  Wine, Speaker, User, Disc3, Mic, Tag, Check, Ghost,
};

const BEHAVIOURS: { value: EventBehavior; label: string; blurb: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "standard", label: "Standard night", blurb: "No extra tools — just a normal event.", Icon: Sparkles },
  { value: "quiz", label: "Quiz", blurb: "Adds rounds, teams and scoring.", Icon: Trophy },
  { value: "bingo", label: "Bingo", blurb: "Adds bingo cards and number calling.", Icon: Disc3 },
  { value: "karaoke", label: "Karaoke", blurb: "Adds a singer sign-up list.", Icon: Mic },
  { value: "music_act", label: "Live music", blurb: "Adds act details and set times.", Icon: Music },
  { value: "private", label: "Private hire", blurb: "For bookings of the room by one group.", Icon: Users },
];
const behaviourOf = (v: EventBehavior) => BEHAVIOURS.find((b) => b.value === v) ?? BEHAVIOURS[0];

const GROUPINGS: { value: BookingGrouping; label: string; blurb: string }[] = [
  { value: "per_event", label: "Each date books separately", blurb: "Every date gets its own page on the website." },
  { value: "per_subtype", label: "One page per sub-category", blurb: "All dates of e.g. Quiz share one page with a date picker." },
  { value: "per_type", label: "One page for the whole category", blurb: "All events in this category share a single page." },
];
const groupingBlurb = (v: BookingGrouping) => GROUPINGS.find((g) => g.value === v)?.blurb ?? "";

const HELP = {
  name: "The short name your team sees in lists and on the rota. Keep it to one or two words, like “Quiz”.",
  catName: "The group this sits in, like “Games” or “Music”. Customers never see this — it just keeps your lists tidy.",
  title: "The heading customers read on the website when they book. It can be longer and friendlier, e.g. “Thursday Quiz Night”.",
  defaultTitle: "When you add a new event of this kind, the name is filled in for you. You can still change it for a one-off.",
  tagline: "One short line under the title on the website that sells the night. Think of what you would shout across the bar.",
  colour: "Only for you and your team — the colour this shows as in your lists and calendar. It does not appear on the website.",
  image: "The photo or poster used on the website whenever an event of this kind has no picture of its own.",
  behaviour: "Tells the system what extra tools to switch on — quiz rounds, bingo numbers, a karaoke sign-up sheet, and so on.",
  bookable: "On: customers can reserve a place online. Off: they must ring or turn up (you can still add bookings by hand).",
  host: "Tick if someone has to run this night. You will be asked who is hosting each time you schedule one.",
  seating: "Tick if guests are given tables. Leave it off for stand-up nights so you are not asked to allocate seats.",
  payment: "Tick if people pay when booking. You then set the price below.",
  price: "What one person pays to book. Leave at 0 if the night is free but you still want names.",
  grouping: "How these events are shown on the website: one page each, one page per sub-category, or one page for the whole category.",
  badges: "Short facts shown on the booking page, e.g. “Free entry” or “Thursdays 7pm”. Two or three is plenty.",
  cardTitle: "The heading on the tile customers tap. Leave blank to use the website name.",
  cardTagline: "A sentence or two on the tile telling people what the night is.",
  cardNote: "A short word or two in the corner of the tile, like “Thursdays” or “Popular”. Leave blank for none.",
  cardIcon: "The little picture on the tile. Pick whatever looks closest to the night.",
  bookingImage: "A logo or poster shown at the top of the booking page — handy for a sponsor.",
  bookingTagline: "One line under the logo on the booking page.",
  wording: "What the customer reads next to the box. Plain words work best.",
  smallest: "The fewest people you will take on one booking.",
  biggest: "The most people allowed on one booking. Bigger parties must ring you.",
};

const HINT = {
  name: "One or two words. Team only.",
  title: "What customers read when they book.",
  defaultTitle: "Saves retyping it every week.",
  tagline: "One line, on the website under the title.",
  colour: "Team only — never shown to customers.",
  image: "Optional. Used when an event has no picture.",
  behaviour: "Decides which extra tools you get.",
  price: "What one person pays to book.",
  badges: "Two or three short facts is plenty.",
  grouping: "Changes how the website lists these events.",
  cardTitle: "Blank = the website name.",
  cardTagline: "One or two sentences.",
  cardNote: "Optional, e.g. “Thursdays”.",
  bookingImage: "Optional. Shown across the top of the page.",
  bookingTagline: "Shown under the logo.",
};

export type Badge = { id: number; icon: string | null; title: string; description: string | null };

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
  default_image_url: string | null;
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

type CardDraft = {
  booking_card_title: string;
  booking_card_tagline: string;
  booking_card_icon: string | null;
  booking_card_badge: string;
};

type BadgeDraft = { id?: number; title: string; description: string; icon: string | null };

type CatForm = {
  id?: number;
  isNew: boolean;
  name: string;
  title: string;
  description: string;
  color: string | null;
  booking_grouping: BookingGrouping;
  is_bookable: boolean;
  booking_config: ResolvedBookingConfig;
  origBookingConfig: BookingConfig | null;
} & CardDraft;

type SubForm = {
  id?: number;
  isNew: boolean;
  event_types_id: number;
  name: string;
  title: string;
  default_event_title: string;
  default_image_url: string;
  tagline: string;
  color: string | null;
  behavior: EventBehavior;
  is_bookable: boolean;
  host_required: boolean;
  seating_required: boolean;
  payment_required: boolean;
  default_payment_amount: string;
  booking_config: ResolvedBookingConfig;
  origBookingConfig: BookingConfig | null;
  badges: BadgeDraft[];
} & CardDraft;

const toTitleCase = (str?: string | null) =>
  !str ? "" : str.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const money = (amount: number | null | undefined) => (amount != null ? Number(amount) : 0).toFixed(2);

const cardFromRecord = (r: BookingCardFields): CardDraft => ({
  booking_card_title: r.booking_card_title ?? "",
  booking_card_tagline: r.booking_card_tagline ?? "",
  booking_card_icon: r.booking_card_icon ?? null,
  booking_card_badge: r.booking_card_badge ?? "",
});

const appendCardFields = (fd: FormData, c: CardDraft) => {
  fd.set("booking_card_title", c.booking_card_title);
  fd.set("booking_card_tagline", c.booking_card_tagline);
  fd.set("booking_card_icon", c.booking_card_icon ?? "");
  fd.set("booking_card_badge", c.booking_card_badge);
};

const configToJson = (cfg: ResolvedBookingConfig) =>
  JSON.stringify({
    booking_image_url: cfg.booking_image_url,
    tag_line: cfg.tag_line,
    fields: cfg.fields,
  });

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export default function EventTypesClient({ initialEventTypes = [] }: { initialEventTypes: EventTypeRecord[] }) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const narrow = useMediaQuery("(max-width: 899px)");

  const types = useMemo(
    () => [...initialEventTypes].sort((a, b) => a.name.localeCompare(b.name)),
    [initialEventTypes],
  );

  const [selectedId, setSelectedId] = useState<number | null>(types[0]?.id ?? null);
  const [drilled, setDrilled] = useState(false);
  const [query, setQuery] = useState("");

  const [catForm, setCatForm] = useState<CatForm | null>(null);
  const [subForm, setSubForm] = useState<SubForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selCat = types.find((t) => t.id === selectedId) ?? types[0] ?? null;

  const subs = useMemo(() => {
    if (!selCat) return [];
    const q = query.trim().toLowerCase();
    return [...(selCat.event_subtypes ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [selCat, query]);

  const selectCategory = (id: number) => {
    setSelectedId(id);
    setQuery("");
    if (narrow) setDrilled(true);
  };

  const openNewCat = () =>
    setCatForm({
      isNew: true, name: "", title: "", description: "", color: null,
      booking_grouping: "per_event", is_bookable: false,
      booking_config: normalizeBookingConfig(null), origBookingConfig: null,
      ...cardFromRecord({ booking_card_title: null, booking_card_tagline: null, booking_card_icon: null, booking_card_badge: null }),
    });

  const openEditCat = (t: EventTypeRecord) =>
    setCatForm({
      id: t.id, isNew: false, name: toTitleCase(t.name), title: t.title ?? "", description: t.description ?? "",
      color: t.color ?? null, booking_grouping: t.booking_grouping ?? "per_event", is_bookable: t.is_bookable,
      booking_config: normalizeBookingConfig(t.booking_config), origBookingConfig: t.booking_config,
      ...cardFromRecord(t),
    });

  const openNewSub = (t: EventTypeRecord) =>
    setSubForm({
      isNew: true, event_types_id: t.id, name: "", title: "", default_event_title: "", default_image_url: "",
      tagline: "", color: null, behavior: "standard", is_bookable: false, host_required: false,
      seating_required: true, payment_required: false, default_payment_amount: "",
      booking_config: normalizeBookingConfig(null), origBookingConfig: null, badges: [],
      ...cardFromRecord({ booking_card_title: null, booking_card_tagline: null, booking_card_icon: null, booking_card_badge: null }),
    });

  const openEditSub = (s: Subtype) =>
    setSubForm({
      id: s.id, isNew: false, event_types_id: s.event_types_id, name: toTitleCase(s.name), title: s.title ?? "",
      default_event_title: s.default_event_title ?? "", default_image_url: s.default_image_url ?? "",
      tagline: s.tagline ?? "", color: s.color ?? null, behavior: s.behavior, is_bookable: s.is_bookable,
      host_required: s.host_required, seating_required: s.seating_required, payment_required: s.payment_required,
      default_payment_amount: s.default_payment_amount != null ? String(s.default_payment_amount) : "",
      booking_config: normalizeBookingConfig(s.booking_config), origBookingConfig: s.booking_config,
      badges: (s.event_subtype_badges ?? []).map((b) => ({ id: b.id, title: b.title, description: b.description ?? "", icon: b.icon })),
      ...cardFromRecord(s),
    });

  const closeSheets = () => { setCatForm(null); setSubForm(null); setError(null); };

  const submitCat = () => {
    if (!catForm) return;
    if (!catForm.name.trim()) { setError("Give it a short name so your team can find it."); return; }
    if (catForm.booking_grouping === "per_type" && !catForm.title.trim()) {
      setError("Give the whole-category booking page a name so customers know what they are booking.");
      return;
    }
    const fd = new FormData();
    if (catForm.id) fd.set("id", String(catForm.id));
    fd.set("name", catForm.name);
    fd.set("title", catForm.title);
    fd.set("description", catForm.description);
    fd.set("color", catForm.color ?? "");
    fd.set("booking_grouping", catForm.booking_grouping);
    const catBookable = catForm.booking_grouping === "per_type" && catForm.is_bookable;
    fd.set("is_bookable", catBookable ? "on" : "");
    fd.set("booking_config", catBookable ? configToJson(catForm.booking_config) : JSON.stringify(catForm.origBookingConfig ?? {}));
    appendCardFields(fd, catForm);
    setError(null);
    startTransition(async () => {
      const res = await saveTypeAction(fd);
      if (res?.error) setError(res.error);
      else { toast.success(catForm.isNew ? "Category created" : "Category saved"); closeSheets(); }
    });
  };

  const submitSub = () => {
    if (!subForm) return;
    const parent = types.find((t) => t.id === subForm.event_types_id);
    const ownsPage = parent?.booking_grouping === "per_subtype";
    if (!subForm.name.trim()) { setError("Give it a short name so your team can find it."); return; }
    if (ownsPage && !subForm.title.trim()) { setError("Give it a website name so customers know what they are booking."); return; }
    const fd = new FormData();
    if (subForm.id) fd.set("id", String(subForm.id));
    fd.set("event_types_id", String(subForm.event_types_id));
    fd.set("name", subForm.name);
    fd.set("title", subForm.title);
    fd.set("default_event_title", subForm.default_event_title);
    fd.set("default_image_url", subForm.default_image_url);
    fd.set("tagline", subForm.tagline);
    fd.set("color", subForm.color ?? "");
    fd.set("behavior", subForm.behavior);
    if (subForm.is_bookable) fd.set("is_bookable", "on");
    if (subForm.host_required) fd.set("host_required", "on");
    if (subForm.seating_required) fd.set("seating_required", "on");
    if (subForm.payment_required) fd.set("payment_required", "on");
    fd.set("default_payment_amount", subForm.default_payment_amount || "0");
    fd.set("booking_config", ownsPage && subForm.is_bookable ? configToJson(subForm.booking_config) : JSON.stringify(subForm.origBookingConfig ?? {}));
    fd.set("badges", JSON.stringify(subForm.badges.filter((b) => b.title.trim()).map((b) => ({ id: b.id, title: b.title, description: b.description, icon: b.icon }))));
    appendCardFields(fd, subForm);
    setError(null);
    startTransition(async () => {
      const res = await saveSubtypeAction(fd);
      if (res?.error) setError(res.error);
      else { toast.success(subForm.isNew ? "Sub-category created" : "Sub-category saved"); closeSheets(); }
    });
  };

  const removeCat = async (t: EventTypeRecord) => {
    const ok = await confirm({
      title: `Delete “${toTitleCase(t.name)}”`,
      description: "This deletes the category and all the sub-categories inside it, along with their badges.",
      confirmLabel: "Delete", variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteTypeAction(t.id);
      if (res?.error) toast.error(res.error); else toast.success("Category deleted");
    });
  };

  const removeSub = async (s: Subtype) => {
    const ok = await confirm({
      title: `Delete “${toTitleCase(s.name)}”`,
      description: "This deletes the sub-category and its badges.",
      confirmLabel: "Delete", variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteSubtypeAction(s.id);
      if (res?.error) toast.error(res.error); else toast.success("Sub-category deleted");
    });
  };

  const showList = !narrow || !drilled;
  const showDetail = !narrow || drilled;

  if (types.length === 0) {
    return (
      <div className="mx-auto w-full max-w-295 px-6 py-16 text-center text-[#5F624F]">
        <Layers className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="font-black text-[#1F1F1A] text-sm">No event categories yet</p>
        <p className="mt-1 text-xs">Add your first category to get started.</p>
        <button
          type="button"
          onClick={openNewCat}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1B4332] px-5 font-black text-[11px] text-white uppercase tracking-widest transition-colors hover:bg-[#1B4332]/85"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" /> New category
        </button>
        {catForm && (
          <CategorySheet form={catForm} setForm={setCatForm} onClose={closeSheets} onSave={submitCat} pending={isPending} error={error} />
        )}
        {ConfirmDialogUI}
      </div>
    );
  }

  return (
    <>
      {narrow && drilled && selCat && (
        <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-[#E6DFC8] bg-[#FFFDF7]/95 px-3 py-2 backdrop-blur">
          <IconBtn label="Back to categories" onClick={() => setDrilled(false)}><ArrowLeft className="h-4.5 w-4.5" /></IconBtn>
          <span style={{ "--dot": colorHexFromKey(selCat.color).solid } as React.CSSProperties} className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--dot)" />
          <h2 className="min-w-0 flex-1 truncate font-black text-[16px] text-[#1F1F1A]">{toTitleCase(selCat.name)}</h2>
          <IconBtn label={`Add a sub-category to ${toTitleCase(selCat.name)}`} create onClick={() => openNewSub(selCat)}><Plus className="h-4.5 w-4.5 stroke-[2.5]" /></IconBtn>
          <IconBtn label={`Edit ${toTitleCase(selCat.name)}`} edit onClick={() => openEditCat(selCat)}><Pencil className="h-4 w-4" /></IconBtn>
          <IconBtn label={`Delete ${toTitleCase(selCat.name)}`} danger onClick={() => removeCat(selCat)}><Trash2 className="h-4 w-4" /></IconBtn>
        </div>
      )}

      <div className="mx-auto w-full max-w-295 px-4 pt-4 pb-6 md:px-6 md:pt-0">
        {showList && narrow && (
          <div className="mb-4.5 flex justify-end">
            <button
              type="button"
              onClick={openNewCat}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-[#1B4332] px-5 font-black text-[11px] text-white uppercase tracking-widest transition-colors hover:bg-[#1B4332]/85"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" /> Category
            </button>
          </div>
        )}

        <div className={cn("grid items-start gap-4.5", narrow ? "grid-cols-1" : "grid-cols-[clamp(230px,25%,290px)_1fr]")}>
          {showList && (
            <div className={cn("rounded-[14px] border border-[#E6DFC8] bg-[#FFFDF7] p-2", !narrow && "sticky top-18")}>
              {!narrow && <p className="px-1.5 pt-2 pb-1.5 font-black text-[10.5px] text-[#5F624F] uppercase tracking-[0.16em]">Categories</p>}
              <div className="flex flex-col gap-0.5">
                {types.map((t) => (
                  <CategoryRow
                    key={t.id}
                    cat={t}
                    active={!narrow && selCat?.id === t.id}
                    onClick={() => selectCategory(t.id)}
                  />
                ))}
              </div>
              {!narrow && (
                <button
                  type="button"
                  onClick={openNewCat}
                  className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1B4332] font-black text-[11px] text-white uppercase tracking-widest transition-colors hover:bg-[#1B4332]/85"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" /> Category
                </button>
              )}
            </div>
          )}

          {showDetail && selCat && (
            <div className="flex min-w-0 flex-col gap-3.5">
              <div className="flex flex-col gap-3 rounded-[14px] border border-[#E6DFC8] bg-[#FFFDF7] p-3.5">
                {!narrow && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span style={{ "--dot": colorHexFromKey(selCat.color).solid } as React.CSSProperties} className="h-3 w-3 shrink-0 rounded-full bg-(--dot)" />
                    <h2 className="min-w-0 flex-1 font-black text-[18px] text-[#1F1F1A]">{toTitleCase(selCat.name)}</h2>
                    <IconBtn label={`Edit ${toTitleCase(selCat.name)}`} edit onClick={() => openEditCat(selCat)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label={`Delete ${toTitleCase(selCat.name)}`} danger onClick={() => removeCat(selCat)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                )}
                <p className="text-[13px] text-[#5F624F] leading-relaxed">
                  <b className="font-bold text-[#1F1F1A]">On the website:</b> {groupingBlurb(selCat.booking_grouping)}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <div className="flex h-11 min-w-0 flex-[1_1_200px] items-center gap-2.5 rounded-xl border border-[#E6DFC8] bg-[#FFFDF7] px-3">
                    <Search className="h-4 w-4 shrink-0 text-[#5F624F]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Search in ${toTitleCase(selCat.name)}`}
                      aria-label={`Search in ${toTitleCase(selCat.name)}`}
                      className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/60"
                    />
                    {query && (
                      <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid h-6 w-6 place-items-center rounded-[7px] text-[#5F624F] hover:bg-[#F7F4EA]">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {!narrow && (
                    <button
                      type="button"
                      onClick={() => openNewSub(selCat)}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-[#1B4332] px-4 font-black text-[11px] text-white uppercase tracking-widest transition-colors hover:bg-[#1B4332]/85"
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" /> Sub-category
                    </button>
                  )}
                </div>
              </div>

              {subs.length === 0 ? (
                <div className="rounded-[14px] border border-[#E6DFC8] bg-[#FFFDF7] px-5 py-11 text-center text-[#5F624F]">
                  <Layers className="mx-auto h-5.5 w-5.5 opacity-50" />
                  <p className="mt-2 font-black text-[14px] text-[#1F1F1A]">{query ? "No matches" : "Nothing in here yet"}</p>
                  <p className="mt-0.5 text-[12.5px]">{query ? "Try a different search." : "Add a sub-category to get started."}</p>
                </div>
              ) : (
                <div className={cn("grid gap-3", narrow ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]")}>
                  {subs.map((s) => (
                    <SubCard key={s.id} sub={s} onEdit={() => openEditSub(s)} onDelete={() => removeSub(s)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {catForm && (
        <CategorySheet form={catForm} setForm={setCatForm} onClose={closeSheets} onSave={submitCat} pending={isPending} error={error} />
      )}
      {subForm && (
        <SubtypeSheet
          form={subForm}
          setForm={setSubForm}
          parent={types.find((t) => t.id === subForm.event_types_id)}
          onClose={closeSheets}
          onSave={submitSub}
          pending={isPending}
          error={error}
        />
      )}

      {ConfirmDialogUI}
    </>
  );
}

/* ---------------------------------------------------------------- explorer parts */

function CategoryRow({ cat, active, onClick }: { cat: EventTypeRecord; active: boolean; onClick: () => void }) {
  const count = cat.event_subtypes?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      style={{ "--dot": colorHexFromKey(cat.color).solid } as React.CSSProperties}
      className={cn(
        "flex w-full items-center gap-2.75 rounded-xl border px-3 py-3 text-left transition-colors",
        active ? "border-[#5C4033] bg-[#F1E9E2]" : "border-transparent hover:bg-[#F7F4EA]",
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--dot)" />
      <span className="min-w-0 flex-1">
        <span className="block font-black text-[14px] text-[#1F1F1A]">{toTitleCase(cat.name)}</span>
        <span className="mt-px block text-[12px] text-[#5F624F]">{count} sub-{count === 1 ? "category" : "categories"}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-[#5F624F]" />
    </button>
  );
}

function SubCard({ sub, onEdit, onDelete }: { sub: Subtype; onEdit: () => void; onDelete: () => void }) {
  const c = colorHexFromKey(sub.color);
  const b = behaviourOf(sub.behavior);
  const badges = sub.event_subtype_badges ?? [];
  return (
    <div className="flex flex-col gap-2.75 rounded-[14px] border border-[#E6DFC8] bg-[#FFFDF7] p-3.5">
      <div className="flex items-start gap-2.75">
        <span
          style={{ "--tile-bg": c.bg, "--tile-text": c.text } as React.CSSProperties}
          className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-[10px] bg-(--tile-bg) text-(--tile-text)"
        >
          <b.Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-[15.5px] text-[#1F1F1A]">{toTitleCase(sub.name)}</p>
          <p className="mt-0.5 text-[12.5px] text-[#5F624F] leading-snug">
            {sub.title ? <>Website name <b className="font-bold text-[#1F1F1A]">{sub.title}</b></> : "No website name set"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn label={`Edit ${toTitleCase(sub.name)}`} edit onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn label={`Delete ${toTitleCase(sub.name)}`} danger onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
        </div>
      </div>

      <FactChips sub={sub} />

      {badges.length > 0 && (
        <div className="flex flex-col gap-1.75 rounded-[11px] border border-[#C3D8CC] bg-[#EAF1EC] px-2.5 py-2">
          <p className="flex items-center gap-1.5 font-black text-[10.5px] text-[#1B4332] uppercase tracking-[0.14em]">
            <Globe className="h-3 w-3" /> Shown on the booking page
          </p>
          <div className="flex flex-wrap gap-1.5">
            {badges.map((bg) => (
              <span key={bg.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[#C3D8CC] bg-[#FFFDF7] px-2 py-1 text-[11.5px] font-semibold text-[#5F624F]">
                {renderBadgeIcon(bg.icon, "h-3.25 w-3.25")}
                <b className="font-bold text-[#1F1F1A]">{bg.title}</b>
                {bg.description && <span>· {bg.description}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FactChips({ sub }: { sub: Subtype }) {
  const b = behaviourOf(sub.behavior);
  const chips: { key: string; Icon: React.ComponentType<{ className?: string }>; text: string; on?: boolean }[] = [
    { key: "beh", Icon: b.Icon, text: b.label },
    sub.is_bookable
      ? { key: "online", Icon: Globe, text: "Books online", on: true }
      : { key: "offline", Icon: EyeOff, text: "Not online" },
  ];
  if (sub.host_required) chips.push({ key: "host", Icon: User, text: "Needs a host" });
  if (sub.seating_required) chips.push({ key: "seat", Icon: Armchair, text: "Table seating" });
  chips.push(
    sub.payment_required
      ? { key: "price", Icon: Banknote, text: `£${money(sub.default_payment_amount)} per person` }
      : { key: "free", Icon: Banknote, text: "Free entry" },
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(({ key, Icon, text, on }) => (
        <span
          key={key}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] font-semibold",
            on ? "border-[#C3D8CC] bg-[#EAF1EC] text-[#1B4332]" : "border-[#EFEADB] bg-[#FBF8F0] text-[#5F624F]",
          )}
        >
          <Icon className="h-3.25 w-3.25 shrink-0" />
          {text}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- sheets */

const SHEET_CLASS =
  "flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 border-0 bg-[#F7F4EA] p-0 shadow-2xl outline-none " +
  "sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:w-[680px] " +
  "sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:rounded-[20px] sm:border sm:border-[#E6DFC8]";

function CategorySheet({ form, setForm, onClose, onSave, pending, error }: {
  form: CatForm; setForm: (f: CatForm) => void; onClose: () => void; onSave: () => void; pending: boolean; error: string | null;
}) {
  const set = (patch: Partial<CatForm>) => setForm({ ...form, ...patch });
  const nameErr = !form.name.trim();
  const perType = form.booking_grouping === "per_type";
  const titleErr = perType && !form.title.trim();

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_CLASS}>
        <SheetGrab />
        <SheetHead
          eyebrow={form.isNew ? "New category" : "Edit category"}
          title={form.isNew ? "Category details" : toTitleCase(form.name) || "Category"}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
          <SheetSection title="Name" blurb="A group name for your own lists.">
            <Field label="Category name" required help={HELP.catName} hint="Customers never see this." error={nameErr ? "Give it a short name so your team can find it." : undefined}>
              <TextIn value={form.name} placeholder="e.g. Games" onChange={(v) => set({ name: v })} />
            </Field>
            <Field label="Colour in your lists" help={HELP.colour} hint={HINT.colour}>
              <Swatches value={form.color} onChange={(c) => set({ color: c })} />
            </Field>
          </SheetSection>

          <SheetSection title="How it shows on the website" blurb="Pick the one that matches how people book.">
            <Field label="Booking pages" help={HELP.grouping} hint={HINT.grouping}>
              <GroupingPicker value={form.booking_grouping} onChange={(v) => set({ booking_grouping: v })} />
            </Field>
          </SheetSection>

          {perType && (
            <SheetSection title="Booking" blurb="This whole category shares one booking page.">
              <Field label="Booking page name" required help={HELP.title} hint={HINT.title} error={titleErr ? "Give the booking page a name customers will recognise." : undefined}>
                <TextIn value={form.title} placeholder="e.g. Hire the function room" onChange={(v) => set({ title: v })} />
              </Field>
              <div className="border-t border-[#E6DFC8] pt-3.5">
                <BigToggle
                  label="Can customers book it online?"
                  help={HELP.bookable}
                  on={form.is_bookable}
                  onChange={(v) => set({ is_bookable: v })}
                  onText="Yes — bookable on the website" onSub="A booking page is created for it."
                  offText="No — phone or walk-in only" offSub="You can still add bookings by hand."
                />
              </div>
              {form.is_bookable && (
                <div className="border-t border-[#E6DFC8] pt-3.5">
                  <BookingFormEditor
                    card={form}
                    onCard={(patch) => set(patch)}
                    config={form.booking_config}
                    onConfig={(cfg) => set({ booking_config: cfg })}
                    fallbackTitle={form.title || form.name}
                  />
                </div>
              )}
            </SheetSection>
          )}

          {error && <ErrorBox message={error} />}
        </div>
        <SheetFoot
          onCancel={onClose}
          onSave={onSave}
          pending={pending}
          disableSave={nameErr || titleErr}
          saveLabel={form.isNew ? "Create" : "Save changes"}
        />
      </SheetContent>
    </Sheet>
  );
}

const TABS: { id: string; label: string }[] = [
  { id: "basics", label: "Name" },
  { id: "kind", label: "Kind of night" },
  { id: "needs", label: "What it needs" },
  { id: "web", label: "Website" },
  { id: "booking", label: "Booking form" },
];

function SubtypeSheet({ form, setForm, parent, onClose, onSave, pending, error }: {
  form: SubForm; setForm: (f: SubForm) => void; parent: EventTypeRecord | undefined;
  onClose: () => void; onSave: () => void; pending: boolean; error: string | null;
}) {
  const [activeTab, setActiveTab] = useState("basics");
  const set = (patch: Partial<SubForm>) => setForm({ ...form, ...patch });

  const ownsPage = parent?.booking_grouping === "per_subtype";
  const showBookable = ownsPage;
  const tabs = TABS.filter((t) => t.id !== "booking" || (showBookable && form.is_bookable));
  const cur = tabs.some((t) => t.id === activeTab) ? activeTab : "basics";
  const idx = tabs.findIndex((t) => t.id === cur);
  const last = idx === tabs.length - 1;

  const nameErr = !form.name.trim();
  const titleErr = ownsPage && !form.title.trim();
  const disableSave = nameErr || titleErr;

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_CLASS}>
        <SheetGrab />
        <SheetHead
          eyebrow={form.isNew ? "New sub-category" : "Edit sub-category"}
          title={form.isNew ? `In ${toTitleCase(parent?.name)}` : toTitleCase(form.name) || "Sub-category"}
          onClose={onClose}
        />

        <div className="shrink-0 border-b border-[#E6DFC8] bg-[#FFFDF7] px-4 py-3 sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-[12px] text-[#5F624F]">
              Step {idx + 1} of {tabs.length}
            </p>
            <p className="truncate font-bold text-[12px] text-[#5C4033]">{tabs[idx].label}</p>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EFEADB]"
            role="progressbar"
            aria-label="Sub-category setup progress"
            aria-valuemin={1}
            aria-valuemax={tabs.length}
            aria-valuenow={idx + 1}
          >
            <div
              style={{ "--progress": `${((idx + 1) / tabs.length) * 100}%` } as React.CSSProperties}
              className="h-full w-(--progress) rounded-full bg-[#1B4332] transition-[width] duration-200"
            />
          </div>
        </div>

        <div className="hidden flex-wrap gap-1 bg-[#FFFDF7] px-3 pb-2.5 sm:flex" role="tablist" aria-label="Sub-category settings">
          {tabs.map((t, k) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={cur === t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "rounded-[9px] px-2.75 py-2 font-bold text-[12.5px] transition-colors",
                cur === t.id ? "bg-[#F1E9E2] text-[#5C4033]" : "text-[#5F624F] hover:text-[#5C4033]",
              )}
            >
              <span className="mr-1 opacity-55">{k + 1}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
          {cur === "basics" && (
            <SheetSection title="Name" blurb="What you call it, and what customers read.">
              <Field label="Short name" required help={HELP.name} hint={HINT.name} error={nameErr ? "Give it a short name so your team can find it." : undefined}>
                <TextIn value={form.name} placeholder="e.g. Quiz" onChange={(v) => set({ name: v })} />
              </Field>
              <Field label="Website name" required={ownsPage} help={HELP.title} hint={HINT.title} error={titleErr ? "Give it a website name so customers know what they are booking." : undefined}>
                <TextIn value={form.title} placeholder="e.g. Quiz Night" onChange={(v) => set({ title: v })} />
              </Field>
              <Field label="Fills in new events as" help={HELP.defaultTitle} hint={HINT.defaultTitle}>
                <TextIn value={form.default_event_title} placeholder="e.g. Thursday Quiz Night" onChange={(v) => set({ default_event_title: v })} />
              </Field>
              <Field label="Colour in your lists" help={HELP.colour} hint={HINT.colour}>
                <Swatches value={form.color} onChange={(c) => set({ color: c })} />
              </Field>
            </SheetSection>
          )}

          {cur === "kind" && (
            <SheetSection title="Kind of night" blurb="This switches on the right tools.">
              <Field label="Kind of night" help={HELP.behaviour} hint={HINT.behaviour}>
                <BehaviourPicker value={form.behavior} onChange={(v) => set({ behavior: v })} />
              </Field>
            </SheetSection>
          )}

          {cur === "needs" && (
            <SheetSection title="What it needs" blurb="Set once — every date of this kind follows.">
              {showBookable && (
                <BigToggle
                  label="Can customers book it online?" help={HELP.bookable}
                  on={form.is_bookable} onChange={(v) => set({ is_bookable: v })}
                  onText="Yes — bookable on the website" onSub="A booking page is created for it."
                  offText="No — phone or walk-in only" offSub="You can still add bookings by hand."
                />
              )}
              <BigToggle
                label="Does someone have to run it?" help={HELP.host}
                on={form.host_required} onChange={(v) => set({ host_required: v })}
                onText="Yes — a host is needed" onSub="You'll be asked who is hosting each date."
                offText="No host needed"
              />
              <BigToggle
                label="Are guests given tables?" help={HELP.seating}
                on={form.seating_required} onChange={(v) => set({ seating_required: v })}
                onText="Yes — seated" onSub="Tables are allocated when people book."
                offText="No — standing"
              />
              <BigToggle
                label="Do people pay to book?" help={HELP.payment}
                on={form.payment_required} onChange={(v) => set({ payment_required: v })}
                onText="Yes — paid entry" offText="Free to book"
              />
              {form.payment_required && (
                <Field label="Price per person (£)" help={HELP.price} hint={HINT.price}>
                  <TextIn type="number" value={form.default_payment_amount} placeholder="5.00" onChange={(v) => set({ default_payment_amount: v })} />
                </Field>
              )}
            </SheetSection>
          )}

          {cur === "web" && (
            <>
              <SheetSection title="What customers see" blurb="Words, picture and badges on the booking page.">
                <Field label="One line to sell it" help={HELP.tagline} hint={HINT.tagline}>
                  <AreaIn value={form.tagline} placeholder="Six rounds, one winner, plenty of arguing." onChange={(v) => set({ tagline: v })} />
                </Field>
                <Field label="Poster picture" help={HELP.image} hint={HINT.image}>
                  <Dropzone
                    url={form.default_image_url}
                    subline="Used when an event has no picture of its own"
                    ariaLabel="Upload poster picture"
                    pathPrefix="event-subtypes/"
                    onUpload={(u) => set({ default_image_url: u })}
                    onClear={() => set({ default_image_url: "" })}
                  />
                </Field>
                <Field label="Badges" help={HELP.badges} hint={HINT.badges}>
                  <BadgeEditor badges={form.badges} onChange={(badges) => set({ badges })} />
                </Field>
              </SheetSection>

              <div className="flex flex-col gap-2 rounded-xl border border-[#E6DFC8] bg-[#FBF8F0] p-3">
                <p className="font-black text-[10.5px] text-[#5F624F] uppercase tracking-[0.16em]">How it will look</p>
                <p className="font-black text-[16px] text-[#1F1F1A]">{form.title || form.name || "Your night"}</p>
                {form.tagline && <p className="text-[13px] text-[#5F624F]">{form.tagline}</p>}
                {form.badges.filter((b) => b.title.trim()).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.badges.filter((b) => b.title.trim()).map((b, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-[#EFEADB] bg-[#FBF8F0] px-2 py-1 text-[11.5px] font-semibold text-[#5F624F]">
                        {renderBadgeIcon(b.icon, "h-3.25 w-3.25")}
                        <b className="font-bold text-[#1F1F1A]">{b.title}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {cur === "booking" && (
            <BookingFormEditor
              card={form}
              onCard={(patch) => set(patch)}
              config={form.booking_config}
              onConfig={(cfg) => set({ booking_config: cfg })}
              fallbackTitle={form.title || form.name}
            />
          )}

          {error && <ErrorBox message={error} />}
        </div>

        <SheetFoot
          onCancel={idx === 0 ? onClose : () => setActiveTab(tabs[idx - 1].id)}
          cancelLabel={idx === 0 ? "Close" : "Back"}
          onSave={last ? onSave : undefined}
          onNext={last ? undefined : () => setActiveTab(tabs[idx + 1].id)}
          nextLabel={last ? undefined : "Next"}
          pending={pending}
          disableSave={disableSave}
          disableNext={nameErr}
          saveLabel={form.isNew ? "Create" : "Save changes"}
        />
      </SheetContent>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- booking form editor (tab 5 / per_type) */

const BOOK_FIELDS: { key: FieldKey; label: string; locked?: boolean; size?: boolean }[] = [
  { key: "name", label: "Their name", locked: true },
  { key: "email", label: "Email address", locked: true },
  { key: "phone", label: "Phone number" },
  { key: "group_size", label: "How many people", size: true },
  { key: "group_name", label: "Team or group name" },
  { key: "special_requests", label: "Anything else we should know" },
];

function BookingFormEditor({ card, onCard, config, onConfig, fallbackTitle }: {
  card: CardDraft;
  onCard: (patch: Partial<CardDraft>) => void;
  config: ResolvedBookingConfig;
  onConfig: (cfg: ResolvedBookingConfig) => void;
  fallbackTitle: string;
}) {
  const setField = (key: FieldKey, patch: Partial<ResolvedBookingConfig["fields"][FieldKey]>) =>
    onConfig({ ...config, fields: { ...config.fields, [key]: { ...config.fields[key], ...patch } } });

  return (
    <div className="flex flex-col gap-3.5">
      <BookingBlock title="Booking card" blurb="The tile customers tap on the booking page.">
        <p className="text-[12px] text-[#5F624F] leading-relaxed">Leave a box blank and it falls back to the website name, a calendar icon and the automatic label.</p>
        <Field label="Card title" help={HELP.cardTitle} hint={HINT.cardTitle}>
          <TextIn value={card.booking_card_title} placeholder={fallbackTitle || "e.g. Quiz Night"} onChange={(v) => onCard({ booking_card_title: v })} />
        </Field>
        <Field label="Card tagline" help={HELP.cardTagline} hint={HINT.cardTagline}>
          <AreaIn value={card.booking_card_tagline} placeholder="Book a table for our weekly quiz night. Eight rounds, great prizes, and happy hour vibes." onChange={(v) => onCard({ booking_card_tagline: v })} />
        </Field>
        <Field label="Card note" help={HELP.cardNote} hint={HINT.cardNote}>
          <TextIn value={card.booking_card_badge} placeholder="Thursdays" onChange={(v) => onCard({ booking_card_badge: v })} />
        </Field>
        <Field label="Card icon" help={HELP.cardIcon}>
          <CardIconGrid value={card.booking_card_icon} onChange={(name) => onCard({ booking_card_icon: name })} />
        </Field>
      </BookingBlock>

      <BookingBlock title="Booking page" blurb="The page people land on after tapping the card.">
        <Field label="Booking image (logo)" help={HELP.bookingImage} hint={HINT.bookingImage}>
          <Dropzone
            url={config.booking_image_url ?? ""}
            subline="JPG or PNG from your phone or computer"
            ariaLabel="Upload booking image"
            pathPrefix=""
            onUpload={(u) => onConfig({ ...config, booking_image_url: u })}
            onClear={() => onConfig({ ...config, booking_image_url: null })}
          />
        </Field>
        <Field label="Tagline" help={HELP.bookingTagline} hint={HINT.bookingTagline}>
          <TextIn value={config.tag_line} placeholder="Description shown under the logo" onChange={(v) => onConfig({ ...config, tag_line: v })} />
        </Field>
      </BookingBlock>

      <BookingBlock title="Form fields" blurb="The questions the customer answers when booking.">
        <p className="text-[12px] text-[#5F624F] leading-relaxed">
          <b className="font-bold text-[#1F1F1A]">Shown</b> puts the question on the form. <b className="font-bold text-[#1F1F1A]">Required</b> means they cannot book without answering it.
        </p>
        {BOOK_FIELDS.map((fd) => {
          const v = config.fields[fd.key];
          const shown = fd.locked ? true : v.visible;
          const required = fd.locked ? true : v.required;
          return (
            <div key={fd.key} className="overflow-hidden rounded-xl border border-[#E6DFC8] bg-[#FBF8F0]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 px-2.75 py-2.5 max-[560px]:grid-cols-2">
                <b className="min-w-0 text-[13px] text-[#1F1F1A] max-[560px]:col-span-2">{fd.label}</b>
                <span className="flex items-center justify-end gap-1.75">
                  <span className={cn("w-12 text-right font-black text-[10.5px] uppercase tracking-widest", shown ? "text-[#1B4332]" : "text-[#5F624F]")}>Shown</span>
                  <MiniSw on={shown} disabled={fd.locked} label={`Show ${fd.label}`} onClick={() => setField(fd.key, { visible: !v.visible })} />
                </span>
                <span className={cn("flex items-center justify-end gap-1.75", !shown && "opacity-40")}>
                  <span className={cn("w-18.5 text-right font-black text-[10.5px] uppercase tracking-widest", required ? "text-[#B45309]" : "text-[#5F624F]")}>{required ? "Required" : "Optional"}</span>
                  <MiniSw on={required} tone="req" disabled={fd.locked || !shown} label={`Make ${fd.label} required`} onClick={() => setField(fd.key, { required: !v.required })} />
                </span>
              </div>
              {shown && (
                <div className="flex flex-col gap-2.25 border-t border-[#E6DFC8] bg-white p-2.75">
                  <Field label="Wording on the form" help={HELP.wording}>
                    <TextIn value={v.label} ariaLabel={`Wording for ${fd.label}`} onChange={(val) => setField(fd.key, { label: val })} />
                  </Field>
                  {fd.size && (
                    <div className="flex flex-wrap gap-2.25">
                      <span className="flex-[1_1_120px]">
                        <Field label="Smallest group" help={HELP.smallest}>
                          <TextIn type="number" value={String(config.fields.group_size.min)} ariaLabel="Smallest group" onChange={(val) => setField("group_size", { min: Math.max(1, parseInt(val, 10) || 1) })} />
                        </Field>
                      </span>
                      <span className="flex-[1_1_120px]">
                        <Field label="Biggest group" help={HELP.biggest}>
                          <TextIn type="number" value={String(config.fields.group_size.max)} ariaLabel="Biggest group" onChange={(val) => setField("group_size", { max: Math.max(1, parseInt(val, 10) || 1) })} />
                        </Field>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </BookingBlock>
    </div>
  );
}

function BookingBlock({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#E6DFC8] bg-[#FFFDF7]">
      <div className="border-b border-[#EFEADB] bg-[#FBF8F0] px-3.5 py-3">
        <p className="font-black text-[13px] uppercase tracking-widest text-[#1F1F1A]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[#5F624F]">{blurb}</p>
      </div>
      <div className="flex flex-col gap-3.5 p-3.5">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- badge editor */

function BadgeEditor({ badges, onChange }: { badges: BadgeDraft[]; onChange: (b: BadgeDraft[]) => void }) {
  const update = (i: number, patch: Partial<BadgeDraft>) => onChange(badges.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(badges.filter((_, j) => j !== i));
  const add = () => onChange([...badges, { title: "", description: "", icon: "Star" }]);
  return (
    <div className="flex flex-col gap-2.25">
      {badges.length === 0 && (
        <p className="text-[12px] text-[#5F624F] leading-relaxed">No badges yet. Most nights look good with two, like “Free entry” and “Thursdays 7pm”.</p>
      )}
      {badges.map((b, i) => (
        <BadgeRow key={i} badge={b} onChange={(patch) => update(i, patch)} onDelete={() => remove(i)} />
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex h-8.5 w-fit items-center gap-1.5 rounded-[10px] border border-[#E6DFC8] bg-[#FFFDF7] px-3 font-bold text-[12.5px] text-[#1F1F1A] transition-colors hover:border-[#5C4033]"
      >
        <Plus className="h-3.5 w-3.5" /> Add a badge
      </button>
    </div>
  );
}

function BadgeRow({ badge, onChange, onDelete }: { badge: BadgeDraft; onChange: (patch: Partial<BadgeDraft>) => void; onDelete: () => void }) {
  const [pickOpen, setPickOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#E6DFC8] bg-[#FBF8F0] p-2.5">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label="Change badge icon"
          onClick={() => setPickOpen((o) => !o)}
          className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#F1E9E2] text-[#5C4033]"
        >
          {renderBadgeIcon(badge.icon, "h-4 w-4")}
          <span className="absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-[#5C4033] text-white">
            <ChevronDown className="h-2.5 w-2.5 stroke-3" />
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            value={badge.title}
            placeholder="Badge title, e.g. Free entry"
            aria-label="Badge title"
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full border-b border-transparent bg-transparent py-0.5 font-bold text-[13px] text-[#1F1F1A] outline-none placeholder:text-[#5F624F]/50 focus:border-[#E6DFC8]"
          />
          <input
            value={badge.description}
            placeholder="Extra detail, e.g. 7pm start"
            aria-label="Badge description"
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full border-b border-transparent bg-transparent py-0.5 text-[11.5px] text-[#5F624F] outline-none placeholder:text-[#5F624F]/50 focus:border-[#E6DFC8]"
          />
        </div>
        <button type="button" aria-label="Remove badge" onClick={onDelete} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#5F624F] transition-colors hover:bg-[#FBECEA] hover:text-[#DC2626]">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {pickOpen && (
        <div className="mt-2.5 border-t border-[#E6DFC8] pt-2.5">
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {Object.keys(ICON_OPTIONS).map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={`Icon ${name}`}
                aria-pressed={badge.icon === name}
                onClick={() => { onChange({ icon: name }); setPickOpen(false); }}
                className={cn(
                  "grid aspect-square place-items-center rounded-lg border transition-colors",
                  badge.icon === name ? "border-[#5C4033] bg-[#5C4033] text-white" : "border-[#E6DFC8] bg-[#FFFDF7] text-[#5F624F] hover:border-[#5C4033] hover:text-[#5C4033]",
                )}
              >
                {renderBadgeIcon(name, "h-4 w-4")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const renderBadgeIcon = (iconStr: string | null, size = "h-4 w-4") => {
  if (!iconStr || !(iconStr in ICON_OPTIONS)) return <Tag className={size} />;
  const I = ICON_OPTIONS[iconStr];
  return <I className={size} />;
};

/* ---------------------------------------------------------------- shared controls */

function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does ${label} mean?`}
          aria-expanded={open}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
            open ? "border-[#5C4033] bg-[#5C4033] text-white" : "border-[#E6DFC8] bg-[#FBF8F0] text-[#5F624F] hover:border-[#5C4033] hover:bg-[#5C4033] hover:text-white",
          )}
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[min(268px,74vw)] rounded-[11px] border-0 bg-[#1F1F1A] p-3 text-[12.5px] leading-relaxed text-[#F7F4EA] shadow-[0_14px_34px_-14px_rgba(31,31,26,0.6)]"
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, help, hint, required, error, children }: {
  label: string; help?: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.75">
        <span className="font-bold text-[12.5px] text-[#1F1F1A]">
          {label}{required && <span className="ml-1 font-semibold text-[11px] text-[#B4453C]">required</span>}
        </span>
        {help && <InfoTip text={help} label={label} />}
      </div>
      {children}
      {hint && !error && <p className="text-[12px] text-[#5F624F] leading-relaxed">{hint}</p>}
      {error && <p className="font-semibold text-[12px] text-[#B4453C]">{error}</p>}
    </div>
  );
}

function TextIn({ value, onChange, placeholder, type, ariaLabel }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: "text" | "number"; ariaLabel?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      min={type === "number" ? "0" : undefined}
      step={type === "number" ? "0.01" : undefined}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder ?? "Value"}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-[10px] border border-[#E6DFC8] bg-white px-3 text-[14.5px] text-[#1F1F1A] outline-none transition-colors placeholder:text-[#5F624F]/50 focus-visible:border-[#5C4033] focus-visible:ring-[3px] focus-visible:ring-[#5C4033]/12"
    />
  );
}

function AreaIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      aria-label={placeholder ?? "Value"}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-19.5 w-full resize-y rounded-[10px] border border-[#E6DFC8] bg-white px-3 py-2.5 text-[14.5px] leading-relaxed text-[#1F1F1A] outline-none transition-colors placeholder:text-[#5F624F]/50 focus-visible:border-[#5C4033] focus-visible:ring-[3px] focus-visible:ring-[#5C4033]/12"
    />
  );
}

function BigToggle({ label, help, on, onChange, onText, onSub, offText, offSub }: {
  label: string; help: string; on: boolean; onChange: (v: boolean) => void;
  onText: string; onSub?: string; offText: string; offSub?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.75">
        <span className="font-bold text-[12.5px] text-[#1F1F1A]">{label}</span>
        <InfoTip text={help} label={label} />
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
          on ? "border-[#C3D8CC] bg-[#EAF1EC]" : "border-[#E6DFC8] bg-[#FBF8F0]",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[13.5px] text-[#1F1F1A]">{on ? onText : offText}</span>
          {(on ? onSub : offSub) && <span className="mt-0.5 block text-[12px] text-[#5F624F] leading-snug">{on ? onSub : offSub}</span>}
        </span>
        <span className={cn("relative mt-0.5 h-7 w-11.5 shrink-0 rounded-full transition-colors", on ? "bg-[#1B4332]" : "bg-[#DCD5C0]")}>
          <span className={cn("absolute top-0.75 left-0.75 h-5.5 w-5.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform", on && "translate-x-4.5")} />
        </span>
      </button>
    </div>
  );
}

function MiniSw({ on, onClick, label, tone, disabled }: {
  on: boolean; onClick: () => void; label: string; tone?: "req"; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        disabled ? "cursor-default opacity-55" : "cursor-pointer",
        on ? (tone === "req" ? "bg-[#B45309]" : "bg-[#1B4332]") : "bg-[#DCD5C0]",
      )}
    >
      <span className={cn("absolute top-0.75 left-0.75 h-4.5 w-4.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform", on && "translate-x-4")} />
    </button>
  );
}

function Swatches({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2.25">
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
              "grid h-7.5 w-7.5 place-items-center rounded-full border-2 bg-(--sw) transition-transform hover:scale-110",
              sel ? "border-[#1F1F1A] ring-2 ring-inset ring-white" : "border-transparent opacity-85 hover:opacity-100",
            )}
          >
            {sel && <Check className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />}
          </button>
        );
      })}
    </div>
  );
}

function BehaviourPicker({ value, onChange }: { value: EventBehavior; onChange: (v: EventBehavior) => void }) {
  return (
    <div className="grid gap-2.25 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {BEHAVIOURS.map((b) => {
        const sel = value === b.value;
        return (
          <button
            key={b.value}
            type="button"
            aria-pressed={sel}
            onClick={() => onChange(b.value)}
            className={cn(
              "flex items-start gap-2.25 rounded-xl border p-2.75 text-left transition-colors",
              sel ? "border-[#5C4033] bg-[#F1E9E2] shadow-[0_0_0_2px_rgba(92,64,51,0.14)]" : "border-[#E6DFC8] bg-[#FBF8F0] hover:border-[#5C4033]",
            )}
          >
            <b.Icon className="h-4.5 w-4.5 shrink-0 text-[#5C4033]" />
            <span className="min-w-0">
              <span className="block font-bold text-[13px] text-[#1F1F1A]">{b.label}</span>
              <span className="mt-0.5 block text-[11.5px] text-[#5F624F] leading-snug">{b.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GroupingPicker({ value, onChange }: { value: BookingGrouping; onChange: (v: BookingGrouping) => void }) {
  return (
    <div className="flex flex-col gap-2.25">
      {GROUPINGS.map((g) => {
        const sel = value === g.value;
        const Icon = sel ? Check : Globe;
        return (
          <button
            key={g.value}
            type="button"
            aria-pressed={sel}
            onClick={() => onChange(g.value)}
            className={cn(
              "flex items-start gap-2.25 rounded-xl border p-2.75 text-left transition-colors",
              sel ? "border-[#5C4033] bg-[#F1E9E2] shadow-[0_0_0_2px_rgba(92,64,51,0.14)]" : "border-[#E6DFC8] bg-[#FBF8F0] hover:border-[#5C4033]",
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0 text-[#5C4033]" />
            <span className="min-w-0">
              <span className="block font-bold text-[13px] text-[#1F1F1A]">{g.label}</span>
              <span className="mt-0.5 block text-[11.5px] text-[#5F624F] leading-snug">{g.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CardIconGrid({ value, onChange }: { value: string | null; onChange: (name: string | null) => void }) {
  return (
    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(52px,1fr))]">
      {BOOKING_CARD_ICON_NAMES.map((name) => {
        const Icon = BOOKING_CARD_ICONS[name];
        const sel = value === name;
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={sel}
            onClick={() => onChange(sel ? null : name)}
            className={cn(
              "grid h-12 place-items-center rounded-[11px] border-[1.5px] transition-colors",
              sel ? "border-[#1B4332] bg-[#EAF1EC] text-[#1B4332]" : "border-[#E6DFC8] bg-white text-[#5F624F] hover:border-[#5C4033]",
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </button>
        );
      })}
    </div>
  );
}

function Dropzone({ url, subline, ariaLabel, pathPrefix, onUpload, onClear }: {
  url: string; subline: string; ariaLabel: string; pathPrefix: string; onUpload: (u: string) => void; onClear: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${pathPrefix}${crypto.randomUUID()}.${ext}`;
      const { data, error } = await storageClient.storage.from(IMAGE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const publicUrl = storageClient.storage.from(IMAGE_BUCKET).getPublicUrl(data.path).data.publicUrl;
      onUpload(publicUrl);
    } catch (ex) {
      setUploadError(ex instanceof Error ? ex.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (url) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-[#E6DFC8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-h-50 w-full bg-[#F7F4EA] object-cover" />
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove image"
          title="Remove image"
          className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#E6DFC8] bg-[#FBF8F0] py-5.5 transition-colors hover:border-[#5C4033]">
        {uploading ? <Loader2 className="h-5.5 w-5.5 animate-spin text-[#5F624F]" /> : <ImageIcon className="h-5.5 w-5.5 text-[#5F624F]" />}
        <span className="font-black text-[12.5px] tracking-[0.08em] text-[#5C4033] uppercase">{uploading ? "Uploading…" : "Choose a picture"}</span>
        <span className="px-4 text-center text-[11.5px] text-[#5F624F]">{subline}</span>
        <input type="file" accept="image/*" aria-label={ariaLabel} className="hidden" onChange={handle} disabled={uploading} />
      </label>
      {uploadError && <p className="font-semibold text-[11px] text-[#B4453C]">{uploadError}</p>}
    </div>
  );
}

function IconBtn({ label, onClick, edit, danger, create, children }: {
  label: string; onClick: () => void; edit?: boolean; danger?: boolean; create?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] transition-colors",
        create ? "bg-[#1B4332] font-black text-white uppercase tracking-widest hover:bg-[#1B4332]/85"
          : danger ? "text-[#DC2626] hover:bg-[#FBECEA]" : edit ? "text-[#B45309] hover:bg-[#EFEADB]" : "text-[#5F624F] hover:bg-[#EFEADB] hover:text-[#5C4033]",
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- sheet chrome */

function SheetGrab() {
  return <div className="mx-auto mt-2 h-1 w-11 shrink-0 rounded-full bg-[#E6DFC8]" />;
}

function SheetHead({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E6DFC8] bg-[#FFFDF7] px-4 pt-3 pb-3.5">
      <div className="min-w-0">
        <SheetDescription className="font-black text-[10.5px] text-[#5F624F] uppercase tracking-[0.13em]">{eyebrow}</SheetDescription>
        <SheetTitle className="mt-1 font-black text-[18px] text-[#1F1F1A]">{title}</SheetTitle>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[#5F624F] transition-colors hover:bg-[#EFEADB] hover:text-[#1F1F1A]">
        <X className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}

function SheetSection({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#E6DFC8] bg-[#FFFDF7]">
      <header className="border-b border-[#EFEADB] bg-[#FBF8F0] px-3.5 py-3">
        <h3 className="font-black text-[13px] uppercase tracking-widest text-[#1F1F1A]">{title}</h3>
        <p className="mt-0.5 text-[12px] text-[#5F624F]">{blurb}</p>
      </header>
      <div className="flex flex-col gap-3.5 p-3.5">{children}</div>
    </section>
  );
}

function SheetFoot({ onCancel, cancelLabel = "Cancel", onSave, onNext, nextLabel, pending, disableSave, disableNext, saveLabel }: {
  onCancel: () => void;
  cancelLabel?: string;
  onSave?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  pending: boolean;
  disableSave?: boolean;
  disableNext?: boolean;
  saveLabel: string;
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-[#E6DFC8] bg-[#FFFDF7] px-4 py-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] sm:flex sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="h-12 rounded-xl border border-[#E6DFC8] bg-[#F7F4EA] font-black text-[12px] text-[#5F624F] uppercase tracking-widest transition-colors hover:border-[#5C4033] hover:text-[#5C4033] disabled:opacity-50 sm:min-w-35"
      >
        {cancelLabel}
      </button>
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={disableNext}
          className="h-12 rounded-xl bg-[#1B4332] font-black text-[12px] text-white uppercase tracking-widest transition-colors hover:bg-[#1B4332]/85 disabled:pointer-events-none disabled:opacity-50 sm:min-w-35"
        >
          {nextLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={pending || disableSave}
          title={disableSave ? "Fill in the highlighted fields first" : undefined}
          className="grid h-12 place-items-center rounded-xl bg-[#1B4332] font-black text-[12px] text-white uppercase tracking-widest transition-colors hover:bg-[#1B4332]/85 disabled:pointer-events-none disabled:opacity-50 sm:min-w-35"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saveLabel}
        </button>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="font-bold text-[11px] text-red-600 leading-snug">{message}</p>
    </div>
  );
}
