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
  Image as ImageIcon,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiX } from "react-icons/si";
import { updateCompanyInfo } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  RecordSheet,
  DetailCard,
  DetailCell,
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
      <div className="flex items-center gap-2 border-b border-admin-line px-4 py-2 sm:px-5 sm:py-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-admin-primary">
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

function socialHref(value: string | null, base: string) {
  if (!value) return undefined;
  if (value.startsWith("http")) return value;
  return `${base}${value.replace("@", "")}`;
}

export default function CompanyInfoClient({
  initialData,
  employees = [],
}: {
  initialData: CompanyInfo | null;
  employees?: EmployeeOption[];
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
    instagram: record?.instagram ?? "",
    facebook: record?.facebook ?? "",
    twitter: record?.twitter ?? "",
    tiktok: record?.tiktok ?? "",
    youtube: record?.youtube ?? "",
    max_capacity: record?.max_capacity?.toString() ?? "",
    private_hire_min_capacity: record?.private_hire_min_capacity?.toString() ?? "",
  });

  const [form, setForm] = useState(() => emptyForm(initialData));

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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
    fd.set("instagram", form.instagram);
    fd.set("facebook", form.facebook);
    fd.set("twitter", form.twitter);
    fd.set("tiktok", form.tiktok);
    fd.set("youtube", form.youtube);
    fd.set("max_capacity", form.max_capacity);
    fd.set("private_hire_min_capacity", form.private_hire_min_capacity);

    setFormError(null);
    startTransition(async () => {
      const res = await updateCompanyInfo(fd);
      if (res.success) {
        setData({
          ...data,
          ...form,
          max_capacity: parseInt(form.max_capacity) || null,
          private_hire_min_capacity: parseInt(form.private_hire_min_capacity) || null,
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
    <div className="animate-in space-y-4 px-4 py-4 duration-500 fade-in sm:px-8 sm:py-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-admin-ink">Company info</h2>
        <button
          type="button"
          onClick={openEdit}
          className="inline-flex h-9 items-center rounded-xl border border-admin-primary px-4 text-[13px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft active:scale-95"
        >
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SectionCard icon={<Building2 className="h-3.5 w-3.5" />} title="Business details">
          {data.logo_url && (
            <div className="flex items-center gap-3 border-b border-admin-line px-4 py-3 sm:px-5">
              <span className="shrink-0 text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                Logo
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.logo_url}
                alt="Company logo"
                className="ml-auto h-12 w-auto max-w-40 rounded-xl object-contain"
              />
            </div>
          )}
          <DetailCell dense icon={<Building2 className="h-3.5 w-3.5" />} label="Name" value={data.name || "-"} />
          <DetailCell dense icon={<Quote className="h-3.5 w-3.5" />} label="Tagline" value={data.tagline || "-"} />
          <DetailCell
            dense
            icon={<Highlighter className="h-3.5 w-3.5" />}
            label="Accent word"
            value={data.tagline_accent || "-"}
          />
          <DetailCell
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Description"
            value={data.description || "-"}
            multiline
          />
          <DetailCell
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Address"
            value={data.address || "-"}
            multiline
          />
          <DetailCell
            dense
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email"
            value={linkValue(data.email, data.email ? `mailto:${data.email}` : undefined)}
          />
          <DetailCell
            dense
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Phone"
            value={linkValue(data.phone, data.phone ? `tel:${data.phone}` : undefined)}
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard icon={<Clock className="h-3.5 w-3.5" />} title="Opening hours">
            {listedDays.length === 0 ? (
              <p className="px-4 py-4 text-[13px] font-medium text-admin-muted sm:px-5">
                No opening hours set.
              </p>
            ) : (
              listedDays.map((day) => {
                const hours = openingHours[day];
                return (
                  <DetailCell
                    key={day}
                    dense
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
            <DetailCell
              dense
              icon={<SiInstagram className="h-3.5 w-3.5" />}
              label="Instagram"
              value={linkValue(data.instagram, socialHref(data.instagram, "https://instagram.com/"))}
            />
            <DetailCell
              dense
              icon={<SiFacebook className="h-3.5 w-3.5" />}
              label="Facebook"
              value={linkValue(data.facebook, socialHref(data.facebook, "https://facebook.com/"))}
            />
            <DetailCell
              dense
              icon={<SiX className="h-3.5 w-3.5" />}
              label="Twitter / X"
              value={linkValue(data.twitter, socialHref(data.twitter, "https://x.com/"))}
            />
            <DetailCell
              dense
              icon={<SiTiktok className="h-3.5 w-3.5" />}
              label="TikTok"
              value={linkValue(data.tiktok, socialHref(data.tiktok, "https://tiktok.com/@"))}
            />
            <DetailCell
              dense
              icon={<SiYoutube className="h-3.5 w-3.5" />}
              label="YouTube"
              value={linkValue(data.youtube, socialHref(data.youtube, "https://youtube.com/"))}
            />
          </SectionCard>

          <SectionCard icon={<Users className="h-3.5 w-3.5" />} title="Capacity">
            <DetailCell
              dense
              icon={<Users className="h-3.5 w-3.5" />}
              label="Max capacity"
              value={data.max_capacity ? `${data.max_capacity} people` : "-"}
            />
            <DetailCell
              dense
              icon={<Users className="h-3.5 w-3.5" />}
              label="Private hire min"
              value={
                data.private_hire_min_capacity
                  ? `${data.private_hire_min_capacity} people`
                  : "-"
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
            <FormRow label="Instagram">
              <input
                value={form.instagram}
                onChange={(e) => update("instagram", e.target.value)}
                aria-label="Instagram"
                placeholder="@donfenticas"
                className={FIELD_INPUT}
              />
            </FormRow>
            <FormRow label="Facebook">
              <input
                value={form.facebook}
                onChange={(e) => update("facebook", e.target.value)}
                aria-label="Facebook"
                placeholder="facebook.com/..."
                className={FIELD_INPUT}
              />
            </FormRow>
            <FormRow label="Twitter / X">
              <input
                value={form.twitter}
                onChange={(e) => update("twitter", e.target.value)}
                aria-label="Twitter or X"
                placeholder="@handle"
                className={FIELD_INPUT}
              />
            </FormRow>
            <FormRow label="TikTok">
              <input
                value={form.tiktok}
                onChange={(e) => update("tiktok", e.target.value)}
                aria-label="TikTok"
                placeholder="@handle"
                className={FIELD_INPUT}
              />
            </FormRow>
            <FormRow label="YouTube">
              <input
                value={form.youtube}
                onChange={(e) => update("youtube", e.target.value)}
                aria-label="YouTube"
                placeholder="youtube.com/..."
                className={FIELD_INPUT}
              />
            </FormRow>
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
