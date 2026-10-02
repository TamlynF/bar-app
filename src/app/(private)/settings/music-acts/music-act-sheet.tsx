"use client";

import React, { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Info,
  Loader2,
  Mail,
  MoreVertical,
  NotebookPen,
  Phone,
  Plus,
  Save,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { SiFacebook, SiInstagram, SiSpotify, SiTiktok, SiYoutube } from "react-icons/si";
import type { IconType } from "react-icons";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { attempt } from "@/lib/attempt";
import { createClient } from "@/lib/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SheetDragHandle } from "@/components/admin/sheet-drag-handle";
import { PosterSizeWarning } from "@/components/admin/poster-size-warning";
import { CorrespondencePanel, MessageCountPill } from "@/components/admin/correspondence-panel";
import { InternalNotesPanel, type InternalNote } from "@/components/admin/internal-notes-panel";
import type { RecordSheetNavigate } from "@/components/admin/record-sheet";
import { VideoFacade } from "@/components/video-facade";
import { readImageFileDimensions } from "@/lib/image-file-dimensions";
import { posterSizeWarning } from "@/lib/poster-image-quality";
import { uploadVideoResumable, type ResumableHandle } from "@/lib/resumable-upload";
import { megabytes } from "@/lib/video-upload-limit";
import { randomId } from "@/lib/random-id";
import { showFirstFrame } from "@/lib/video-preview";
import type { MusicActRow, SocialLinks } from "@/lib/music-acts";
import { sanitizeBankAccounts, type BankAccount } from "@/lib/bank-accounts";
import {
  addMusicActNote,
  deleteMusicActNote,
  saveMusicActAction,
  setMusicActFavoriteAction,
  updateMusicActNote,
  type MusicActInput,
} from "./actions";

export type ActCounts = { bookings: number; completed: number; upcoming: number };
export type MusicActWithContact = MusicActRow & {
  contact?: { id: number; full_name: string | null; email: string | null; phone_no: string | null } | null;
  notes?: InternalNote[];
};
export type EmployeeOption = { id: number; full_name: string };

const supabase = createClient();
const MAX_VIDEOS = 10;

export const SOCIAL_META: {
  key: keyof SocialLinks;
  Icon: IconType;
  label: string;
  className: string;
}[] = [
  { key: "instagram", Icon: SiInstagram, label: "Instagram", className: "bg-linear-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white" },
  { key: "facebook", Icon: SiFacebook, label: "Facebook", className: "bg-[#1877F2] text-white" },
  { key: "youtube", Icon: SiYoutube, label: "YouTube", className: "bg-[#FF0000] text-white" },
  { key: "tiktok", Icon: SiTiktok, label: "TikTok", className: "bg-black text-white" },
];

export function socialsOf(act: MusicActWithContact) {
  return SOCIAL_META.map((s) => ({ ...s, url: (act.social_links?.[s.key] ?? "").trim() })).filter((s) => s.url);
}

export function telHref(phone?: string | null): string | null {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  return cleaned.length > 3 ? `tel:${cleaned}` : null;
}

type VideoItem = {
  id: string;
  url: string | null;
  description: string;
  uploading: boolean;
  progress: number;
  error: string | null;
  previewUrl?: string;
};

type FormState = {
  group_name: string;
  type: string;
  genre: string;
  introduction: string;
  spotify_url: string;
  web_url: string;
  cover_image_url: string;
  image_urls: string[];
  social_links: SocialLinks;
  bank_account_name: string;
  bank_account_no: string;
  bank_sort_code: string;
  bank_payment_ref: string;
  extra_bank_accounts: BankAccount[];
  is_favorite: boolean;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

function formFromAct(a: MusicActWithContact | null): FormState {
  return {
    group_name: a?.group_name ?? "",
    type: a?.type ?? "",
    genre: a?.genre ?? "",
    introduction: a?.introduction ?? "",
    spotify_url: a?.spotify_url ?? "",
    web_url: a?.web_url ?? "",
    cover_image_url: a?.cover_image_url ?? "",
    image_urls: a?.image_urls ?? [],
    social_links: a?.social_links ?? {},
    bank_account_name: a?.bank_account_name ?? "",
    bank_account_no: a?.bank_account_no ?? "",
    bank_sort_code: a?.bank_sort_code ?? "",
    bank_payment_ref: a?.bank_payment_ref ?? "",
    extra_bank_accounts: sanitizeBankAccounts(a?.extra_bank_accounts),
    is_favorite: a?.is_favorite ?? false,
    contact_name: a?.contact?.full_name ?? "",
    contact_email: a?.contact?.email ?? "",
    contact_phone: a?.contact?.phone_no ?? "",
  };
}

function videosFromAct(a: MusicActWithContact | null): VideoItem[] {
  return (a?.video_urls ?? []).filter(Boolean).map((url, i) => ({
    id: randomId(),
    url,
    description: (a?.video_descriptions ?? [])[i]?.trim() || "",
    uploading: false,
    progress: 100,
    error: null,
  }));
}

function comparableForm(f: FormState): string {
  const socials = Object.fromEntries(
    Object.entries(f.social_links)
      .map(([k, v]) => [k, (v ?? "").trim()])
      .filter(([, v]) => v)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return JSON.stringify({ ...f, social_links: socials });
}

function comparableVideos(videos: VideoItem[]): string {
  return JSON.stringify(videos.filter((v) => v.url).map((v) => [v.url, v.description.trim()]));
}

function formatStamp(iso?: string | null) {
  return iso ? format(new Date(iso), "d MMM yyyy, HH:mm") : "-";
}

const FIELD_INPUT =
  "min-w-0 flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40";
const ROW = "flex items-center justify-between gap-3 border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5";
const ROW_LABEL = "shrink-0 font-bold text-[12px] whitespace-nowrap text-[#5E6654]";
const HEADER_ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-xl border border-[#D8D5C8] bg-white text-[#5E6654] transition-colors hover:bg-[#F4F1E8] hover:text-[#34451F] sm:h-9 sm:w-9";
const SUBTLE_PILL = "rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-admin-muted";

function Section({
  title,
  headerRight,
  className,
  hint,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-admin-line bg-white shadow-sm", className)}>
      <div
        className={cn(
          "flex min-h-12 w-full items-center gap-3 bg-admin-primary-soft px-4 py-2 transition-colors has-[button:active]:bg-[#D9E2C8] sm:px-5",
          open && "border-b border-[#D8D5C8]"
        )}
      >
        <div className="flex flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center text-left transition-all hover:brightness-95"
          >
            <span className="font-bold text-[14px] text-admin-ink">{title}</span>
          </button>
          {hint && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About ${title}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-white/70 hover:text-admin-primary max-sm:h-11 max-sm:w-11"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="leading-snug">
                  {hint}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen((o) => !o)}
            className="min-h-8 flex-1 self-stretch"
          />
        </div>
        {headerRight}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 transition-all hover:brightness-95 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center"
        >
          <ChevronDown className={cn("h-4 w-4 text-[#5E6654] transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div className={cn(!open && "hidden")}>{children}</div>
    </div>
  );
}

function TextRow({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  list,
  trailing,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  list?: string;
  trailing?: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className={ROW}>
      <span className={ROW_LABEL}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <input
        aria-label={label}
        type={type}
        value={value}
        list={list}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD_INPUT, numeric && "tabular-nums")}
      />
      {trailing}
    </div>
  );
}

const EMPTY_ACCOUNT: BankAccount = { account_name: "", account_no: "", sort_code: "", payment_ref: "" };

function ExtraBankAccounts({
  accounts,
  onChange,
}: {
  accounts: BankAccount[];
  onChange: (next: BankAccount[]) => void;
}) {
  const update = (i: number, patch: Partial<BankAccount>) =>
    onChange(accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <>
      {accounts.map((a, i) => (
        <div key={i} className="border-b border-[#D8D5C8] bg-admin-surface/40">
          <div className="flex items-center justify-between gap-2 px-4 pt-2 sm:px-5">
            <p className="min-w-0 truncate text-[12px] font-bold text-admin-ink">
              Account {i + 2}
              {a.source && <span className="ml-1.5 font-normal text-admin-muted">from {a.source}</span>}
            </p>
            <button
              type="button"
              onClick={() => onChange(accounts.filter((_, j) => j !== i))}
              aria-label={`Remove account ${i + 2}`}
              title="Remove account"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-error-bg hover:text-admin-error sm:h-8 sm:w-8"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <TextRow
            label="Account name"
            value={a.account_name}
            onChange={(v) => update(i, { account_name: v })}
            placeholder="Account holder"
          />
          <TextRow
            label="Account no."
            numeric
            value={a.account_no}
            onChange={(v) => update(i, { account_no: v })}
            placeholder="12345678"
          />
          <TextRow
            label="Sort code"
            numeric
            value={a.sort_code}
            onChange={(v) => update(i, { sort_code: v })}
            placeholder="12-34-56"
          />
          <TextRow
            label="Payment ref"
            value={a.payment_ref}
            onChange={(v) => update(i, { payment_ref: v })}
            placeholder="Reference"
          />
        </div>
      ))}
      <div className="px-4 py-2 sm:px-5">
        <button
          type="button"
          onClick={() => onChange([...accounts, { ...EMPTY_ACCOUNT }])}
          className="flex h-11 items-center gap-1.5 rounded-xl border border-[#34451F] px-3 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8] sm:h-9"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add another account
        </button>
      </div>
    </>
  );
}

function LinkOut({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#5E6654] transition-colors hover:bg-admin-surface hover:text-[#34451F]"
    >
      {href.startsWith("mailto:") ? (
        <Mail className="h-3.5 w-3.5" />
      ) : href.startsWith("tel:") ? (
        <Phone className="h-3.5 w-3.5" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5" />
      )}
    </a>
  );
}

export function MusicActSheet({
  open,
  act: incoming,
  counts,
  unreadEmails,
  typeOptions,
  employees,
  maxVideoBytes,
  navigate,
  focusNotes,
  onClose,
  onDelete,
}: {
  open: boolean;
  act: MusicActWithContact | null;
  counts: ActCounts | null;
  unreadEmails: number;
  typeOptions: string[];
  employees: EmployeeOption[];
  maxVideoBytes: number;
  navigate?: RecordSheetNavigate;
  focusNotes?: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [shown, setShown] = useState<{ key: string | null; act: MusicActWithContact | null }>({
    key: null,
    act: null,
  });
  const [form, setForm] = useState<FormState>(() => formFromAct(null));
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [coverWarning, setCoverWarning] = useState<string | null>(null);
  const [sysInfoOpen, setSysInfoOpen] = useState(false);

  /* The sheet stays mounted between acts, so stepping to another act - or
     opening a fresh one - reloads the form here rather than remounting and
     replaying the open animation. Closing keeps the last act on screen while
     the sheet slides away. */
  const incomingKey = incoming ? incoming.id : open ? "new" : null;
  if (incomingKey !== null && incomingKey !== shown.key) {
    setShown({ key: incomingKey, act: incoming });
    setForm(formFromAct(incoming));
    setVideos(videosFromAct(incoming));
    setError(null);
    setCoverWarning(null);
    setSysInfoOpen(false);
  } else if (incoming && incoming.id === shown.key && incoming !== shown.act) {
    setShown({ key: shown.key, act: incoming });
  }
  const act = shown.act;
  const isNew = shown.key === "new";
  const maxVideoMb = megabytes(maxVideoBytes);
  const { confirm: baseConfirm, ConfirmDialogUI } = useConfirm();
  const confirmOpen = useRef(false);
  const sheetBodyRef = useRef<HTMLDivElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoHandles = useRef<Record<string, ResumableHandle>>({});

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [favPending, startFavTransition] = useTransition();

  const bodyReady = useDeferredValue(open, false);
  const uploadingAnyVideo = videos.some((v) => v.uploading);
  const notes = act?.notes ?? [];

  const hasChanges = isNew
    ? comparableForm(form) !== comparableForm(formFromAct(null)) || videos.length > 0
    : comparableForm(form) !== comparableForm(formFromAct(act)) ||
      comparableVideos(videos) !== comparableVideos(videosFromAct(act)) ||
      videos.some((v) => !v.url);
  const saveBlocked = isPending || uploadingCover || uploadingImages || uploadingAnyVideo;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const employeeName = (id?: number | null) => employees.find((e) => e.id === id)?.full_name ?? "-";

  async function confirm(opts: Parameters<typeof baseConfirm>[0]) {
    confirmOpen.current = true;
    let ok = false;
    await attempt(
      async () => {
        ok = await baseConfirm(opts);
      },
      () => {}
    );
    confirmOpen.current = false;
    return ok;
  }

  function releaseUploads() {
    Object.values(videoHandles.current).forEach((handle) => handle.abort());
    videoHandles.current = {};
    videos.forEach((v) => v.previewUrl && URL.revokeObjectURL(v.previewUrl));
  }

  function discardChanges() {
    releaseUploads();
    setForm(formFromAct(act));
    setVideos(videosFromAct(act));
    setCoverWarning(null);
    setError(null);
  }

  async function confirmLeave(): Promise<boolean> {
    if (!hasChanges) return true;
    return confirm({
      title: "Discard changes?",
      description: "You have unsaved changes to this act. Leave without saving them?",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      variant: "destructive",
    });
  }

  async function requestClose() {
    if (!(await confirmLeave())) return;
    releaseUploads();
    onClose();
  }

  async function step(to?: () => void) {
    if (!to || !(await confirmLeave())) return;
    releaseUploads();
    to();
  }

  function handleSave() {
    if (!form.group_name.trim()) {
      setError("Group name is required.");
      return;
    }
    if (uploadingAnyVideo) {
      setError("Please wait for videos to finish uploading.");
      return;
    }
    setError(null);
    const uploaded = videos.filter((v) => v.url);
    const input: MusicActInput = {
      id: act?.id,
      group_name: form.group_name,
      type: form.type,
      genre: form.genre,
      introduction: form.introduction,
      spotify_url: form.spotify_url,
      web_url: form.web_url,
      cover_image_url: form.cover_image_url,
      image_urls: form.image_urls,
      social_links: form.social_links,
      video_urls: uploaded.map((v) => v.url as string),
      video_descriptions: uploaded.map((v) => v.description.trim()),
      bank_account_name: form.bank_account_name,
      bank_account_no: form.bank_account_no,
      bank_sort_code: form.bank_sort_code,
      bank_payment_ref: form.bank_payment_ref,
      extra_bank_accounts: form.extra_bank_accounts,
      is_favorite: form.is_favorite,
      contact: {
        booker_name: form.contact_name,
        email: form.contact_email,
        phone_no: form.contact_phone,
      },
    };
    startTransition(async () => {
      await attempt(
        async () => {
          const result = await saveMusicActAction(input);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          if (isNew) {
            toast.success("Music act created");
            onClose();
          } else {
            setVideos((current) => current.filter((v) => v.url));
            toast.success("Changes saved");
          }
        },
        () => setError("Failed to save the act. Please try again.")
      );
    });
  }

  function toggleFavorite() {
    if (!act) {
      set("is_favorite", !form.is_favorite);
      return;
    }
    const next = !act.is_favorite;
    startFavTransition(async () => {
      const result = await setMusicActFavoriteAction(act.id, next);
      if ("error" in result) toast.error(result.error);
    });
  }

  function revealInternalNotes() {
    const cards = sheetBodyRef.current?.querySelectorAll<HTMLElement>("[data-internal-notes]") ?? [];
    const visible = Array.from(cards).find((el) => el.offsetParent !== null);
    visible?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  useEffect(() => {
    if (!focusNotes || !bodyReady) return;
    const timer = window.setTimeout(() => {
      const cards = sheetBodyRef.current?.querySelectorAll<HTMLElement>("[data-internal-notes]") ?? [];
      Array.from(cards)
        .find((el) => el.offsetParent !== null)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusNotes, bodyReady]);

  async function uploadToGallery(file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const path = `music-acts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    return supabase.storage.from("gallery").getPublicUrl(data.path).data.publicUrl;
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file) return;
    setUploadingCover(true);
    setError(null);
    await attempt(
      async () => {
        setCoverWarning(posterSizeWarning(await readImageFileDimensions(file)));
        set("cover_image_url", await uploadToGallery(file));
      },
      (err) => setError(`Cover upload failed: ${err instanceof Error ? err.message : "unknown error"}`)
    );
    setUploadingCover(false);
    input.value = "";
  }

  async function handleImagesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const input = e.target;
    if (!files.length) return;
    setUploadingImages(true);
    setError(null);
    await attempt(
      async () => {
        const urls = await Promise.all(files.map(uploadToGallery));
        setForm((f) => ({ ...f, image_urls: [...f.image_urls, ...urls] }));
      },
      (err) => setError(`Image upload failed: ${err instanceof Error ? err.message : "unknown error"}`)
    );
    setUploadingImages(false);
    input.value = "";
  }

  const patchVideo = (id: string, patch: Partial<VideoItem>) =>
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_VIDEOS - videos.length;
    for (const file of files.slice(0, remaining)) {
      const id = randomId();
      const previewUrl = URL.createObjectURL(file);
      if (file.size > maxVideoBytes) {
        setVideos((prev) => [
          ...prev,
          { id, url: null, description: "", uploading: false, progress: 0, error: `File too large (max ${maxVideoMb} MB).`, previewUrl },
        ]);
        continue;
      }
      setVideos((prev) => [...prev, { id, url: null, description: "", uploading: true, progress: 0, error: null, previewUrl }]);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      videoHandles.current[id] = uploadVideoResumable(file, path, {
        onProgress: (pct) => patchVideo(id, { progress: pct }),
        onSuccess: (publicUrl) => {
          patchVideo(id, { uploading: false, url: publicUrl, progress: 100 });
          delete videoHandles.current[id];
        },
        onError: (message) => {
          patchVideo(id, { uploading: false, error: message });
          delete videoHandles.current[id];
        },
      });
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function removeVideo(id: string) {
    videoHandles.current[id]?.abort();
    delete videoHandles.current[id];
    setVideos((prev) => {
      const entry = prev.find((v) => v.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((v) => v.id !== id);
    });
  }

  const favourite = act ? act.is_favorite : form.is_favorite;
  const shortRef = act ? act.id.slice(0, 8).toUpperCase() : null;
  const title = form.group_name.trim() || act?.group_name || "New music act";

  const [emailCount, setEmailCount] = useState<number | null>(null);

  const notesCards = (
    <div data-internal-notes className="scroll-mt-4">
      <InternalNotesPanel
        notes={notes}
        editable={!!act}
        placeholder="Add a note about the act…"
        onAdd={(body) => (act ? addMusicActNote(act.id, body) : Promise.resolve())}
        onUpdate={updateMusicActNote}
        onDelete={deleteMusicActNote}
      />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (confirmOpen.current) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (confirmOpen.current) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (confirmOpen.current) e.preventDefault();
        }}
        className="flex h-[92vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#D8D5C8] bg-[#F4F1E8] p-0 shadow-2xl outline-none sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto sm:max-h-[92vh] sm:w-3xl sm:max-w-[96vw] sm:-translate-x-1/2 sm:rounded-4xl sm:border-2 md:w-4xl lg:max-h-[94vh] lg:w-5xl xl:w-6xl"
      >
        <SheetDragHandle onClose={requestClose} className="bg-white/80 backdrop-blur-md" />
        <div className="sticky top-0 z-30 shrink-0 border-b border-[#D8D5C8] bg-white/80 px-4 pt-1 pb-3 backdrop-blur-md sm:rounded-t-4xl">
          <div className="flex items-start justify-between gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              title="Close"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink"
            >
              <X className="h-5 w-5 shrink-0" />
            </button>
            <div className="min-w-0 flex-1">
              <SheetTitle className="mt-2 truncate text-lg leading-tight font-bold tracking-tight text-admin-ink">
                {title}
              </SheetTitle>
              <SheetDescription className="mt-0.5 truncate text-[13px] font-medium text-admin-muted">
                {isNew || !act
                  ? "New music act"
                  : [act.type, act.genre].filter(Boolean).join(" · ") || "Music act"}
                {navigate?.position && (
                  <span className="tabular-nums">
                    {" "}
                    · {navigate.position.index} of {navigate.position.total}
                  </span>
                )}
              </SheetDescription>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {(hasChanges || isNew) && (
                <>
                  <button
                    type="button"
                    onClick={isNew ? requestClose : discardChanges}
                    disabled={isPending}
                    aria-label={isNew ? "Cancel" : "Discard changes"}
                    title={isNew ? "Cancel" : "Discard changes"}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#D8D5C8] bg-white px-3 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE] disabled:opacity-50 max-sm:w-11 max-sm:px-0 sm:h-9"
                  >
                    <Undo2 className="h-4 w-4 shrink-0" />
                    <span className="max-sm:hidden">Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveBlocked}
                    title={uploadingAnyVideo || uploadingCover || uploadingImages ? "Wait for uploads to finish." : isNew ? "Create act" : "Save changes"}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#34451F] px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#283719] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:h-9"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                    {isNew ? "Create" : "Save"}
                  </button>
                </>
              )}

              {navigate && (
                <span className="hidden items-center gap-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => step(navigate.onPrev)}
                    disabled={!navigate.onPrev}
                    aria-label="Previous act"
                    title="Previous act"
                    className={cn(HEADER_ICON_BUTTON, "disabled:opacity-40")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(navigate.onNext)}
                    disabled={!navigate.onNext}
                    aria-label="Next act"
                    title="Next act"
                    className={cn(HEADER_ICON_BUTTON, "disabled:opacity-40")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={toggleFavorite}
                disabled={favPending}
                aria-pressed={favourite}
                aria-label={favourite ? "Remove from favourites" : "Mark as favourite"}
                title={favourite ? "Remove from favourites" : "Mark as favourite"}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none disabled:opacity-50",
                  (hasChanges || isNew) && "max-sm:hidden"
                )}
              >
                <Heart className={cn("h-5.5 w-5.5 transition-colors", favourite ? "fill-rose-500 text-rose-500" : "text-[#5E6654]")} />
              </button>

              {act && (
                <>
                  <Popover open={sysInfoOpen} onOpenChange={setSysInfoOpen}>
                    <DropdownMenu modal={false}>
                      <PopoverAnchor asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={notes.length > 0 ? `More actions (${notes.length} team notes)` : "More actions"}
                            title="More actions"
                            className="relative -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-admin-ink transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none data-[state=open]:bg-admin-surface"
                          >
                            <MoreVertical className="h-5 w-5" />
                            {notes.length > 0 && (
                              <span
                                aria-hidden="true"
                                className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#9A5B00] ring-2 ring-white"
                              />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                      </PopoverAnchor>
                      <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
                        <DropdownMenuItem onSelect={revealInternalNotes}>
                          <NotebookPen className="h-4 w-4" />
                          <span className="flex-1">Team notes</span>
                          {notes.length > 0 && (
                            <span className="rounded-full bg-[#FCE9A6] px-1.5 text-[11px] font-semibold text-[#9A5B00] tabular-nums">
                              {notes.length}
                            </span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setTimeout(() => setSysInfoOpen(true), 0)}>
                          <Info className="h-4 w-4" />
                          System information
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                          <Trash2 className="h-4 w-4" />
                          Delete act
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <PopoverContent
                      align="end"
                      onFocusOutside={(e) => e.preventDefault()}
                      className="w-80 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white p-0"
                    >
                      <span className="block border-b border-[#D8D5C8] bg-admin-surface px-4 py-2.5 text-[13px] font-bold text-admin-ink">
                        System information
                      </span>
                      {[
                        ["Reference", shortRef ? `#${shortRef}` : "-"],
                        ["Created", formatStamp(act.created_at)],
                        ["Created by", employeeName(act.created_by)],
                        ["Last modified", formatStamp(act.updated_at)],
                        ["Modified by", employeeName(act.updated_by)],
                      ].map(([label, value]) => (
                        <div key={label} className={ROW}>
                          <span className={ROW_LABEL}>{label}</span>
                          <span className="text-right text-[13px] font-semibold text-[#20231A] tabular-nums">{value}</span>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          </div>
        </div>

        <div ref={sheetBodyRef} className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {error && (
            <p className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-snug font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          {bodyReady ? (
            <div className="animate-in grid-cols-2 items-start gap-5 space-y-4 duration-200 fade-in sm:space-y-5 lg:grid lg:space-y-0">
                <Section
                  className="min-w-0"
                  title="Act details"
                  headerRight={
                    counts && counts.upcoming > 0 ? (
                      <span className="rounded-md bg-admin-success-bg px-1.5 py-0.5 text-[11px] font-semibold text-admin-success">
                        {counts.upcoming} upcoming
                      </span>
                    ) : undefined
                  }
                >
                  <div className="border-b border-[#D8D5C8] p-3 sm:px-5">
                    {form.cover_image_url ? (
                      <div className="relative overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.cover_image_url}
                          alt={`${title} cover`}
                          className="h-44 w-full rounded-xl object-cover sm:h-56"
                        />
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <label
                            title="Replace cover"
                            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-black/60 px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-black/80"
                          >
                            {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Replace
                            <input
                              type="file"
                              accept="image/*"
                              aria-label="Replace cover image"
                              className="hidden"
                              onChange={handleCoverUpload}
                              disabled={uploadingCover}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              set("cover_image_url", "");
                              setCoverWarning(null);
                            }}
                            aria-label="Remove cover"
                            title="Remove cover"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white transition-colors hover:bg-black/80"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <PosterSizeWarning message={coverWarning} />
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-admin-line py-6 transition-colors hover:border-admin-primary hover:bg-admin-surface">
                        {uploadingCover ? (
                          <Loader2 className="mb-1.5 h-6 w-6 animate-spin text-admin-muted" />
                        ) : (
                          <Upload className="mb-1.5 h-6 w-6 text-admin-muted opacity-50" />
                        )}
                        <span className="text-[12px] font-semibold text-admin-muted">
                          {uploadingCover ? "Uploading…" : "Add a cover image"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          aria-label="Upload cover image"
                          className="hidden"
                          onChange={handleCoverUpload}
                          disabled={uploadingCover}
                        />
                      </label>
                    )}
                  </div>
                  <TextRow
                    label="Group name"
                    required
                    value={form.group_name}
                    onChange={(v) => set("group_name", v)}
                    placeholder="e.g. The Rolling Stones"
                  />
                  <TextRow
                    label="Type"
                    list="music-act-types"
                    value={form.type}
                    onChange={(v) => set("type", v)}
                    placeholder="Band / Singer / DJ"
                  />
                  <datalist id="music-act-types">
                    {typeOptions.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <TextRow label="Genre" value={form.genre} onChange={(v) => set("genre", v)} placeholder="e.g. Rock" />
                  <div className="border-b border-[#D8D5C8] px-4 py-2 last:border-0 sm:px-5">
                    <label className="block">
                      <span className={ROW_LABEL}>Introduction</span>
                      <textarea
                        value={form.introduction}
                        onChange={(e) => set("introduction", e.target.value)}
                        placeholder="A short bio of the act…"
                        rows={3}
                        className="mt-1.5 field-sizing-content min-h-16 w-full resize-none bg-transparent text-[13px] leading-relaxed font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
                      />
                    </label>
                  </div>
                </Section>

                <div className="min-w-0 space-y-4 sm:space-y-5">{notesCards}</div>

                <Section
                  className="min-w-0"
                  title="Act media"
                  headerRight={<span className={SUBTLE_PILL}>{videos.length}/{MAX_VIDEOS} videos</span>}
                  hint={
                    <>
                      <p className="font-semibold">
                        Videos: {videos.length}/{MAX_VIDEOS}
                      </p>
                      <p className="text-admin-muted">
                        MP4, WebM or MOV - max {maxVideoMb} MB each. Applied when you hit Save.
                      </p>
                    </>
                  }
                >
                  <TextRow
                    label="Spotify"
                    type="url"
                    value={form.spotify_url}
                    onChange={(v) => set("spotify_url", v)}
                    placeholder="https://open.spotify.com/artist/…"
                    trailing={
                      form.spotify_url.trim() ? (
                        <a
                          href={form.spotify_url.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open Spotify"
                          title="Open Spotify"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-white"
                        >
                          <SiSpotify className="h-3.5 w-3.5" />
                        </a>
                      ) : undefined
                    }
                  />
                  {SOCIAL_META.map(({ key, label, Icon, className }) => {
                    const url = (form.social_links[key] ?? "").trim();
                    return (
                      <TextRow
                        key={key}
                        label={label}
                        type="url"
                        value={form.social_links[key] ?? ""}
                        onChange={(v) => set("social_links", { ...form.social_links, [key]: v })}
                        placeholder={`${label} URL`}
                        trailing={
                          url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open ${label}`}
                              title={`Open ${label}`}
                              className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", className)}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </a>
                          ) : undefined
                        }
                      />
                    );
                  })}
                  <TextRow
                    label="Website"
                    type="url"
                    value={form.web_url}
                    onChange={(v) => set("web_url", v)}
                    placeholder="https://…"
                    trailing={form.web_url.trim() ? <LinkOut href={form.web_url.trim()} label="Open website" /> : undefined}
                  />

                  <div className="space-y-3 border-b border-[#D8D5C8] px-4 py-3 last:border-0 sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={ROW_LABEL}>Photos</span>
                      <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#34451F] px-2.5 text-[12px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8]">
                        {uploadingImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Add photos
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          aria-label="Upload photos"
                          className="hidden"
                          onChange={handleImagesUpload}
                          disabled={uploadingImages}
                        />
                      </label>
                    </div>
                    {form.image_urls.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {form.image_urls.map((url) => (
                          <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-admin-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => set("image_urls", form.image_urls.filter((u) => u !== url))}
                              aria-label="Remove photo"
                              title="Remove photo"
                              className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-admin-muted">No photos yet.</p>
                    )}
                  </div>

                  <div className="space-y-3 px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className={ROW_LABEL}>Videos</span>
                      {videos.length < MAX_VIDEOS && (
                        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#34451F] px-2.5 text-[12px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8]">
                          <Upload className="h-3.5 w-3.5" />
                          Add videos
                          <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            multiple
                            aria-label="Upload videos"
                            className="hidden"
                            onChange={handleVideoSelect}
                          />
                        </label>
                      )}
                    </div>
                    {videos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {videos.map((v, i) => (
                          <div key={v.id} className="min-w-0">
                            {v.url ? (
                              <VideoFacade url={v.url} title={v.description || `Video ${i + 1}`} />
                            ) : (
                              <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-black/10 bg-admin-ink">
                                {v.previewUrl && (
                                  <video
                                    src={v.previewUrl}
                                    onLoadedMetadata={showFirstFrame}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                                  />
                                )}
                                <span className="absolute inset-0 bg-black/50" />
                                {v.error ? (
                                  <span className="relative flex flex-col items-center gap-1 px-2 text-center">
                                    <AlertCircle className="h-5 w-5 text-red-300" />
                                    <span className="text-[11px] font-semibold text-red-200">{v.error}</span>
                                  </span>
                                ) : (
                                  <span className="relative flex flex-col items-center gap-1.5">
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                    <span className="text-[11px] font-semibold text-white tabular-nums">{v.progress}%</span>
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="mt-1.5 flex items-center gap-1">
                              <input
                                type="text"
                                aria-label={`Description for video ${i + 1}`}
                                maxLength={120}
                                value={v.description}
                                onChange={(e) => patchVideo(v.id, { description: e.target.value })}
                                placeholder="Add a description…"
                                className="min-w-0 flex-1 rounded-lg border border-admin-line bg-admin-surface/50 px-2 py-1.5 text-[12px] text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary/40"
                              />
                              <button
                                type="button"
                                onClick={() => removeVideo(v.id)}
                                aria-label="Remove video"
                                title="Remove video"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-admin-line bg-admin-card text-admin-muted transition-colors hover:border-admin-error/30 hover:bg-admin-error-bg hover:text-admin-error"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-admin-muted">No videos yet.</p>
                    )}
                  </div>
                </Section>

              <div className="min-w-0 space-y-4 sm:space-y-5">
                <Section title="Contact">
                  <TextRow
                    label="Name"
                    value={form.contact_name}
                    onChange={(v) => set("contact_name", v)}
                    placeholder="Booker name"
                  />
                  <TextRow
                    label="Email"
                    type="email"
                    value={form.contact_email}
                    onChange={(v) => set("contact_email", v)}
                    placeholder="email@example.com"
                    trailing={
                      form.contact_email.trim() ? (
                        <LinkOut href={`mailto:${form.contact_email.trim()}`} label={`Email ${form.contact_email.trim()}`} />
                      ) : undefined
                    }
                  />
                  <TextRow
                    label="Phone"
                    type="tel"
                    value={form.contact_phone}
                    onChange={(v) => set("contact_phone", v)}
                    placeholder="Phone number"
                    trailing={
                      telHref(form.contact_phone) ? (
                        <LinkOut href={telHref(form.contact_phone) as string} label="Call this number" />
                      ) : undefined
                    }
                  />
                </Section>

                <Section title="Bank details">
                  <TextRow
                    label="Account name"
                    value={form.bank_account_name}
                    onChange={(v) => set("bank_account_name", v)}
                    placeholder="Account holder"
                  />
                  <TextRow
                    label="Account no."
                    numeric
                    value={form.bank_account_no}
                    onChange={(v) => set("bank_account_no", v)}
                    placeholder="12345678"
                  />
                  <TextRow
                    label="Sort code"
                    numeric
                    value={form.bank_sort_code}
                    onChange={(v) => set("bank_sort_code", v)}
                    placeholder="12-34-56"
                  />
                  <TextRow
                    label="Payment ref"
                    value={form.bank_payment_ref}
                    onChange={(v) => set("bank_payment_ref", v)}
                    placeholder="Reference"
                  />
                  <ExtraBankAccounts
                    accounts={form.extra_bank_accounts}
                    onChange={(next) => set("extra_bank_accounts", next)}
                  />
                </Section>

                {act && (
                  <Section title="Bookings">
                    {[
                      ["Upcoming", counts?.upcoming ?? 0],
                      ["Played", counts?.completed ?? 0],
                      ["Total booked", counts?.bookings ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className={ROW}>
                        <span className={ROW_LABEL}>{label}</span>
                        <span className="text-right text-[13px] font-semibold text-[#20231A] tabular-nums">{value}</span>
                      </div>
                    ))}
                  </Section>
                )}
              </div>

                {act && (
                  <Section
                    className="min-w-0 lg:col-span-2"
                    title="Correspondence"
                    headerRight={
                      <span className="flex items-center gap-1.5">
                        <MessageCountPill count={emailCount} />
                        {unreadEmails > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#9A5B00] px-2 py-0.5 text-[11px] font-semibold text-white">
                            <Mail className="h-3 w-3" aria-hidden="true" />
                            {unreadEmails} new
                          </span>
                        ) : null}
                      </span>
                    }
                  >
                    <CorrespondencePanel musicActId={act.id} counterpartName={act.group_name} onCountChange={setEmailCount} />
                  </Section>
                )}
            </div>
          ) : (
            <div className="flex justify-center py-16" aria-busy="true">
              <Loader2 className="h-6 w-6 animate-spin text-[#5E6654]/50" aria-label="Loading act" />
            </div>
          )}
          <div className="h-4" />
        </div>
        {ConfirmDialogUI}
      </SheetContent>
    </Sheet>
  );
}
