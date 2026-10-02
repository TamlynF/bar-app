"use client";

import React, { useState, useTransition, useRef } from "react";
import { createBandBooking } from "@/app/(public)/_actions/create-band-booking";
import { uploadVideoResumable, type ResumableHandle } from "@/lib/resumable-upload";
import { X, CheckCircle2, Upload, Video, Loader2, AlertCircle,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import { format, startOfToday, startOfMonth } from "date-fns";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { FieldError, incompleteButtonClass } from "@/app/(public)/book/_components/field-error";
import { SpotifyArtistField } from "./spotify-artist-field";
import { SocialLinksField, type SocialLinks } from "./social-links-field";
import { socialUrl, type SocialPlatform } from "@/lib/social-links";
import type { SpotifyArtist } from "@/lib/spotify-artists";
import { stepBackButtonClass, stepButtonRowClass, stepPrimaryButtonClass } from "@/app/(public)/book/_components/step-button-styles";

interface VideoFile {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  description: string;
  progress: number;
  error: string | null;
  uploading: boolean;
}

const MAX_VIDEOS = 10;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MB
const MAX_DATES = 8;

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bDj\b/g, "DJ");

const inputClass =
  "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 transition-all";
const labelClass = "block text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1.5";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS = [
  { number: 1, title: "Your Act", subtitle: "Tell us about your act." },
  { number: 2, title: "Contact", subtitle: "How do we reach you?" },
  { number: 3, title: "Online & Media", subtitle: "Links and performance videos." },
  { number: 4, title: "Availability", subtitle: "When can you play?" },
  { number: 5, title: "Fee & Notes", subtitle: "Your fee and anything else." },
];

interface BandBookingFormProps {
  typeOptions: { value: string; label: string }[];
  availableDates: string[];
}

export default function BandBookingForm({ typeOptions, availableDates }: BandBookingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [videoError, setVideoError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [actType, setActType] = useState(typeOptions[0]?.value ?? "");
  const [genre, setGenre] = useState("");
  const selectedTypeOption = typeOptions.find((o) => o.value === actType);
  const selectedTypeLabel = selectedTypeOption ? titleCase(selectedTypeOption.label) : null;
  const [paymentAmount, setPaymentAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [spotifyArtist, setSpotifyArtist] = useState<SpotifyArtist | null>(null);
  const [videoFiles, setVideoFiles] = useState<VideoFile[]>([]);
  const [preferredDates, setPreferredDates] = useState<Date[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadHandles = useRef<Record<string, ResumableHandle>>({});

  function removeDate(d: Date) {
    setPreferredDates((prev) => prev.filter((x) => x.getTime() !== d.getTime()));
  }

  const sortedDates = [...preferredDates].sort((a, b) => a.getTime() - b.getTime());

  const availableDateSet = new Set(availableDates);
  const isDateAvailable = (d: Date) => availableDateSet.has(format(d, "yyyy-MM-dd"));
  const firstAvailable = availableDates.length ? new Date(`${availableDates[0]}T00:00:00`) : null;
  const lastAvailable = availableDates.length
    ? new Date(`${availableDates[availableDates.length - 1]}T00:00:00`)
    : null;

  function missingFields(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (step === 1) {
      if (!groupName.trim()) errors.groupName = "Please enter your act or group name.";
      if (!genre.trim()) errors.genre = "Please enter your genre.";
    }
    if (step === 2) {
      if (!name.trim()) errors.name = "Please enter your name.";
      if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Please enter a valid email address.";
    }
    return errors;
  }

  const stepComplete =
    Object.keys(missingFields()).length === 0 &&
    (step !== 3 || (videoFiles.length > 0 && videoFiles.every((v) => v.uploadedUrl)));

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleNext() {
    const errors = missingFields();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (step === 3) {
      if (videoFiles.length === 0) {
        setVideoError("Please upload at least one performance video.");
        return;
      }
      if (videoFiles.some((v) => !v.uploadedUrl)) {
        setVideoError("Please wait for all videos to finish uploading (or remove any that failed).");
        return;
      }
      setVideoError(null);
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setFieldErrors({});
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVideo(id: string, patch: Partial<VideoFile>) {
    setVideoFiles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function setVideoDescription(id: string, value: string) {
    updateVideo(id, { description: value });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setVideoError(null);

    const remaining = MAX_VIDEOS - videoFiles.length;
    const toAdd = files.slice(0, remaining);

    for (const file of toAdd) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);

      if (file.size > MAX_VIDEO_BYTES) {
        setVideoFiles((prev) => [
          ...prev,
          { id, file, previewUrl, uploadedUrl: null, description: "", progress: 0, error: "File too large (max 250 MB).", uploading: false },
        ]);
        continue;
      }

      setVideoFiles((prev) => [
        ...prev,
        { id, file, previewUrl, uploadedUrl: null, description: "", progress: 0, error: null, uploading: true },
      ]);

      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      uploadHandles.current[id] = uploadVideoResumable(file, path, {
        onProgress: (pct) => updateVideo(id, { progress: pct }),
        onSuccess: (publicUrl) => {
          updateVideo(id, { uploading: false, uploadedUrl: publicUrl, progress: 100 });
          delete uploadHandles.current[id];
        },
        onError: (message) => {
          updateVideo(id, { uploading: false, error: message });
          delete uploadHandles.current[id];
        },
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeVideo(id: string) {
    uploadHandles.current[id]?.abort();
    delete uploadHandles.current[id];
    setVideoFiles((prev) => {
      const entry = prev.find((v) => v.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((v) => v.id !== id);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (videoFiles.length === 0) {
      setVideoError("Please upload at least one performance video.");
      setStep(3);
      return;
    }

    if (videoFiles.some((v) => !v.uploadedUrl)) {
      setVideoError("Please wait for all videos to finish uploading (or remove any that failed).");
      setStep(3);
      return;
    }

    const uploaded = videoFiles.filter((v) => v.uploadedUrl);
    const uploadedUrls = uploaded.map((v) => v.uploadedUrl as string);
    const videoDescriptions = uploaded.map((v) => v.description.trim());

    const builtSocialLinks: Record<string, string> = {};
    for (const [platform, handle] of Object.entries(socialLinks) as [SocialPlatform, string][]) {
      if (handle.trim()) builtSocialLinks[platform] = socialUrl(platform, handle.trim());
    }

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
          spotify_url: spotifyArtist?.url,
          video_urls: uploadedUrls,
          video_descriptions: videoDescriptions,
          preferred_dates: sortedDates.map((d) => format(d, "yyyy-MM-dd")),
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
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-[#FDCC4B]" />
        <h3 className="font-black text-xl tracking-tight text-white uppercase">Application Received!</h3>
        <p className="max-w-xs text-sm leading-relaxed text-stone-400">
          Thanks! We&apos;ll review your application and get back to you via email shortly.
        </p>
      </div>
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <form onSubmit={handleSubmit} className="space-y-0">

      <div className="mb-4 flex items-center justify-between sm:mb-8">
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
        <span className={labelClass}>
          {step} of {STEPS.length}
        </span>
      </div>

      <div className="mb-4 sm:mb-7">
        <h4 className="mb-1 font-black text-xl leading-none sm:text-2xl tracking-tight text-white uppercase">
          {currentStep.title}
        </h4>
        <p className="text-sm font-medium text-ink-2 sm:text-xs sm:text-stone-500">{currentStep.subtitle}</p>
      </div>

      <div key={step} className="animate-in space-y-3 duration-200 fade-in sm:space-y-4">

        {step === 1 && (
          <>
            <div>
              <label className={labelClass}>Act / Group Name <span className="text-red-400">*</span></label>
              <input
                value={groupName}
                onChange={(e) => { setGroupName(e.target.value); clearFieldError("groupName"); }}
                placeholder="e.g. The Midnight Echo"
                aria-invalid={!!fieldErrors.groupName}
                className={inputClass}
              />
              <FieldError message={fieldErrors.groupName} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Type <span className="text-red-400">*</span></label>
                <Select value={actType} onValueChange={setActType}>
                  <SelectTrigger aria-label="Type of Act" className={`${inputClass} pr-4 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-ink-2`}>
                    <SelectValue>{selectedTypeLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{titleCase(o.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelClass}>Genre <span className="text-red-400">*</span></label>
                <input
                  value={genre}
                  onChange={(e) => { setGenre(e.target.value); clearFieldError("genre"); }}
                  placeholder="e.g. Rock, Jazz, Pop"
                  aria-invalid={!!fieldErrors.genre}
                  className={inputClass}
                />
                <FieldError message={fieldErrors.genre} />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className={labelClass}>Your Name <span className="text-red-400">*</span></label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                placeholder="Booker or contact name"
                aria-invalid={!!fieldErrors.name}
                className={inputClass}
              />
              <FieldError message={fieldErrors.name} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                  placeholder="your@email.com"
                  aria-invalid={!!fieldErrors.email}
                  className={inputClass}
                />
                <FieldError message={fieldErrors.email} />
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

        {step === 3 && (
          <>
            <div className="space-y-3">
              <SocialLinksField links={socialLinks} onChange={setSocialLinks} labelClassName={`${labelClass} mb-0!`} />
            </div>

            <div className="space-y-3 sm:pt-2">
              <p className={labelClass}>Spotify profile link</p>
              <SpotifyArtistField artist={spotifyArtist} initialQuery={groupName} onChange={setSpotifyArtist} />
            </div>

            <div className="space-y-3 sm:pt-2">
              <div className="flex items-center justify-between">
                <p className={labelClass}>Performance Videos <span className="text-red-400">*</span></p>
                <span className="text-[10px] font-bold text-stone-400">{videoFiles.length}/{MAX_VIDEOS}</span>
              </div>
              <p className="-mt-1 text-[11px] text-stone-500">
                Upload at least one video of your act (MP4, WebM, MOV - max 250 MB each).
              </p>

              {videoFiles.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {videoFiles.map((vf) => (
                    <div key={vf.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      <div className="relative aspect-video w-full bg-black">
                        <video
                          src={`${vf.previewUrl}#t=0.1`}
                          preload="metadata"
                          controls
                          className="h-full w-full object-contain"
                        >
                          <track kind="captions" />
                        </video>
                        {vf.uploading && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-medium text-stone-200">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Uploading… {vf.progress}%
                            </div>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
                              <div
                                style={{ "--progress": `${vf.progress}%` } as React.CSSProperties}
                                className="h-full w-(--progress) rounded-full bg-[#FDCC4B] transition-all"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 p-3">
                        <div className="flex items-center gap-2">
                          <Video className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-white">{vf.file.name}</p>
                          <button title={`Remove ${vf.file.name}`} type="button" onClick={() => removeVideo(vf.id)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-stone-600 transition-all hover:bg-red-400/10 hover:text-red-400">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {!vf.uploading && vf.uploadedUrl && (
                          <p className="flex items-center gap-1 text-[10px] text-green-400">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Uploaded
                          </p>
                        )}
                        {!vf.uploading && vf.error && (
                          <p className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertCircle className="h-2.5 w-2.5" /> {vf.error}
                          </p>
                        )}
                        <input
                          type="text"
                          aria-label={`Description for ${vf.file.name}`}
                          maxLength={120}
                          value={vf.description}
                          onChange={(e) => setVideoDescription(vf.id, e.target.value)}
                          placeholder="Add a short description (optional)"
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-stone-400 focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {videoFiles.length < MAX_VIDEOS && (
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
                    className={`flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed bg-gold/5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold/10 active:bg-gold/15 sm:py-4 ${
                      videoError ? "border-red-500/50" : "border-gold/40 hover:border-gold/70"
                    }`}
                  >
                    <Upload className="h-4 w-4 text-gold" aria-hidden="true" />
                    {videoFiles.length === 0 ? "Upload videos" : "Add another video"}
                  </button>
                </>
              )}

              {videoError && (
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
                  <AlertCircle className="h-3 w-3 shrink-0" /> {videoError}
                </p>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className={labelClass}>Preferred Dates</p>
                <span className="text-[10px] font-bold text-stone-400">{preferredDates.length}/{MAX_DATES}</span>
              </div>

              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[auto_1fr]">
                <div
                  style={{
                    "--primary": "#FDCC4B",
                    "--primary-foreground": "#26300D",
                    "--accent": "rgba(255,255,255,0.10)",
                    "--accent-foreground": "#FDCC4B",
                    "--background": "transparent",
                    "--muted-foreground": "#a8a29e",
                    "--border": "rgba(255,255,255,0.10)",
                    "--ring": "#FDCC4B",
                  } as React.CSSProperties}
                  className="flex justify-center rounded-2xl border border-white/10 bg-white/5 p-2"
                >
                  <Calendar
                    mode="multiple"
                    max={MAX_DATES}
                    selected={preferredDates}
                    onSelect={(dates) => setPreferredDates((dates ?? []).filter(isDateAvailable))}
                    disabled={(date) => !isDateAvailable(date)}
                    startMonth={startOfMonth(firstAvailable ?? startOfToday())}
                    endMonth={lastAvailable ? startOfMonth(lastAvailable) : undefined}
                    defaultMonth={firstAvailable ?? new Date()}
                    className="bg-transparent text-white [--cell-size:1.9rem]"
                  />
                </div>

                {availableDates.length === 0 ? (
                  <p className="flex items-center text-[11px] text-stone-500">
                    No stage slots are open at the moment. Carry on and add a note on the next step
                    and we&apos;ll be in touch.
                  </p>
                ) : sortedDates.length > 0 ? (
                  <div className="flex flex-wrap content-start gap-2">
                    {sortedDates.map((d) => (
                      <span
                        key={d.getTime()}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 py-1 pr-1 pl-3 text-xs font-medium whitespace-nowrap text-white"
                      >
                        {format(d, "EEE, d MMM yyyy")}
                        <button
                          title={`Remove ${format(d, "d MMM")}`}
                          type="button"
                          onClick={() => removeDate(d)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-red-400/10 hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center text-[11px] text-stone-600">No dates selected yet.</p>
                )}
              </div>

              <p className="text-[11px] text-stone-500">
                Only nights with a free 2-hour stage slot are selectable - Fridays, Saturdays, and
                public holidays (plus the night before).
              </p>
            </div>

          </>
        )}

        {step === 5 && (
          <>
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

            <div className="sm:pt-2">
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

      {error && step === 5 && (
        <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-400">
          {error}
        </p>
      )}

      <div className={stepButtonRowClass}>
        {step > 1 && (
          <button type="button" onClick={handleBack} className={stepBackButtonClass}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
        )}
        {step < 5 ? (
          <button
            key="next"
            type="button"
            onClick={handleNext}
            className={`${stepPrimaryButtonClass} ${stepComplete ? "" : incompleteButtonClass}`}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button key="submit" type="submit" disabled={isPending} className={stepPrimaryButtonClass}>
            {isPending ? "Submitting…" : "Submit Application"}
          </button>
        )}
      </div>

    </form>
  );
}
