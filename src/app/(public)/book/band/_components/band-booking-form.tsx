"use client";

import React, { useState, useTransition, useRef } from "react";
import { createBandBooking } from "@/app/(public)/_actions/create-band-booking";
import { createClient } from "@/lib/supabase/client";
import {
  Instagram, Facebook, Youtube, Music2,
  Plus, X, CheckCircle2, Calendar, Upload, Video, Loader2, AlertCircle
} from "lucide-react";

const SOCIAL_FIELDS = [
  { key: "instagram" as const, label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourband" },
  { key: "facebook" as const, label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourband" },
  { key: "youtube" as const, label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@yourband" },
  { key: "tiktok" as const, label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@yourband" },
];

interface VideoFile {
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  error: string | null;
  uploading: boolean;
}

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 transition-all";
const labelClass = "block text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1.5";

export default function BandBookingForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [videoFiles, setVideoFiles] = useState<VideoFile[]>([]);
  const [preferredDates, setPreferredDates] = useState<string[]>(["", ""]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function handleSocial(key: string, value: string) {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
  }

  function handleDate(index: number, value: string) {
    setPreferredDates((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function addDate() {
    if (preferredDates.length < 4) setPreferredDates((prev) => [...prev, ""]);
  }

  function removeDate(index: number) {
    setPreferredDates((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    // Max 3 videos total
    const remaining = 3 - videoFiles.length;
    const toAdd = files.slice(0, remaining);

    const newEntries: VideoFile[] = toAdd.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploadedUrl: null,
      error: null,
      uploading: true,
    }));

    setVideoFiles((prev) => [...prev, ...newEntries]);

    // Upload each file to Supabase Storage
    for (let i = 0; i < toAdd.length; i++) {
      const file = toAdd[i];
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from("band-videos")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      const publicUrl = data
        ? supabase.storage.from("band-videos").getPublicUrl(data.path).data.publicUrl
        : null;

      setVideoFiles((prev) => {
        // find the matching entry by preview URL to update it
        const previewUrl = URL.createObjectURL(file);
        // Since we can't re-create the same URL, match by index offset
        const globalIndex = prev.length - toAdd.length + i;
        return prev.map((v, idx) =>
          idx === globalIndex
            ? { ...v, uploading: false, uploadedUrl: publicUrl, error: uploadError?.message ?? null }
            : v
        );
      });
    }

    // Reset file input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeVideo(index: number) {
    setVideoFiles((prev) => {
      const entry = prev[index];
      URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const stillUploading = videoFiles.some((v) => v.uploading);
    if (stillUploading) {
      setError("Please wait for all videos to finish uploading.");
      return;
    }

    const uploadedUrls = videoFiles
      .filter((v) => v.uploadedUrl)
      .map((v) => v.uploadedUrl as string);

    startTransition(async () => {
      try {
        await createBandBooking({
          booker_name: name,
          email,
          phone_no: phone || undefined,
          social_links: socialLinks,
          video_urls: uploadedUrls,
          preferred_dates: preferredDates.filter(Boolean),
          notes: notes || undefined,
        });
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center py-8 gap-4">
        <CheckCircle2 className="w-12 h-12 text-[#FDCC4B]" />
        <h3 className="text-white font-black text-xl uppercase tracking-tight">Application Received!</h3>
        <p className="text-stone-400 text-sm max-w-xs leading-relaxed">
          Thanks! We&apos;ll review your application and get back to you via email shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">

      {/* Contact Details */}
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Contact Details</p>
        <div>
          <label className={labelClass}>Your Name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Band/artist or booker name" className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email *</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 000000" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Social Media */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Social Media</p>
        {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key}>
            <label className={labelClass}>{label}</label>
            <div className="relative">
              <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
              <input type="url" value={socialLinks[key] || ""} onChange={(e) => handleSocial(key, e.target.value)}
                placeholder={placeholder} className={`${inputClass} pl-10`} />
            </div>
          </div>
        ))}
      </div>

      {/* Video Upload */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Performance Videos</p>
          <span className="text-[10px] text-stone-600 font-bold">{videoFiles.length}/3</span>
        </div>
        <p className="text-[11px] text-stone-600 -mt-1">
          Upload videos of your act so we can see you perform (MP4, WebM, MOV — max 50 MB each).
        </p>

        {/* Uploaded file previews */}
        {videoFiles.length > 0 && (
          <div className="space-y-2">
            {videoFiles.map((vf, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <Video className="w-4 h-4 text-stone-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{vf.file.name}</p>
                  {vf.uploading && (
                    <p className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Uploading…
                    </p>
                  )}
                  {!vf.uploading && vf.uploadedUrl && (
                    <p className="text-[10px] text-green-400 mt-0.5">Uploaded ✓</p>
                  )}
                  {!vf.uploading && vf.error && (
                    <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-2.5 h-2.5" /> {vf.error}
                    </p>
                  )}
                </div>
                <button title="Close" type="button" onClick={() => removeVideo(i)}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-stone-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {videoFiles.length < 3 && (
          <>
            <input
              title="Upload Videos"
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-xl py-4 text-stone-500 hover:border-[#FDCC4B]/30 hover:text-stone-400 hover:bg-white/3 transition-all text-xs font-bold uppercase tracking-wider"
            >
              <Upload className="w-4 h-4" />
              {videoFiles.length === 0 ? "Upload Videos" : "Add Another Video"}
            </button>
          </>
        )}
      </div>

      {/* Preferred Dates */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Preferred Dates</p>
        {preferredDates.map((date, i) => (
          <div key={i} className="flex gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
              <input title="Select Date" type="date" value={date} onChange={(e) => handleDate(i, e.target.value)}
                className={`${inputClass} pl-10`} style={{ colorScheme: "dark" }} />
            </div>
            {preferredDates.length > 1 && (
              <button title="Remove Date" type="button" onClick={() => removeDate(i)}
                className="shrink-0 w-10 h-10 mt-[2px] rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-stone-500 hover:text-red-400 hover:border-red-400/30 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {preferredDates.length < 4 && (
          <button title="Add Date" type="button" onClick={addDate}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-stone-500 hover:text-[#FDCC4B] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add another date
          </button>
        )}
      </div>

      {/* Additional Notes */}
      <div>
        <label className={labelClass}>Additional Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Tell us about your act, genre, set length, equipment needs…"
          rows={4} className={`${inputClass} resize-none`} />
      </div>

      {error && (
        <p className="text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending || videoFiles.some((v) => v.uploading)}
        className="w-full bg-[#FDCC4B] text-[#26300D] font-black text-sm uppercase tracking-wider rounded-xl py-4 transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FDCC4B]/20">
        {isPending ? "Submitting…" : "Submit Application"}
      </button>
    </form>
  );
}
