"use client";

import React, { useState, useTransition, useRef } from "react";
import { createBandBooking } from "@/app/(public)/_actions/create-band-booking";
import { createClient } from "@/lib/supabase/client";
import {
  Instagram, Facebook, Youtube, Music2,
  Plus, X, CheckCircle2, Calendar, Upload, Video, Loader2, AlertCircle,
  ChevronDown, ChevronRight, ArrowLeft, ExternalLink,
} from "lucide-react";

const SOCIAL_FIELDS = [
  {
    key: "instagram" as const,
    label: "Instagram",
    icon: Instagram,
    prefix: "instagram.com/",
    placeholder: "yourhandle",
    urlBuilder: (h: string) => `https://instagram.com/${h}`,
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    icon: Facebook,
    prefix: "facebook.com/",
    placeholder: "yourpage",
    urlBuilder: (h: string) => `https://facebook.com/${h}`,
  },
  {
    key: "youtube" as const,
    label: "YouTube",
    icon: Youtube,
    prefix: "youtube.com/@",
    placeholder: "yourchannel",
    urlBuilder: (h: string) => `https://youtube.com/@${h}`,
  },
  {
    key: "tiktok" as const,
    label: "TikTok",
    icon: Music2,
    prefix: "tiktok.com/@",
    placeholder: "yourhandle",
    urlBuilder: (h: string) => `https://tiktok.com/@${h}`,
  },
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

const STEPS = [
  { number: 1, title: "Your Act", subtitle: "Tell us about your act." },
  { number: 2, title: "Contact", subtitle: "How do we reach you?" },
  { number: 3, title: "Online & Media", subtitle: "Links and performance videos." },
  { number: 4, title: "Availability", subtitle: "When can you play?" },
];

export default function BandBookingForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [actType, setActType] = useState("band");
  const [genre, setGenre] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
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

  function handleNext() {
    setStepError(null);
    if (step === 1) {
      if (!groupName.trim()) { setStepError("Please enter your act or group name."); return; }
      if (!genre.trim()) { setStepError("Please enter your genre."); return; }
    }
    if (step === 2) {
      if (!name.trim()) { setStepError("Please enter your name."); return; }
      if (!email.trim() || !email.includes("@")) { setStepError("Please enter a valid email address."); return; }
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStepError(null);
    setStep((s) => s - 1);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

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
        const globalIndex = prev.length - toAdd.length + i;
        return prev.map((v, idx) =>
          idx === globalIndex
            ? { ...v, uploading: false, uploadedUrl: publicUrl, error: uploadError?.message ?? null }
            : v
        );
      });
    }

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

    const builtSocialLinks: Record<string, string> = {};
    SOCIAL_FIELDS.forEach(({ key, urlBuilder }) => {
      const handle = socialLinks[key]?.trim();
      if (handle) builtSocialLinks[key] = urlBuilder(handle);
    });

    startTransition(async () => {
      try {
        await createBandBooking({
          group_name: groupName,
          type: actType,
          genre: genre || undefined,
          payment_amount: paymentAmount ? Number(paymentAmount) : undefined,
          booker_name: name,
          email,
          phone_no: phone || undefined,
          social_links: builtSocialLinks,
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

  const currentStep = STEPS[step - 1];

  return (
    <form onSubmit={handleSubmit} className="space-y-0">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s.number < step
                  ? "w-6 bg-[#FDCC4B]"
                  : s.number === step
                  ? "w-8 bg-[#FDCC4B]"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-600">
          {step} of {STEPS.length}
        </span>
      </div>

      {/* Step heading */}
      <div className="mb-7">
        <h4 className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-1">
          {currentStep.title}
        </h4>
        <p className="text-stone-500 text-xs font-medium">{currentStep.subtitle}</p>
      </div>

      {/* Step content */}
      <div key={step} className="space-y-4 animate-in fade-in duration-200">

        {/* Step 1: Act Details */}
        {step === 1 && (
          <>
            <div>
              <label className={labelClass}>Act / Group Name <span className="text-red-400">*</span></label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. The Midnight Echo"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Type <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select
                    title="Type of Act"
                    value={actType}
                    onChange={(e) => setActType(e.target.value)}
                    className={`${inputClass} appearance-none pr-9`}
                  >
                    <option value="band">Band</option>
                    <option value="singer">Singer / Solo Artist</option>
                    <option value="dj">DJ</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Genre <span className="text-red-400">*</span></label>
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Rock, Jazz, Pop"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Expected Payment (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          </>
        )}

        {/* Step 2: Contact Details */}
        {step === 2 && (
          <>
            <div>
              <label className={labelClass}>Your Name <span className="text-red-400">*</span></label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Booker or contact name"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+44 7700 000000"
                  className={inputClass}
                />
              </div>
            </div>
          </>
        )}

        {/* Step 3: Online & Media */}
        {step === 3 && (
          <>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Social Media</p>
              {SOCIAL_FIELDS.map(({ key, label, icon: Icon, prefix, placeholder, urlBuilder }) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#FDCC4B]/40 focus-within:ring-1 focus-within:ring-[#FDCC4B]/20 transition-all">
                    <Icon className="w-4 h-4 text-stone-600 shrink-0 ml-3.5" />
                    <span className="text-stone-600 text-sm pl-2 pr-0.5 whitespace-nowrap select-none">{prefix}</span>
                    <input
                      type="text"
                      value={socialLinks[key] || ""}
                      onChange={(e) => handleSocial(key, e.target.value.replace(/^@/, ""))}
                      placeholder={placeholder}
                      className="flex-1 bg-transparent py-3 pr-3 text-sm text-white placeholder:text-stone-600 focus:outline-none"
                    />
                    {socialLinks[key] && (
                      <a
                        href={urlBuilder(socialLinks[key])}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${label} link in a new tab`}
                        className="shrink-0 w-10 self-stretch flex items-center justify-center text-stone-500 hover:text-[#FDCC4B] transition-colors border-l border-white/10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Performance Videos</p>
                <span className="text-[10px] text-stone-600 font-bold">{videoFiles.length}/3</span>
              </div>
              <p className="text-[11px] text-stone-600 -mt-1">
                Upload videos of your act (MP4, WebM, MOV — max 50 MB each).
              </p>

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
                      <button title="Remove" type="button" onClick={() => removeVideo(i)}
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-stone-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
          </>
        )}

        {/* Step 4: Availability */}
        {step === 4 && (
          <>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Preferred Dates</p>
              {preferredDates.map((date, i) => (
                <div key={i} className="flex gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                    <input
                      title="Select Date"
                      type="date"
                      value={date}
                      onChange={(e) => handleDate(i, e.target.value)}
                      className={`${inputClass} pl-10 input-scheme-dark`}
                    />
                  </div>
                  {preferredDates.length > 1 && (
                    <button title="Remove Date" type="button" onClick={() => removeDate(i)}
                      className="shrink-0 w-10 h-10 mt-0.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-stone-500 hover:text-red-400 hover:border-red-400/30 transition-all">
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

            <div className="pt-2">
              <label className={labelClass}>Additional Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Set length, equipment needs, anything else we should know…"
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </div>
          </>
        )}

      </div>

      {/* Step error */}
      {stepError && (
        <p className="mt-4 text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {stepError}
        </p>
      )}

      {/* Submit error */}
      {error && step === 4 && (
        <p className="mt-4 text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Navigation buttons */}
      <div className={`flex gap-3 mt-8 ${step === 1 ? "" : ""}`}>
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 h-14 px-5 rounded-xl border border-white/10 text-stone-400 font-black text-xs uppercase tracking-wider hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            key="next"
            type="button"
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 h-14 bg-[#FDCC4B] text-[#26300D] font-black text-sm uppercase tracking-wider rounded-xl transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] shadow-lg shadow-[#FDCC4B]/20"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            disabled={isPending || videoFiles.some((v) => v.uploading)}
            className="flex-1 h-14 bg-[#FDCC4B] text-[#26300D] font-black text-sm uppercase tracking-wider rounded-xl transition-all hover:bg-[#FDCC4B]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#FDCC4B]/20"
          >
            {isPending ? "Submitting…" : "Submit Application"}
          </button>
        )}
      </div>

    </form>
  );
}
