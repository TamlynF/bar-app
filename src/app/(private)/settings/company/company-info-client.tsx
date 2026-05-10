"use client";

import React, { useState, useTransition } from "react";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Instagram,
  Facebook,
  Users,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { updateCompanyInfo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

interface CompanyInfo {
  id: number;
  name: string | null;
  logo_url: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
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
const inputClasses = "h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white text-base font-bold px-4 focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D]";

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
}) {
  const display = value || "—";
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
      </div>
      {href && value ? (
        <Link
          href={href}
          target="_blank"
          className="text-sm font-black text-right flex-1 text-[#26300D] underline underline-offset-2 hover:opacity-70 transition-opacity"
        >
          {display}
        </Link>
      ) : (
        <span className={cn("text-sm font-black text-right flex-1", value ? "text-[#1F1F1A]" : "text-[#5F624F] opacity-40")}>
          {display}
        </span>
      )}
    </div>
  );
}

export default function CompanyInfoClient({
  initialData,
}: {
  initialData: CompanyInfo | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<CompanyInfo | null>(initialData);

  const [form, setForm] = useState({
    name: data?.name ?? "",
    logo_url: data?.logo_url ?? "",
    address: data?.address ?? "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
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
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));

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

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (!data) {
    return (
      <div className="p-8 text-center text-[#5F624F]">
        <p className="text-sm font-bold">No company information found. Please create the table in Supabase first.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1F1F1A] uppercase tracking-tighter">
            Company Info
          </h1>
          <p className="text-xs text-[#5F624F] font-bold opacity-60 uppercase tracking-wider mt-1">
            Business details and social links
          </p>
        </div>
        {!isEditing ? (
          <Button
            onClick={handleEdit}
            className="h-12 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] px-6 shadow-lg active:scale-95 transition-transform"
          >
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="h-12 rounded-2xl bg-[#26300D] text-[#FDCC4B] font-black uppercase tracking-[0.1em] text-[10px] px-6 shadow-lg active:scale-95 transition-transform"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="h-12 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-bold uppercase tracking-wide text-[10px]"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Business Details */}
          <div>
            <h3 className={sectionLabel}>Business Details</h3>
            <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="space-y-2">
                <Label className={fieldLabel}>Business Name</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClasses} placeholder="e.g. Don Fenticas" />
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel}>Logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} className={inputClasses} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel}>Address</Label>
                <Textarea value={form.address} onChange={(e) => update("address", e.target.value)} className="rounded-2xl border-2 border-[#E6DFC8] bg-white text-sm font-bold p-4 focus:ring-2 focus:ring-[#26300D]/10 focus:border-[#26300D] resize-none min-h-[80px]" placeholder="Full address" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

          {/* Social Media */}
          <div>
            <h3 className={sectionLabel}>Social Media</h3>
            <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className={fieldLabel}>Instagram</Label>
                  <Input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} className={inputClasses} placeholder="@donfenticas" />
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabel}>Facebook</Label>
                  <Input value={form.facebook} onChange={(e) => update("facebook", e.target.value)} className={inputClasses} placeholder="facebook.com/..." />
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabel}>Twitter / X</Label>
                  <Input value={form.twitter} onChange={(e) => update("twitter", e.target.value)} className={inputClasses} placeholder="@handle" />
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabel}>TikTok</Label>
                  <Input value={form.tiktok} onChange={(e) => update("tiktok", e.target.value)} className={inputClasses} placeholder="@handle" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className={fieldLabel}>YouTube</Label>
                <Input value={form.youtube} onChange={(e) => update("youtube", e.target.value)} className={inputClasses} placeholder="youtube.com/..." />
              </div>
            </div>
          </div>

          {/* Capacity */}
          <div>
            <h3 className={sectionLabel}>Capacity</h3>
            <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl p-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className={fieldLabel}>Venue Max Capacity</Label>
                  <Input type="number" min={0} value={form.max_capacity} onChange={(e) => update("max_capacity", e.target.value)} className={inputClasses} placeholder="e.g. 200" />
                </div>
                <div className="space-y-2">
                  <Label className={fieldLabel}>Private Hire Min Capacity</Label>
                  <Input type="number" min={0} value={form.private_hire_min_capacity} onChange={(e) => update("private_hire_min_capacity", e.target.value)} className={inputClasses} placeholder="e.g. 30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Business Details */}
          <div>
            <h3 className={sectionLabel}>Business Details</h3>
            <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden shadow-sm">
              <InfoRow icon={<Building2 className="w-4 h-4" />} label="Name" value={data.name} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={data.address} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={data.email} href={data.email ? `mailto:${data.email}` : undefined} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={data.phone} href={data.phone ? `tel:${data.phone}` : undefined} />
            </div>
          </div>

          {/* Social Media */}
          <div>
            <h3 className={sectionLabel}>Social Media</h3>
            <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden shadow-sm">
              <InfoRow icon={<Instagram className="w-4 h-4" />} label="Instagram" value={data.instagram} href={data.instagram ? `https://instagram.com/${data.instagram.replace("@", "")}` : undefined} />
              <InfoRow icon={<Facebook className="w-4 h-4" />} label="Facebook" value={data.facebook} href={data.facebook?.startsWith("http") ? data.facebook : data.facebook ? `https://facebook.com/${data.facebook}` : undefined} />
              <InfoRow
                icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>}
                label="Twitter / X"
                value={data.twitter}
                href={data.twitter ? `https://x.com/${data.twitter.replace("@", "")}` : undefined}
              />
              <InfoRow
                icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>}
                label="TikTok"
                value={data.tiktok}
                href={data.tiktok ? `https://tiktok.com/${data.tiktok.replace("@", "")}` : undefined}
              />
              <InfoRow
                icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>}
                label="YouTube"
                value={data.youtube}
                href={data.youtube?.startsWith("http") ? data.youtube : data.youtube ? `https://youtube.com/${data.youtube}` : undefined}
              />
            </div>
          </div>

          {/* Capacity */}
          <div>
            <h3 className={sectionLabel}>Capacity</h3>
            <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden shadow-sm">
              <InfoRow icon={<Users className="w-4 h-4" />} label="Max Capacity" value={data.max_capacity ? `${data.max_capacity} people` : null} />
              <InfoRow icon={<Users className="w-4 h-4" />} label="Private Hire Min" value={data.private_hire_min_capacity ? `${data.private_hire_min_capacity} people` : null} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
