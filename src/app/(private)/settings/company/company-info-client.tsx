"use client";

import React, { useState, useTransition } from "react";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Users,
  Loader2,
  Pencil,
  Upload,
  Trash2,
  Clock,
  Quote,
  Highlighter,
  Share2,
  Shapes,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiX } from "react-icons/si";
import Link from "next/link";
import { updateCompanyInfo } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  RecordSheet,
  DetailCard,
  FormRow,
  ErrorBox,
  EmptyState,
} from "@/components/admin";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

type DayHours = { open: string; close: string };
type OpeningHours = Partial<Record<string, DayHours>>;

interface CompanyInfo {
  id: number;
  name: string | null;
  logo_url: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  tagline: string | null;
  tagline_accent: string | null;
  description: string | null;
  opening_hours: OpeningHours | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  youtube: string | null;
  max_capacity: number | null;
  private_hire_min_capacity: number | null;
  created_at?: string;
  created_by?: number | null;
  updated_at?: string | null;
  updated_by?: number | null;
}

export type EmployeeOption = { id: number; full_name: string };

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const AREA_INPUT =
  "min-h-20 w-full resize-none rounded-2xl border border-admin-line bg-admin-surface p-3 text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40 focus:border-admin-primary";
const TIME_INPUT =
  "h-10 flex-1 rounded-xl border border-admin-line bg-admin-surface px-3 text-sm font-semibold text-admin-ink outline-none focus:border-admin-primary";
const HINT = "text-[11px] font-medium text-admin-muted opacity-70";
// A phone has to fit the label and the value on one line, so the value gives up
// a point of type rather than wrapping.
const VALUE_TEXT = "text-[12px] sm:text-sm";

// Every fact on this page is a short one, so the rows run dense unless a field
// is prose. The label column is a fixed width rather than shrink-to-fit, so a
// left-aligned value starts in the same place whether its label is "Address" or
// "Description".
function Row({
  icon,
  label,
  value,
  multiline,
  dense = true,
  valueClassName,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
  dense?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 border-b border-admin-line px-3 last:border-0 sm:px-5",
        dense ? "py-1.5 sm:py-2" : "py-2.5 sm:py-3",
        multiline ? "items-start" : "items-center",
      )}
    >
      <div className="flex w-24 shrink-0 items-center gap-1.5 text-admin-muted opacity-70 sm:w-28">
        {icon}
        <span className="text-[11px] font-semibold tracking-wide">{label}</span>
      </div>
      <span
        className={cn(
          "flex-1 leading-snug font-semibold wrap-break-word text-admin-ink",
          VALUE_TEXT,
          multiline ? "text-left" : "text-right",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

// Matches the section headers on the event sheet: a filled admin-line bar with
// the title in olive.
function SectionCard({
  icon,
  title,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DetailCard className={className}>
      <div className="flex min-h-11 w-full items-center gap-2 border-b border-admin-line bg-admin-line px-4 py-2 sm:px-5">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-admin-primary">
          {icon}
          {title}
        </span>
      </div>
      {children}
    </DetailCard>
  );
}

function linkValue(value: string | null, href?: string) {
  if (!value) return "-";
  if (!href) return value;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-admin-primary underline underline-offset-2 hover:opacity-70"
    >
      {value}
    </a>
  );
}

type SocialKey = "instagram" | "facebook" | "twitter" | "tiktok" | "youtube";

const SOCIAL_META: Record<
  SocialKey,
  { label: string; hosts: string[]; base: string; placeholder: string }
> = {
  instagram: {
    label: "Instagram",
    hosts: ["instagram.com"],
    base: "https://instagram.com/",
    placeholder: "donfenticas",
  },
  facebook: {
    label: "Facebook",
    hosts: ["facebook.com", "fb.com"],
    base: "https://facebook.com/",
    placeholder: "donfenticas",
  },
  twitter: {
    label: "Twitter / X",
    hosts: ["twitter.com", "x.com"],
    base: "https://x.com/",
    placeholder: "donfenticas",
  },
  tiktok: {
    label: "TikTok",
    hosts: ["tiktok.com"],
    base: "https://tiktok.com/@",
    placeholder: "donfenticas",
  },
  youtube: {
    label: "YouTube",
    hosts: ["youtube.com", "youtu.be"],
    base: "https://youtube.com/",
    placeholder: "donfenticas",
  },
};

// A pasted profile URL and a typed handle mean the same account, so only the
// part that identifies it is kept. What survives is what the link is rebuilt
// from, which is also what the public site expects.
function socialPath(raw: string | null | undefined, key: SocialKey): string {
  let value = (raw ?? "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (!value) return "";
  value = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  for (const host of SOCIAL_META[key].hosts) {
    if (value.toLowerCase().startsWith(host)) {
      value = value.slice(host.length);
      break;
    }
  }
  return value.replace(/^\/+/, "").replace(/^@/, "");
}

// A channel or page sitting under a path is not an @name, so only a bare
// handle gets the prefix.
function socialDisplay(path: string): string {
  if (!path) return "";
  return path.includes("/") ? path : `@${path}`;
}

function socialValue(raw: string | null, key: SocialKey) {
  const path = socialPath(raw, key);
  if (!path) return "-";
  return linkValue(socialDisplay(path), `${SOCIAL_META[key].base}${path}`);
}

// Long copy on a phone pushes everything below it off the screen, so it opens
// only when asked. There is room for all of it from sm up.
function ClampedText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const longEnoughToClamp = text.length > 170;

  return (
    <span className="block">
      <span
        className={cn(
          "block whitespace-pre-line",
          longEnoughToClamp && !expanded && "line-clamp-4 sm:line-clamp-none",
        )}
      >
        {text}
      </span>
      {longEnoughToClamp && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-1 text-[12px] font-semibold text-admin-primary underline underline-offset-2 sm:hidden"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </span>
  );
}

export default function CompanyInfoClient({
  initialData,
  employees = [],
  hasVenuePlan = false,
}: {
  initialData: CompanyInfo | null;
  employees?: EmployeeOption[];
  hasVenuePlan?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<CompanyInfo | null>(initialData);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm = (record: CompanyInfo | null) => ({
    name: record?.name ?? "",
    logo_url: record?.logo_url ?? "",
    address: record?.address ?? "",
    email: record?.email ?? "",
    phone: record?.phone ?? "",
    tagline: record?.tagline ?? "",
    tagline_accent: record?.tagline_accent ?? "",
    description: record?.description ?? "",
    opening_hours: (record?.opening_hours ?? {}) as OpeningHours,
    instagram: socialPath(record?.instagram, "instagram"),
    facebook: socialPath(record?.facebook, "facebook"),
    twitter: socialPath(record?.twitter, "twitter"),
    tiktok: socialPath(record?.tiktok, "tiktok"),
    youtube: socialPath(record?.youtube, "youtube"),
    max_capacity: record?.max_capacity?.toString() ?? "",
    private_hire_min_capacity: record?.private_hire_min_capacity?.toString() ?? "",
  });

  const [form, setForm] = useState(() => emptyForm(initialData));

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Typing is left alone; a pasted URL collapses to its handle once you leave
  // the field, so what is stored is never a whole address.
  const normaliseSocial = (key: SocialKey) =>
    setForm((prev) => ({ ...prev, [key]: socialPath(prev[key], key) }));

  const updateHours = (day: string, field: "open" | "close", value: string) => {
    setForm((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: { ...(prev.opening_hours[day] || { open: "", close: "" }), [field]: value },
      },
    }));
  };

  const openEdit = () => {
    setForm(emptyForm(data));
    setFormError(null);
    setIsEditing(true);
  };

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const accentMissing =
    form.tagline_accent.trim().length > 0 &&
    !form.tagline.toLowerCase().includes(form.tagline_accent.trim().toLowerCase());

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!data?.id) return;

    const fd = new FormData();
    fd.set("id", String(data.id));
    fd.set("name", form.name);
    fd.set("logo_url", form.logo_url);
    fd.set("address", form.address);
    fd.set("email", form.email);
    fd.set("phone", form.phone);
    fd.set("tagline", form.tagline);
    fd.set("tagline_accent", form.tagline_accent);
    fd.set("description", form.description);
    fd.set("opening_hours", JSON.stringify(form.opening_hours));
    fd.set("instagram", socialPath(form.instagram, "instagram"));
    fd.set("facebook", socialPath(form.facebook, "facebook"));
    fd.set("twitter", socialPath(form.twitter, "twitter"));
    fd.set("tiktok", socialPath(form.tiktok, "tiktok"));
    fd.set("youtube", socialPath(form.youtube, "youtube"));
    fd.set("max_capacity", form.max_capacity);
    fd.set("private_hire_min_capacity", form.private_hire_min_capacity);

    setFormError(null);
    startTransition(async () => {
      const res = await updateCompanyInfo(fd);
      if (res.success) {
        setData({
          ...data,
          ...form,
          instagram: socialPath(form.instagram, "instagram"),
          facebook: socialPath(form.facebook, "facebook"),
          twitter: socialPath(form.twitter, "twitter"),
          tiktok: socialPath(form.tiktok, "tiktok"),
          youtube: socialPath(form.youtube, "youtube"),
          max_capacity: parseInt(form.max_capacity) || null,
          private_hire_min_capacity: parseInt(form.private_hire_min_capacity) || null,
          ...(res.audit ?? {}),
        });
        setIsEditing(false);
        toast.success("Company information saved");
      } else {
        setFormError(res.error ?? "Failed to save");
        toast.error(res.error ?? "Failed to save");
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setFormError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `logo-${Date.now()}.${ext}`;

    const { data: uploaded, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      setFormError(`Upload failed: ${error.message}`);
      setUploadingLogo(false);
      return;
    }

    const publicUrl = supabase.storage.from("gallery").getPublicUrl(uploaded.path).data
      .publicUrl;
    setForm((prev) => ({ ...prev, logo_url: publicUrl }));
    setUploadingLogo(false);
  };

  if (!data) {
    return (
      <div className="px-4 py-4 sm:px-8 sm:py-0">
        <EmptyState
          icon={Building2}
          title="No company information found"
          description="Add a company_information record to configure your venue"
        />
      </div>
    );
  }

  const openingHours = (data.opening_hours ?? {}) as OpeningHours;
  const listedDays = DAYS.filter((day) => {
    const hours = openingHours[day];
    return hours?.open || hours?.close;
  });

  return (
    <div className="animate-in space-y-4 px-0 py-4 duration-500 fade-in sm:px-8 sm:py-0">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openEdit}
          className="inline-flex h-11 items-center rounded-2xl border border-admin-primary bg-admin-card px-4 text-[13px] font-semibold tracking-wide text-admin-primary transition-colors hover:bg-admin-primary-soft hover:text-admin-primary active:scale-95"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-8">
        <SectionCard icon={<Building2 className="h-3.5 w-3.5" />} title="Business details">
          {data.logo_url && (
            <Row
              dense={false}
              icon={<ImageIcon className="h-3.5 w-3.5" />}
              label="Logo"
              value={
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={data.logo_url}
                  alt="Company logo"
                  className="ml-auto h-12 w-auto max-w-40 rounded-xl object-contain"
                />
              }
            />
          )}
          <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Name" value={data.name || "-"} />
          <Row icon={<Quote className="h-3.5 w-3.5" />} label="Tagline" value={data.tagline || "-"} />
          <Row
            icon={<Highlighter className="h-3.5 w-3.5" />}
            label="Accent word"
            value={data.tagline_accent || "-"}
          />
          <Row
            dense={false}
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Description"
            value={data.description ? <ClampedText text={data.description} /> : "-"}
            multiline
          />
          <Row
            dense={false}
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Address"
            value={data.address || "-"}
            multiline
          />
          <Row
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email"
            value={linkValue(data.email, data.email ? `mailto:${data.email}` : undefined)}
          />
          <Row
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Phone"
            value={linkValue(data.phone, data.phone ? `tel:${data.phone}` : undefined)}
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard icon={<Clock className="h-3.5 w-3.5" />} title="Opening hours">
            {listedDays.length === 0 ? (
              <p className={cn("px-3 py-4 font-semibold text-admin-muted sm:px-5", VALUE_TEXT)}>
                No opening hours set.
              </p>
            ) : (
              listedDays.map((day) => {
                const hours = openingHours[day];
                return (
                  <Row
                    key={day}
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label={DAY_LABELS[day]}
                    value={`${hours?.open || "-"} - ${hours?.close || "-"}`}
                    valueClassName="tabular-nums"
                  />
                );
              })
            )}
          </SectionCard>

          <SectionCard icon={<Share2 className="h-3.5 w-3.5" />} title="Social media">
            <Row
              icon={<SiInstagram className="h-3.5 w-3.5" />}
              label="Instagram"
              value={socialValue(data.instagram, "instagram")}
            />
            <Row
              icon={<SiFacebook className="h-3.5 w-3.5" />}
              label="Facebook"
              value={socialValue(data.facebook, "facebook")}
            />
            <Row
              icon={<SiX className="h-3.5 w-3.5" />}
              label="Twitter / X"
              value={socialValue(data.twitter, "twitter")}
            />
            <Row
              icon={<SiTiktok className="h-3.5 w-3.5" />}
              label="TikTok"
              value={socialValue(data.tiktok, "tiktok")}
            />
            <Row
              icon={<SiYoutube className="h-3.5 w-3.5" />}
              label="YouTube"
              value={socialValue(data.youtube, "youtube")}
            />
          </SectionCard>

          <SectionCard icon={<Users className="h-3.5 w-3.5" />} title="Capacity">
            <Row
              icon={<Users className="h-3.5 w-3.5" />}
              label="Max capacity"
              value={data.max_capacity ? `${data.max_capacity} people` : "-"}
            />
            <Row
              icon={<Users className="h-3.5 w-3.5" />}
              label="Min capacity"
              value={
                data.private_hire_min_capacity
                  ? `${data.private_hire_min_capacity} people`
                  : "-"
              }
            />
            <Row
              icon={<Shapes className="h-3.5 w-3.5" />}
              label="Venue layout"
              value={
                <Link
                  href="/settings/venue"
                  title="Open the venue layout planner"
                  className={cn(
                    "inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-70",
                    hasVenuePlan ? "text-admin-primary" : "text-admin-error",
                  )}
                >
                  {hasVenuePlan
                    ? "Click to view venue plan..."
                    : "Click to start planning..."}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </Link>
              }
            />
          </SectionCard>
        </div>
      </div>

      <RecordSheet
        open={isEditing}
        onClose={() => setIsEditing(false)}
        mode="edit"
        title="Edit company info"
        recordId={data.id}
        formId="company-form"
        isPending={isPending}
        saveDisabled={uploadingLogo}
        onCancel={() => setIsEditing(false)}
        systemInfo={{
          createdAt: data.created_at,
          createdBy: employeeName(data.created_by),
          updatedAt: data.updated_at,
          updatedBy: employeeName(data.updated_by),
        }}
      >
        <form
          id="company-form"
          onSubmit={handleSubmit}
          className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
        >
          <SectionCard icon={<ImageIcon className="h-3.5 w-3.5" />} title="Logo">
            <div className="p-4 sm:p-5">
              {form.logo_url ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.logo_url}
                    alt="Logo preview"
                    className="h-16 w-auto max-w-50 rounded-xl border border-admin-line object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => update("logo_url", "")}
                    className="inline-flex h-9 items-center rounded-xl border border-admin-line px-3 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-admin-line py-6 transition-colors hover:border-admin-primary hover:bg-admin-surface">
                  {uploadingLogo ? (
                    <Loader2 className="mb-1 h-6 w-6 animate-spin text-admin-muted" />
                  ) : (
                    <Upload className="mb-1 h-6 w-6 text-admin-muted opacity-40" />
                  )}
                  <span className="text-[13px] font-semibold text-admin-muted">
                    {uploadingLogo ? "Uploading..." : "Upload logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Upload company logo"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </label>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={<Building2 className="h-3.5 w-3.5" />}
            title="Business details"
            className="divide-y divide-admin-line/50"
          >
            <FormRow label="Business name">
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                aria-label="Business name"
                placeholder="e.g. Don Fenticas"
                className={FIELD_INPUT}
              />
            </FormRow>

            <div>
              <FormRow label="Tagline">
                <input
                  value={form.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                  aria-label="Tagline"
                  placeholder="e.g. Live music, indie & rock, DJs and karaoke"
                  className={FIELD_INPUT}
                />
              </FormRow>
              <p className={cn(HINT, "px-4 pb-3 sm:px-5")}>
                Shown as the main headline on the public home page.
              </p>
            </div>

            <div>
              <FormRow label="Accent word">
                <input
                  value={form.tagline_accent}
                  onChange={(e) => update("tagline_accent", e.target.value)}
                  aria-label="Tagline accent word"
                  placeholder="e.g. karaoke"
                  className={FIELD_INPUT}
                />
              </FormRow>
              <p
                className={cn(
                  "px-4 pb-3 sm:px-5",
                  accentMissing
                    ? "text-[11px] font-semibold text-admin-warning"
                    : HINT,
                )}
              >
                {accentMissing
                  ? `"${form.tagline_accent}" isn't in the tagline above, so no word will be outlined.`
                  : "One word from the tagline to draw as outlined text. Leave blank for a plain headline."}
              </p>
            </div>

            <div className="space-y-2 px-4 py-3 sm:px-5">
              <label
                htmlFor="company-description"
                className="text-[11px] font-semibold tracking-wide text-admin-muted opacity-70"
              >
                Description
              </label>
              <textarea
                id="company-description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="A short description of your venue"
                className={AREA_INPUT}
              />
            </div>

            <div className="space-y-2 px-4 py-3 sm:px-5">
              <label
                htmlFor="company-address"
                className="text-[11px] font-semibold tracking-wide text-admin-muted opacity-70"
              >
                Address
              </label>
              <textarea
                id="company-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Full address"
                className={AREA_INPUT}
              />
            </div>

            <FormRow label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                aria-label="Email"
                placeholder="hello@example.com"
                className={FIELD_INPUT}
              />
            </FormRow>

            <FormRow label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                aria-label="Phone"
                placeholder="+44 ..."
                className={FIELD_INPUT}
              />
            </FormRow>
          </SectionCard>

          <SectionCard icon={<Clock className="h-3.5 w-3.5" />} title="Opening hours">
            <div className="space-y-3 p-4 sm:p-5">
              {DAYS.map((day) => {
                const hours = form.opening_hours[day] || { open: "", close: "" };
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 text-[11px] font-semibold tracking-wide text-admin-muted">
                      {DAY_LABELS[day]}
                    </span>
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) => updateHours(day, "open", e.target.value)}
                      aria-label={`${DAY_LABELS[day]} opening time`}
                      className={TIME_INPUT}
                    />
                    <span className="text-[13px] font-semibold text-admin-muted">-</span>
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) => updateHours(day, "close", e.target.value)}
                      aria-label={`${DAY_LABELS[day]} closing time`}
                      className={TIME_INPUT}
                    />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            icon={<Share2 className="h-3.5 w-3.5" />}
            title="Social media"
            className="divide-y divide-admin-line/50"
          >
            {(Object.keys(SOCIAL_META) as SocialKey[]).map((key) => (
              <FormRow key={key} label={SOCIAL_META[key].label}>
                <div className="flex flex-1 items-center justify-end gap-0.5">
                  {!form[key].includes("/") && (
                    <span
                      aria-hidden="true"
                      className="text-sm font-semibold text-admin-muted/60"
                    >
                      @
                    </span>
                  )}
                  <input
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                    onBlur={() => normaliseSocial(key)}
                    aria-label={SOCIAL_META[key].label}
                    placeholder={SOCIAL_META[key].placeholder}
                    className="w-auto min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40"
                  />
                </div>
              </FormRow>
            ))}
            <p className={cn(HINT, "px-4 pb-3 sm:px-5")}>
              Paste a profile link or type the handle - either way only the handle is
              kept.
            </p>
          </SectionCard>

          <SectionCard
            icon={<Users className="h-3.5 w-3.5" />}
            title="Capacity"
            className="divide-y divide-admin-line/50"
          >
            <FormRow label="Venue max capacity">
              <input
                type="number"
                min={0}
                value={form.max_capacity}
                onChange={(e) => update("max_capacity", e.target.value)}
                aria-label="Venue max capacity"
                placeholder="e.g. 200"
                className={cn(FIELD_INPUT, "tabular-nums")}
              />
            </FormRow>
            <FormRow label="Private hire min capacity">
              <input
                type="number"
                min={0}
                value={form.private_hire_min_capacity}
                onChange={(e) => update("private_hire_min_capacity", e.target.value)}
                aria-label="Private hire minimum capacity"
                placeholder="e.g. 30"
                className={cn(FIELD_INPUT, "tabular-nums")}
              />
            </FormRow>
          </SectionCard>

          {formError && <ErrorBox message={formError} />}
        </form>
      </RecordSheet>
    </div>
  );
}
