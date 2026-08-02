"use client";

import React, { useState, useTransition } from "react";
import {
  Building2, MapPin, Mail, Phone, Users,
  Loader2, Pencil, Save, X, Upload, Trash2, Clock, Quote, Highlighter,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiX } from "react-icons/si";
import { updateCompanyInfo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
}

const sectionLabel = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#5F624F] opacity-40 px-1 mb-3";
const fieldLabel = "text-[10px] font-bold uppercase tracking-wide text-[#5F624F] ml-1";
const inputClasses = "h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-2 focus:ring-[#5C4033]/10 focus:border-[#5C4033]";

function InfoRow({ icon, label, value, href }: {
  icon: React.ReactNode; label: string; value: string | null; href?: string;
}) {
  const display = value || "-";
  return (
    <div className="flex items-center gap-3 border-b border-[#E6DFC8] px-5 py-4 last:border-0">
      <div className="flex shrink-0 items-center gap-2 text-[#5F624F] opacity-60">
        {icon}
        <span className="text-[10px] font-bold tracking-wide whitespace-nowrap uppercase">{label}</span>
      </div>
      {href && value ? (
        <Link href={href} target="_blank" className="flex-1 text-right font-black text-sm text-[#5C4033] underline underline-offset-2 transition-opacity hover:opacity-70">
          {display}
        </Link>
      ) : (
        <span className={cn("flex-1 text-right font-black text-sm", value ? "text-[#1F1F1A]" : "text-[#5F624F] opacity-40")}>
          {display}
        </span>
      )}
    </div>
  );
}

export default function CompanyInfoClient({ initialData }: { initialData: CompanyInfo | null }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<CompanyInfo | null>(initialData);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [form, setForm] = useState({
    name: data?.name ?? "",
    logo_url: data?.logo_url ?? "",
    address: data?.address ?? "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
    tagline: data?.tagline ?? "",
    tagline_accent: data?.tagline_accent ?? "",
    description: data?.description ?? "",
    opening_hours: (data?.opening_hours ?? {}) as OpeningHours,
    instagram: data?.instagram ?? "",
    facebook: data?.facebook ?? "",
    twitter: data?.twitter ?? "",
    tiktok: data?.tiktok ?? "",
    youtube: data?.youtube ?? "",
    max_capacity: data?.max_capacity?.toString() ?? "",
    private_hire_min_capacity: data?.private_hire_min_capacity?.toString() ?? "",
  });

  const handleEdit = () => {
    setForm({
      name: data?.name ?? "",
      logo_url: data?.logo_url ?? "",
      address: data?.address ?? "",
      email: data?.email ?? "",
      phone: data?.phone ?? "",
      tagline: data?.tagline ?? "",
      tagline_accent: data?.tagline_accent ?? "",
      description: data?.description ?? "",
      opening_hours: (data?.opening_hours ?? {}) as OpeningHours,
      instagram: data?.instagram ?? "",
      facebook: data?.facebook ?? "",
      twitter: data?.twitter ?? "",
      tiktok: data?.tiktok ?? "",
      youtube: data?.youtube ?? "",
      max_capacity: data?.max_capacity?.toString() ?? "",
      private_hire_min_capacity: data?.private_hire_min_capacity?.toString() ?? "",
    });
    setIsEditing(true);
  };

  const handleSave = () => {
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
        toast.error(res.error ?? "Failed to save");
      }
    });
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const accentMissing =
    form.tagline_accent.trim().length > 0 &&
    !form.tagline.toLowerCase().includes(form.tagline_accent.trim().toLowerCase());

  const updateHours = (day: string, field: "open" | "close", value: string) => {
    setForm((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: { ...(prev.opening_hours[day] || { open: "", close: "" }), [field]: value },
      },
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const ext = file.name.split(".").pop();
    const path = `logo-${Date.now()}.${ext}`;
    const { data: uploaded, error } = await supabaseBrowser.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      setUploadingLogo(false);
      return;
    }
    const publicUrl = supabaseBrowser.storage.from("gallery").getPublicUrl(uploaded.path).data.publicUrl;
    setForm((prev) => ({ ...prev, logo_url: publicUrl }));
    setUploadingLogo(false);
  };

  if (!data) {
    return (
      <div className="p-8 text-center text-[#5F624F]">
        <p className="text-sm font-bold">No company information found.</p>
      </div>
    );
  }

  const openingHours = (data.opening_hours ?? {}) as OpeningHours;

  return (
    <div className="animate-in space-y-6 px-4 py-4 duration-500 fade-in sm:px-8 sm:py-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-2xl tracking-tighter text-[#1F1F1A] uppercase">Company Info</h1>
          <p className="mt-1 text-xs font-bold tracking-wider text-[#5F624F] uppercase opacity-60">Business details and social links</p>
        </div>
        {!isEditing ? (
          <Button onClick={handleEdit} className="h-12 rounded-2xl bg-[#B45309] px-6 font-black text-[10px] tracking-widest text-white uppercase shadow-lg transition-transform hover:bg-[#B45309]/85 active:scale-95">
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isPending} className="h-12 rounded-2xl bg-[#1B4332] px-6 font-black text-[10px] tracking-widest text-white uppercase shadow-lg transition-transform hover:bg-[#1B4332]/85 active:scale-95">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save</>}
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(false)} className="h-12 rounded-2xl border-2 border-[#E6DFC8] text-[10px] font-bold tracking-wide text-[#5F624F] uppercase">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="animate-in space-y-8 duration-300 fade-in slide-in-from-bottom-2">
          <div>
            <h3 className={sectionLabel}>Logo</h3>
            <div className="rounded-3xl border-2 border-[#E6DFC8] bg-white p-6 shadow-sm">
              {form.logo_url ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_url} alt="Logo" className="h-16 w-auto rounded-xl border border-[#E6DFC8] object-contain" />
                  <Button variant="outline" onClick={() => update("logo_url", "")} className="h-9 rounded-xl border-[#E6DFC8] text-[10px] font-bold text-[#5F624F] uppercase">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E6DFC8] py-6 transition-colors hover:border-[#5C4033] hover:bg-[#F7F4EA]">
                  {uploadingLogo ? <Loader2 className="mb-1 h-6 w-6 animate-spin text-[#5F624F]" /> : <Upload className="mb-1 h-6 w-6 text-[#5F624F] opacity-40" />}
                  <span className="font-black text-[10px] tracking-wide text-[#5F624F] uppercase">{uploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                </label>
              )}
            </div>
          </div>

          <div>
            <h3 className={sectionLabel}>Business Details</h3>
            <div className="space-y-5 rounded-3xl border-2 border-[#E6DFC8] bg-white p-6 shadow-sm">
              <div className="space-y-2">
                <Label className={fieldLabel}>Business Name</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClasses} placeholder="e.g. Don Fenticas" />
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel} htmlFor="company-tagline">Tagline</Label>
                <Input id="company-tagline" value={form.tagline} onChange={(e) => update("tagline", e.target.value)} className={inputClasses} placeholder="e.g. Live music, indie & rock, DJs and karaoke" />
                <p className="ml-1 text-[10px] font-bold text-[#5F624F] opacity-60">Shown as the main headline on the public home page.</p>
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel} htmlFor="company-tagline-accent">Tagline Accent Word</Label>
                <Input id="company-tagline-accent" value={form.tagline_accent} onChange={(e) => update("tagline_accent", e.target.value)} className={inputClasses} placeholder="e.g. karaoke" />
                {accentMissing ? (
                  <p className="ml-1 text-[10px] font-bold text-[#B45309]">
                    &ldquo;{form.tagline_accent}&rdquo; isn&apos;t in the tagline above, so no word will be outlined.
                  </p>
                ) : (
                  <p className="ml-1 text-[10px] font-bold text-[#5F624F] opacity-60">One word from the tagline to draw as outlined text. Leave blank for a plain headline.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel}>Description</Label>
                <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="min-h-20 resize-none rounded-2xl border-2 border-[#E6DFC8] bg-white p-4 text-sm font-bold focus:border-[#5C4033] focus:ring-2 focus:ring-[#5C4033]/10" placeholder="A short description of your venue" />
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel}>Address</Label>
                <Textarea value={form.address} onChange={(e) => update("address", e.target.value)} className="min-h-20 resize-none rounded-2xl border-2 border-[#E6DFC8] bg-white p-4 text-sm font-bold focus:border-[#5C4033] focus:ring-2 focus:ring-[#5C4033]/10" placeholder="Full address" />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={fieldLabel}>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClasses} placeholder="hello@example.com" />
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabel}>Phone</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClasses} placeholder="+44 ..." />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className={sectionLabel}>Opening Hours</h3>
            <div className="space-y-3 rounded-3xl border-2 border-[#E6DFC8] bg-white p-4 shadow-sm sm:p-6">
              {DAYS.map((day) => {
                const hours = form.opening_hours[day] || { open: "", close: "" };
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 font-black text-[11px] tracking-wide text-[#5F624F] uppercase">{DAY_LABELS[day]}</span>
                    <Input
                      type="time"
                      value={hours.open}
                      onChange={(e) => updateHours(day, "open", e.target.value)}
                      className="h-10 flex-1 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold"
                      title={`${DAY_LABELS[day]} opening`}
                    />
                    <span className="text-xs font-bold text-[#5F624F]">–</span>
                    <Input
                      type="time"
                      value={hours.close}
                      onChange={(e) => updateHours(day, "close", e.target.value)}
                      className="h-10 flex-1 rounded-xl border-2 border-[#E6DFC8] bg-white px-3 text-sm font-bold"
                      title={`${DAY_LABELS[day]} closing`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className={sectionLabel}>Social Media</h3>
            <div className="space-y-5 rounded-3xl border-2 border-[#E6DFC8] bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2"><Label className={fieldLabel}>Instagram</Label><Input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} className={inputClasses} placeholder="@donfenticas" /></div>
                <div className="space-y-2"><Label className={fieldLabel}>Facebook</Label><Input value={form.facebook} onChange={(e) => update("facebook", e.target.value)} className={inputClasses} placeholder="facebook.com/..." /></div>
                <div className="space-y-2"><Label className={fieldLabel}>Twitter / X</Label><Input value={form.twitter} onChange={(e) => update("twitter", e.target.value)} className={inputClasses} placeholder="@handle" /></div>
                <div className="space-y-2"><Label className={fieldLabel}>TikTok</Label><Input value={form.tiktok} onChange={(e) => update("tiktok", e.target.value)} className={inputClasses} placeholder="@handle" /></div>
              </div>
              <div className="space-y-2"><Label className={fieldLabel}>YouTube</Label><Input value={form.youtube} onChange={(e) => update("youtube", e.target.value)} className={inputClasses} placeholder="youtube.com/..." /></div>
            </div>
          </div>

          <div>
            <h3 className={sectionLabel}>Capacity</h3>
            <div className="rounded-3xl border-2 border-[#E6DFC8] bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2"><Label className={fieldLabel}>Venue Max Capacity</Label><Input type="number" min={0} value={form.max_capacity} onChange={(e) => update("max_capacity", e.target.value)} className={inputClasses} placeholder="e.g. 200" /></div>
                <div className="space-y-2"><Label className={fieldLabel}>Private Hire Min Capacity</Label><Input type="number" min={0} value={form.private_hire_min_capacity} onChange={(e) => update("private_hire_min_capacity", e.target.value)} className={inputClasses} placeholder="e.g. 30" /></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in space-y-8 duration-300 fade-in">
          {data.logo_url && (
            <div>
              <h3 className={sectionLabel}>Logo</h3>
              <div className="rounded-3xl border-2 border-[#E6DFC8] bg-white p-5 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.logo_url} alt="Logo" className="h-16 w-auto object-contain" />
              </div>
            </div>
          )}

          <div>
            <h3 className={sectionLabel}>Business Details</h3>
            <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white shadow-sm">
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Name" value={data.name} />
              <InfoRow icon={<Quote className="h-4 w-4" />} label="Tagline" value={data.tagline} />
              <InfoRow icon={<Highlighter className="h-4 w-4" />} label="Accent Word" value={data.tagline_accent} />
              {data.description && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Description" value={data.description} />}
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={data.address} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={data.email} href={data.email ? `mailto:${data.email}` : undefined} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={data.phone} href={data.phone ? `tel:${data.phone}` : undefined} />
            </div>
          </div>

          {Object.keys(openingHours).length > 0 && (
            <div>
              <h3 className={sectionLabel}>Opening Hours</h3>
              <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white shadow-sm">
                {DAYS.map((day) => {
                  const hours = openingHours[day];
                  if (!hours?.open && !hours?.close) return null;
                  return (
                    <div key={day} className="flex items-center gap-3 border-b border-[#E6DFC8] px-5 py-3 last:border-0">
                      <div className="flex shrink-0 items-center gap-2 text-[#5F624F] opacity-60">
                        <Clock className="h-4 w-4" />
                        <span className="w-8 text-[10px] font-bold tracking-wide uppercase">{DAY_LABELS[day]}</span>
                      </div>
                      <span className="flex-1 text-right font-black text-sm text-[#1F1F1A]">
                        {hours.open || "-"} – {hours.close || "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className={sectionLabel}>Social Media</h3>
            <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white shadow-sm">
              <InfoRow icon={<SiInstagram className="h-4 w-4" />} label="Instagram" value={data.instagram} href={data.instagram ? `https://instagram.com/${data.instagram.replace("@", "")}` : undefined} />
              <InfoRow icon={<SiFacebook className="h-4 w-4" />} label="Facebook" value={data.facebook} href={data.facebook?.startsWith("http") ? data.facebook : data.facebook ? `https://facebook.com/${data.facebook}` : undefined} />
              <InfoRow
                icon={<SiX className="h-4 w-4" />}
                label="Twitter / X" value={data.twitter} href={data.twitter ? `https://x.com/${data.twitter.replace("@", "")}` : undefined}
              />
              <InfoRow
                icon={<SiTiktok className="h-4 w-4" />}
                label="TikTok" value={data.tiktok} href={data.tiktok ? `https://tiktok.com/${data.tiktok.replace("@", "")}` : undefined}
              />
              <InfoRow
                icon={<SiYoutube className="h-4 w-4" />}
                label="YouTube" value={data.youtube} href={data.youtube?.startsWith("http") ? data.youtube : data.youtube ? `https://youtube.com/${data.youtube}` : undefined}
              />
            </div>
          </div>

          <div>
            <h3 className={sectionLabel}>Capacity</h3>
            <div className="overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-white shadow-sm">
              <InfoRow icon={<Users className="h-4 w-4" />} label="Max Capacity" value={data.max_capacity ? `${data.max_capacity} people` : null} />
              <InfoRow icon={<Users className="h-4 w-4" />} label="Private Hire Min" value={data.private_hire_min_capacity ? `${data.private_hire_min_capacity} people` : null} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
