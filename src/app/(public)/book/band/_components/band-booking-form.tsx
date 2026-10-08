"use client";

import React, { useState, useTransition, useRef } from "react";
import { createBandBooking, type BandPosterChoice } from "@/app/(public)/_actions/create-band-booking";
import { findActPoster } from "@/app/(public)/_actions/find-act-poster";
import { actImageFileProblem, uploadActImage } from "@/lib/act-image-upload";
import { uploadVideoResumable, type ResumableHandle } from "@/lib/resumable-upload";
import { megabytes } from "@/lib/video-upload-limit";
import { randomId } from "@/lib/random-id";
import { showFirstFrame } from "@/lib/video-preview";
import { X, CheckCircle2, Upload, Video, Loader2, AlertCircle,
  ChevronRight, ChevronLeft, Info, CalendarDays, Share2, Image as ImageIcon,
  Mic, Guitar, Music, User, Mail, Phone, PoundSterling, MessageSquareQuote,
} from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { format, startOfToday, startOfMonth } from "date-fns";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cleanMoneyInput, formatMoneyInput, parseMoney } from "@/lib/money-input";
import { NOTES_MAX_LENGTH } from "@/lib/notes-limit";
import { FieldError, incompleteButtonClass } from "@/app/(public)/book/_components/field-error";
import { SpotifyArtistField } from "./spotify-artist-field";
import { SocialLinksField, type SocialLinks } from "./social-links-field";
import { VideoLinksField, type VideoLinkEntry } from "./video-links-field";
import { socialUrl, type SocialPlatform } from "@/lib/social-links";
import { SiInstagram, SiMessenger } from "react-icons/si";
import type { MessageChannel } from "@/lib/meta/channels";
import {
  defaultPreferredChannel,
  preferredChannelOptions,
  type BookingArrival,
} from "@/lib/meta/preferred-channel";
import type { SpotifyArtist } from "@/lib/spotify-artists";
import { stepBackButtonClass, stepButtonRowClass, stepPrimaryButtonClass } from "@/app/(public)/book/_components/step-button-styles";
import { scrollFormToRest, useFormScrollRest } from "@/app/(public)/book/_components/use-form-scroll-rest";
import { cleanPhoneInput, isValidPhone, PHONE_ERROR } from "@/lib/phone";
import { attempt } from "@/lib/attempt";

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
const MAX_DATES = 8;

type PosterState =
  | { kind: "existing"; imageId: string; url: string }
  | { kind: "upload"; url: string; path: string; previewUrl: string };

function posterChoice(poster: PosterState | null): BandPosterChoice | null {
  if (!poster) return null;
  return poster.kind === "existing" ? { keepImageId: poster.imageId } : { url: poster.url, path: poster.path };
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bDj\b/g, "DJ");

const inputClass =
  "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 transition-all";
const iconInputClass = inputClass.replace("px-4", "pl-11 pr-4");
const shadcnFieldClass =
  "h-auto rounded-xl border-white/10 bg-black/40 py-3 pr-4 pl-11 text-sm text-white shadow-none placeholder:text-stone-500 focus-visible:border-[#FDCC4B]/40 focus-visible:ring-1 focus-visible:ring-[#FDCC4B]/20 md:text-sm";
const labelClass = "block text-[11px] font-black uppercase tracking-widest text-stone-400 mb-1.5";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPOTIFY_UNCONFIRMED_ERROR =
  "Pick your Spotify profile from the list, paste your profile link, or clear the box to skip it.";
const NO_VIDEO_ERROR = "Please add at least one performance video - paste a link or upload a clip.";

const STEPS = [
  { number: 1, title: "Your Act", subtitle: "Tell us about your act." },
  { number: 2, title: "Contact", subtitle: "How do we reach you?" },
  { number: 3, title: "Videos & Links", subtitle: "Show us your act and where to find you." },
  { number: 4, title: "Availability", subtitle: "When can you play?" },
  { number: 5, title: "Fee & Notes", subtitle: "Your fee and anything else." },
];

interface BandBookingFormProps {
  typeOptions: { value: string; label: string }[];
  availableDates: string[];
  bandNights: string;
  maxVideoBytes: number;
  arrival?: BookingArrival | null;
}

const calendarThemeVars = {
  "--primary": "#FDCC4B",
  "--primary-foreground": "#26300D",
  "--accent": "rgba(255,255,255,0.10)",
  "--accent-foreground": "#FDCC4B",
  "--background": "transparent",
  "--muted-foreground": "#a8a29e",
  "--border": "rgba(255,255,255,0.10)",
  "--ring": "#FDCC4B",
} as React.CSSProperties;

function IconField({
  icon: Icon,
  multiline,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  multiline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <div
        className={`pointer-events-none absolute left-0 flex pl-3.5 ${
          multiline ? "top-3.5" : "inset-y-0 items-center"
        }`}
      >
        <Icon
          className="h-4 w-4 text-stone-600 transition-colors duration-200 group-focus-within:text-[#fdcc4b]"
          aria-hidden={true}
        />
      </div>
      {children}
    </div>
  );
}

function mediaSectionClass(invalid: boolean) {
  return `space-y-3 rounded-2xl border bg-black/20 p-3.5 sm:p-4 ${invalid ? "border-red-500/40" : "border-white/10"}`;
}

function MediaSectionTitle({
  icon,
  title,
  required,
}: {
  icon: React.ReactNode;
  title: string;
  required?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5">{icon}</span>
      <h4 className="truncate text-sm font-semibold text-white">{title}</h4>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-pill font-bold tracking-wide uppercase ${
          required ? "bg-gold/15 text-gold" : "bg-white/5 text-stone-400"
        }`}
      >
        {required ? "Required" : "Optional"}
      </span>
    </div>
  );
}

function MediaSection({
  icon,
  title,
  required,
  aside,
  hint,
  invalid = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  required?: boolean;
  aside?: React.ReactNode;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={mediaSectionClass(invalid)}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <MediaSectionTitle icon={icon} title={title} required={required} />
          {aside}
        </div>
        {hint && <p className="text-xs leading-relaxed text-ink-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function BandBookingForm({
  typeOptions,
  availableDates,
  bandNights,
  maxVideoBytes,
  arrival = null,
}: BandBookingFormProps) {
  const maxVideoMb = megabytes(maxVideoBytes);
  const [isPending, startTransition] = useTransition();
  useFormScrollRest();
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
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(
    arrival?.channel === "instagram" && arrival.handle ? { instagram: arrival.handle } : {}
  );
  const [preferredChoice, setPreferredChoice] = useState<MessageChannel | null>(null);
  const preferredOptions = preferredChannelOptions({ email, instagram: socialLinks.instagram, arrival });
  const chosenOption = preferredOptions.find((o) => o.channel === preferredChoice);
  const preferredChannel: MessageChannel = chosenOption?.available
    ? chosenOption.channel
    : defaultPreferredChannel(preferredOptions, arrival);
  const preferredDetail = preferredOptions.find((o) => o.channel === preferredChannel)?.detail ?? null;
  const [spotifyArtist, setSpotifyArtist] = useState<SpotifyArtist | null>(null);
  const [poster, setPoster] = useState<PosterState | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [posterLookedUpFor, setPosterLookedUpFor] = useState("");
  const [spotifyMatchedFor, setSpotifyMatchedFor] = useState("");
  const [spotifyAutoPicked, setSpotifyAutoPicked] = useState(false);
  const [spotifyQuery, setSpotifyQuery] = useState("");
  const spotifyUnconfirmed = !spotifyArtist && spotifyQuery.trim().length > 0;
  const [videoFiles, setVideoFiles] = useState<VideoFile[]>([]);
  const [videoLinks, setVideoLinks] = useState<VideoLinkEntry[]>([]);
  const totalVideos = videoLinks.length + videoFiles.length;
  const [preferredDates, setPreferredDates] = useState<Date[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadHandles = useRef<Record<string, ResumableHandle>>({});

  function removeDate(d: Date) {
    setPreferredDates((prev) => prev.filter((x) => x.getTime() !== d.getTime()));
  }

  const sortedDates = [...preferredDates].sort((a, b) => a.getTime() - b.getTime());
  const datesFull = preferredDates.length >= MAX_DATES;
  const isPicked = (d: Date) => preferredDates.some((x) => x.getTime() === d.getTime());

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
      if (phone.trim() && !isValidPhone(phone)) errors.phone = PHONE_ERROR;
    }
    if (step === 3 && spotifyUnconfirmed) errors.spotify = SPOTIFY_UNCONFIRMED_ERROR;
    return errors;
  }

  const stepComplete =
    Object.keys(missingFields()).length === 0 &&
    (step !== 3 || (totalVideos > 0 && videoFiles.every((v) => v.uploadedUrl)));

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
    if (step === 2 && !spotifyArtist) setSpotifyQuery(groupName);
    if (step === 2) void lookUpExistingPoster();
    if (step === 3) {
      if (totalVideos === 0) {
        setVideoError(NO_VIDEO_ERROR);
        return;
      }
      if (videoFiles.some((v) => !v.uploadedUrl)) {
        setVideoError("Please wait for all videos to finish uploading (or remove any that failed).");
        return;
      }
      setVideoError(null);
    }
    setStep((s) => s + 1);
    scrollFormToRest();
  }

  /* Playing here again under the same name and email brings back the poster
     we already hold; a changed name or email starts the look-up afresh. */
  async function lookUpExistingPoster() {
    const key = `${email.trim().toLowerCase()}|${groupName.trim().toLowerCase()}`;
    if (key === posterLookedUpFor) return;
    setPosterLookedUpFor(key);
    if (poster?.kind === "existing") setPoster(null);
    const found = await findActPoster(email, groupName).catch(() => null);
    if (found) setPoster((current) => (current?.kind === "upload" ? current : { kind: "existing", ...found }));
  }

  async function handlePosterSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = actImageFileProblem(file);
    if (problem) {
      setPosterError(problem);
      return;
    }
    setPosterError(null);
    setPosterUploading(true);
    const previewUrl = URL.createObjectURL(file);
    await attempt(
      async () => {
        const uploaded = await uploadActImage(file, "applications");
        setPoster({ kind: "upload", ...uploaded, previewUrl });
      },
      (err) => {
        URL.revokeObjectURL(previewUrl);
        setPosterError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      }
    );
    setPosterUploading(false);
  }

  function removePoster() {
    if (poster?.kind === "upload") URL.revokeObjectURL(poster.previewUrl);
    setPoster(null);
    setPosterError(null);
  }

  function handleBack() {
    setFieldErrors({});
    setStep((s) => s - 1);
    scrollFormToRest();
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

    const remaining = MAX_VIDEOS - totalVideos;
    const toAdd = files.slice(0, remaining);

    for (const file of toAdd) {
      const id = randomId();
      const previewUrl = URL.createObjectURL(file);

      if (file.size > maxVideoBytes) {
        setVideoFiles((prev) => [
          ...prev,
          { id, file, previewUrl, uploadedUrl: null, description: "", progress: 0, error: `Too large to upload (max ${maxVideoMb} MB). Paste a link to it instead.`, uploading: false },
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

    if (totalVideos === 0) {
      setVideoError(NO_VIDEO_ERROR);
      setStep(3);
      return;
    }

    if (videoFiles.some((v) => !v.uploadedUrl)) {
      setVideoError("Please wait for all videos to finish uploading (or remove any that failed).");
      setStep(3);
      return;
    }

    const uploaded = videoFiles.filter((v) => v.uploadedUrl);
    const videoUrls = [...videoLinks.map((l) => l.url), ...uploaded.map((v) => v.uploadedUrl as string)];
    const videoDescriptions = [...videoLinks, ...uploaded].map((v) => v.description.trim());

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
          payment_amount: parseMoney(paymentAmount) ?? undefined,
          booker_name: name,
          email,
          phone_no: phone || undefined,
          social_links: builtSocialLinks,
          spotify_url: spotifyArtist?.url,
          video_urls: videoUrls,
          video_descriptions: videoDescriptions,
          preferred_dates: sortedDates.map((d) => format(d, "yyyy-MM-dd")),
          notes: notes || undefined,
          preferred_channel: preferredChannel,
          source_channel: arrival?.channel ?? null,
          source_channel_id: arrival?.channelId ?? null,
          poster: posterChoice(poster),
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
              <IconField icon={Mic}>
                <input
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    clearFieldError("groupName");
                    if (spotifyAutoPicked) {
                      setSpotifyArtist(null);
                      setSpotifyAutoPicked(false);
                    }
                  }}
                  placeholder="e.g. The Midnight Echo"
                  aria-label="Act or group name"
                  aria-invalid={!!fieldErrors.groupName}
                  className={iconInputClass}
                />
              </IconField>
              <FieldError message={fieldErrors.groupName} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Type <span className="text-red-400">*</span></label>
                <IconField icon={Guitar}>
                  <Select value={actType} onValueChange={setActType}>
                    <SelectTrigger aria-label="Type of Act" className={`${iconInputClass} [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-ink-2`}>
                      <SelectValue>{selectedTypeLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{titleCase(o.label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </IconField>
              </div>
              <div>
                <label className={labelClass}>Genre <span className="text-red-400">*</span></label>
                <IconField icon={Music}>
                  <input
                    value={genre}
                    onChange={(e) => { setGenre(e.target.value); clearFieldError("genre"); }}
                    placeholder="e.g. Rock, Jazz, Pop"
                    aria-label="Genre"
                    aria-invalid={!!fieldErrors.genre}
                    className={iconInputClass}
                  />
                </IconField>
                <FieldError message={fieldErrors.genre} />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label htmlFor="band-booker-name" className={labelClass}>Your Name <span className="text-red-400">*</span></label>
              <IconField icon={User}>
                <input
                  id="band-booker-name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                  placeholder="Booker or contact name"
                  aria-invalid={!!fieldErrors.name}
                  className={iconInputClass}
                />
              </IconField>
              <FieldError message={fieldErrors.name} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="band-email" className={labelClass}>Email <span className="text-red-400">*</span></label>
                <IconField icon={Mail}>
                  <input
                    id="band-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    placeholder="your@email.com"
                    aria-invalid={!!fieldErrors.email}
                    className={iconInputClass}
                  />
                </IconField>
                <FieldError message={fieldErrors.email} />
              </div>
              <div>
                <label htmlFor="band-phone" className={labelClass}>Phone</label>
                <IconField icon={Phone}>
                  <input
                    id="band-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={24}
                    value={phone}
                    onChange={(e) => { setPhone(cleanPhoneInput(e.target.value)); clearFieldError("phone"); }}
                    placeholder="+44 7700 000000"
                    aria-invalid={!!fieldErrors.phone}
                    className={iconInputClass}
                  />
                </IconField>
                <FieldError message={fieldErrors.phone} />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="space-y-3 sm:space-y-4">
            <MediaSection
              icon={<ImageIcon className="h-4 w-4 text-gold" aria-hidden="true" />}
              title="Poster"
              hint={
                poster?.kind === "existing"
                  ? "Playing here again? This is the poster we already have for you - keep it or replace it."
                  : "The picture we use on What's On and on your event poster. Square or landscape works best."
              }
              invalid={!!posterError}
            >
              {poster ? (
                <div className="flex items-center gap-3">
                  <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={poster.kind === "upload" ? poster.previewUrl : poster.url}
                      alt="Your poster"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <label className="flex h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-btn font-semibold text-white transition-colors hover:border-gold/40 hover:text-gold">
                      {posterUploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                      Replace
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Replace poster"
                        className="hidden"
                        onChange={handlePosterSelect}
                        disabled={posterUploading}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={removePoster}
                      className="flex h-11 w-fit items-center gap-2 rounded-xl px-4 text-btn font-semibold text-stone-400 transition-colors hover:text-white"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-white/15 bg-black/20 px-4 py-5 text-center transition-colors hover:border-gold/40">
                  {posterUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gold" aria-hidden="true" />
                  ) : (
                    <Upload className="h-6 w-6 text-stone-500" aria-hidden="true" />
                  )}
                  <span className="text-btn font-semibold text-white">{posterUploading ? "Uploading…" : "Add a poster"}</span>
                  <span className="text-meta text-stone-500">JPEG, PNG or WebP, up to 10 MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Upload a poster"
                    className="hidden"
                    onChange={handlePosterSelect}
                    disabled={posterUploading}
                  />
                </label>
              )}
              {posterError && <FieldError message={posterError} />}
            </MediaSection>

            <MediaSection
              icon={<Video className="h-4 w-4 text-gold" aria-hidden="true" />}
              title="Videos"
              required
              aside={
                <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-stone-400 tabular-nums">
                  {totalVideos} of {MAX_VIDEOS}
                </span>
              }
              hint="Add at least one clip of you playing live. Paste a link from YouTube, Instagram, TikTok, Google Drive and more, or upload one."
              invalid={!!videoError}
            >
              <VideoLinksField
                links={videoLinks}
                onChange={(next) => {
                  setVideoLinks(next);
                  setVideoError(null);
                }}
                canAdd={totalVideos < MAX_VIDEOS}
                invalid={!!videoError}
              />

              {videoFiles.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {videoFiles.map((vf) => (
                    <div key={vf.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      <div className="relative aspect-video w-full bg-black">
                        <video
                          src={vf.previewUrl}
                          preload="metadata"
                          playsInline
                          onLoadedMetadata={showFirstFrame}
                          controls
                          className="h-full w-full object-contain"
                        >
                          <track kind="captions" />
                        </video>
                        {vf.uploading && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5">
                            <div className="flex items-center gap-1 text-xs font-medium text-stone-200">
                              <Loader2 className="h-3 w-3 animate-spin" /> Uploading… {vf.progress}%
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
                          <button
                            title={`Remove ${vf.file.name}`}
                            aria-label={`Remove ${vf.file.name}`}
                            type="button"
                            onClick={() => removeVideo(vf.id)}
                            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-all hover:bg-red-400/10 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {!vf.uploading && vf.uploadedUrl && (
                          <p className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle2 className="h-3 w-3" /> Uploaded
                          </p>
                        )}
                        {!vf.uploading && vf.error && (
                          <p className="flex items-center gap-1 text-xs text-red-400">
                            <AlertCircle className="h-3 w-3" /> {vf.error}
                          </p>
                        )}
                        <input
                          type="text"
                          aria-label={`Description for ${vf.file.name}`}
                          maxLength={120}
                          value={vf.description}
                          onChange={(e) => setVideoDescription(vf.id, e.target.value)}
                          placeholder="Add a short description (optional)"
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white placeholder:text-stone-400 focus:border-[#FDCC4B]/40 focus:ring-1 focus:ring-[#FDCC4B]/20 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalVideos < MAX_VIDEOS && (
                <>
                  <div className="flex items-center gap-3 text-xs text-stone-500" aria-hidden="true">
                    <span className="h-px flex-1 bg-white/10" />
                    or
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
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
                    className={`flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed bg-gold/5 px-3 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold/10 active:bg-gold/15 ${
                      videoError ? "border-red-500/50" : "border-gold/40 hover:border-gold/70"
                    }`}
                  >
                    <Upload className="h-4 w-4 text-gold" aria-hidden="true" />
                    {videoFiles.length === 0 ? "Upload a clip" : "Upload another clip"}
                    <span className="text-xs font-medium text-ink-2">up to {maxVideoMb} MB</span>
                  </button>
                </>
              )}

              {videoError && (
                <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {videoError}
                </p>
              )}
            </MediaSection>

            <MediaSection
              icon={<SiSpotify className="h-4 w-4 text-[#1DB954]" aria-hidden="true" />}
              title="Spotify"
              hint="We look up your act name. Pick your profile or paste its link."
            >
              <SpotifyArtistField
                artist={spotifyArtist}
                query={spotifyQuery}
                onQueryChange={(next) => {
                  setSpotifyQuery(next);
                  clearFieldError("spotify");
                }}
                blockedError={fieldErrors.spotify}
                autoMatch={spotifyMatchedFor !== groupName.trim()}
                onAutoMatched={(picked) => {
                  setSpotifyMatchedFor(groupName.trim());
                  setSpotifyAutoPicked(picked);
                }}
                onChange={(next) => {
                  setSpotifyArtist(next);
                  setSpotifyAutoPicked(false);
                  clearFieldError("spotify");
                }}
              />
            </MediaSection>

            <section className={mediaSectionClass(false)}>
              <SocialLinksField
                links={socialLinks}
                onChange={setSocialLinks}
                heading={
                  <MediaSectionTitle
                    icon={<Share2 className="h-4 w-4 text-gold" aria-hidden="true" />}
                    title="Socials"
                  />
                }
              />
            </section>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className={`${labelClass} mb-0!`}>Preferred nights</p>
                <span
                  aria-live="polite"
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
                    datesFull ? "border-gold/60 bg-gold/15 text-gold" : "border-white/10 text-stone-400"
                  }`}
                >
                  {preferredDates.length} of {MAX_DATES} picked
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
                Tap every night you could play. The more you pick, the easier it is to fit you in.
              </p>
            </div>

            {availableDates.length === 0 ? (
              <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-ink-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                <span>
                  Every stage night is booked up right now. Carry on, and tell us when you&apos;re free on the next
                  step.
                </span>
              </p>
            ) : (
              <div
                style={calendarThemeVars}
                className="rounded-2xl border border-white/10 bg-black/20 px-1 pt-1 pb-2"
              >
                <Calendar
                  mode="multiple"
                  max={MAX_DATES}
                  selected={preferredDates}
                  onSelect={(dates) => setPreferredDates((dates ?? []).filter(isDateAvailable))}
                  disabled={(date) => !isDateAvailable(date) || (datesFull && !isPicked(date))}
                  startMonth={startOfMonth(firstAvailable ?? startOfToday())}
                  endMonth={lastAvailable ? startOfMonth(lastAvailable) : undefined}
                  defaultMonth={firstAvailable ?? new Date()}
                  weekStartsOn={1}
                  className="mx-auto bg-transparent p-1 text-white [--cell-size:2.5rem] min-[400px]:[--cell-size:2.75rem]"
                />
                <p className="px-2 text-center text-[11px] leading-snug text-stone-500">
                  Faded nights are already booked or not open to bands.
                </p>
              </div>
            )}

            {datesFull && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs leading-relaxed text-ink"
              >
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                <span>
                  All {MAX_DATES} nights picked. To choose a different night, remove one below.
                </span>
              </p>
            )}

            {sortedDates.length > 0 ? (
              <ul aria-label="Nights you picked" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sortedDates.map((d) => (
                  <li
                    key={d.getTime()}
                    className="flex h-10 items-center justify-between rounded-full border border-gold/40 bg-gold/10 pl-3.5 text-xs font-semibold whitespace-nowrap text-ink"
                  >
                    {format(d, "EEE d MMM")}
                    <button
                      type="button"
                      aria-label={`Remove ${format(d, "EEEE d MMMM")}`}
                      onClick={() => removeDate(d)}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : availableDates.length > 0 ? (
              <p className="text-xs text-ink-2">No nights picked yet. They&apos;re optional, so you can skip this.</p>
            ) : null}

            <p className="flex items-start gap-2 border-t border-white/10 pt-3 text-xs leading-relaxed text-stone-400">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />
              <span>
                Bands play on {bandNights}, when no other live music is on. Can&apos;t make any of these? Tell
                us on the next step.
              </span>
            </p>
          </div>
        )}

        {step === 5 && (
          <>
            <div>
              <label htmlFor="band-fee" className={labelClass}>Your Fee (£)</label>
              <IconField icon={PoundSterling}>
                <Input
                  id="band-fee"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-describedby="band-fee-hint"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(cleanMoneyInput(e.target.value))}
                  onBlur={() => setPaymentAmount(formatMoneyInput(paymentAmount))}
                  placeholder="0.00"
                  className={`${shadcnFieldClass} tabular-nums`}
                />
              </IconField>
              <p id="band-fee-hint" className="mt-1.5 text-xs leading-relaxed text-ink-2">
                What you&apos;d charge for the night. Leave it blank if you&apos;d rather we make an offer.
              </p>
            </div>

            <div className="sm:pt-2">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="band-notes" className={labelClass}>Additional Notes</label>
                <span
                  className={`text-xs tabular-nums ${
                    notes.length >= NOTES_MAX_LENGTH ? "text-gold" : "text-stone-500"
                  }`}
                >
                  {notes.length}/{NOTES_MAX_LENGTH}
                </span>
              </div>
              <p className="-mt-0.5 mb-2 text-xs leading-relaxed text-ink-2">
                {datesFull
                  ? "Free on more nights than you could pick? List them here."
                  : "Can't make the nights on the calendar? Tell us when you're free."}
              </p>
              <IconField icon={MessageSquareQuote} multiline>
                <Textarea
                  id="band-notes"
                  value={notes}
                  maxLength={NOTES_MAX_LENGTH}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Other nights you could play, set length, kit you'll bring…"
                  className={`${shadcnFieldClass} max-h-60 min-h-28 resize-none overflow-y-auto leading-relaxed [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin]`}
                />
              </IconField>
            </div>

            <div className="sm:pt-2">
              <label className={labelClass}>How should we get in touch?</label>
              <IconField icon={preferredChannel === "instagram" ? SiInstagram : preferredChannel === "messenger" ? SiMessenger : Mail}>
                <Select value={preferredChannel} onValueChange={(v) => setPreferredChoice(v as MessageChannel)}>
                  <SelectTrigger aria-label="How should we get in touch?" className={`${iconInputClass} [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-ink-2`}>
                    <SelectValue>{preferredOptions.find((o) => o.channel === preferredChannel)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {preferredOptions.map((o) => (
                      <SelectItem key={o.channel} value={o.channel} disabled={!o.available}>
                        {o.label}
                        {o.detail ? ` · ${o.detail}` : o.why ? ` · ${o.why}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </IconField>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">
                {preferredDetail
                  ? `We'll reply to ${preferredDetail}.`
                  : "Pick where you'd like our replies to go."}
              </p>
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
            {isPending ? (
              "Submitting…"
            ) : (
              <>
                Submit
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>

    </form>
  );
}
