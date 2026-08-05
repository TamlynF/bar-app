"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  Upload,
  X,
  Link2,
  Heart,
  NotebookPen,
  Music2,
  Guitar,
  SearchX,
  AlertCircle,
  CalendarCheck,
  CalendarX,
  CalendarDays,
  Mail,
  Phone,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiSpotify } from "react-icons/si";
import type { IconType } from "react-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { VideoFacade } from "@/components/video-facade";
import { uploadVideoResumable, type ResumableHandle } from "@/lib/resumable-upload";
import type { MusicActRow, SocialLinks } from "@/lib/music-acts";
import MusicActNotesPopover from "./music-act-notes-popover";
import {
  saveMusicActAction,
  deleteMusicActAction,
  setMusicActFavoriteAction,
  setMusicActNotesAction,
  type MusicActInput,
} from "./actions";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
} from "@/components/admin";

export type ActCounts = { bookings: number; completed: number; upcoming: number };
export type MusicActWithContact = MusicActRow & {
  contact?: { id: number; full_name: string | null; email: string | null; phone_no: string | null } | null;
};
export type EmployeeOption = { id: number; full_name: string };

const supabase = createClient();
const MAX_VIDEOS = 10;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MB

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

const SOCIAL_META: {
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
  internal_notes: string;
  is_favorite: boolean;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

function blankForm(): FormState {
  return {
    group_name: "", type: "", genre: "", introduction: "", spotify_url: "", web_url: "",
    cover_image_url: "", image_urls: [], social_links: {},
    bank_account_name: "", bank_account_no: "", bank_sort_code: "", bank_payment_ref: "",
    internal_notes: "", is_favorite: false,
    contact_name: "", contact_email: "", contact_phone: "",
  };
}

function formFromAct(a: MusicActWithContact): FormState {
  return {
    group_name: a.group_name ?? "",
    type: a.type ?? "",
    genre: a.genre ?? "",
    introduction: a.introduction ?? "",
    spotify_url: a.spotify_url ?? "",
    web_url: a.web_url ?? "",
    cover_image_url: a.cover_image_url ?? "",
    image_urls: a.image_urls ?? [],
    social_links: a.social_links ?? {},
    bank_account_name: a.bank_account_name ?? "",
    bank_account_no: a.bank_account_no ?? "",
    bank_sort_code: a.bank_sort_code ?? "",
    bank_payment_ref: a.bank_payment_ref ?? "",
    internal_notes: a.internal_notes ?? "",
    is_favorite: a.is_favorite ?? false,
    contact_name: a.contact?.full_name ?? "",
    contact_email: a.contact?.email ?? "",
    contact_phone: a.contact?.phone_no ?? "",
  };
}

function videosFromAct(a: MusicActWithContact): VideoItem[] {
  return (a.video_urls ?? []).filter(Boolean).map((url, i) => ({
    id: crypto.randomUUID(),
    url,
    description: (a.video_descriptions ?? [])[i]?.trim() || "",
    uploading: false,
    progress: 100,
    error: null,
  }));
}

function socialsOf(act: MusicActWithContact) {
  return SOCIAL_META.map((s) => ({ ...s, url: (act.social_links?.[s.key] ?? "").trim() })).filter(
    (s) => s.url,
  );
}

function telHref(phone?: string | null): string | null {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  return cleaned.length > 3 ? `tel:${cleaned}` : null;
}

export default function MusicActsClient({
  initialActs = [],
  counts = {},
  typeOptions = [],
  employees = [],
}: {
  initialActs: MusicActWithContact[];
  counts: Record<string, ActCounts>;
  typeOptions: string[];
  employees?: EmployeeOption[];
}) {
  const sheet = useRecordSheet<MusicActWithContact>({
    records: initialActs,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [recordPending, startRecordTransition] = useTransition();

  const [form, setForm] = useState<FormState>(blankForm());
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoHandles = useRef<Record<string, ResumableHandle>>({});

  const showForm = mode === "add" || mode === "edit";
  const uploadingAnyVideo = videos.some((v) => v.uploading);

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialActs;
    return initialActs.filter((act) =>
      [
        act.group_name,
        act.type,
        act.genre,
        act.introduction,
        act.contact?.full_name,
        act.contact?.email,
      ].some((field) => field?.toLowerCase().includes(needle)),
    );
  }, [initialActs, query]);

  // Uploads in flight belong to the sheet that started them, so leaving takes
  // them with it rather than letting them land on a record nobody is editing.
  const releaseUploads = () => {
    Object.values(videoHandles.current).forEach((handle) => handle.abort());
    videoHandles.current = {};
    setVideos((current) => {
      current.forEach((v) => v.previewUrl && URL.revokeObjectURL(v.previewUrl));
      return [];
    });
  };

  const openAdd = () => {
    releaseUploads();
    setForm(blankForm());
    sheet.openAdd();
  };

  const startEdit = () => {
    if (!selected) return;
    releaseUploads();
    setForm(formFromAct(selected));
    setVideos(videosFromAct(selected));
    sheet.startEdit();
  };

  const closeSheet = () => {
    releaseUploads();
    setForm(blankForm());
    sheet.close();
  };

  const cancel = () => {
    if (mode === "add") closeSheet();
    else if (selected) {
      releaseUploads();
      sheet.openView(selected);
    }
  };

  const save = sheet.submit(async (): Promise<{ error: string } | undefined> => {
    if (!form.group_name.trim()) return { error: "Group name is required." };
    if (uploadingAnyVideo) return { error: "Please wait for videos to finish uploading." };

    const uploaded = videos.filter((v) => v.url);
    const input: MusicActInput = {
      id: mode === "edit" && selected ? selected.id : undefined,
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
      internal_notes: form.internal_notes,
      is_favorite: form.is_favorite,
      contact: {
        booker_name: form.contact_name,
        email: form.contact_email,
        phone_no: form.contact_phone,
      },
    };

    const result = await saveMusicActAction(input);
    if ("error" in result) return { error: result.error };
    releaseUploads();
    return undefined;
  });

  // A record on the list is already saved, so the heart and the notes write
  // straight through. Inside an unsaved form they only move form state, and the
  // Save button is what commits them.
  const toggleFavorite = (act: MusicActWithContact) => {
    startRecordTransition(async () => {
      const result = await setMusicActFavoriteAction(act.id, !act.is_favorite);
      if ("error" in result) toast.error(result.error);
    });
  };

  const saveNotes = async (act: MusicActWithContact, notes: string) => {
    const result = await setMusicActNotesAction(act.id, notes);
    if ("error" in result) toast.error(result.error);
    else toast.success("Notes saved");
  };

  const sheetFavorite = showForm ? form.is_favorite : !!selected?.is_favorite;
  const sheetNotes = showForm ? form.internal_notes : (selected?.internal_notes ?? "");

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Delete music act",
      description: `Delete "${selected.group_name}"? This cannot be undone. Linked band requests are kept but unlinked.`,
      action: async () => {
        const result = await deleteMusicActAction(selected.id);
        return "error" in result ? { error: result.error } : undefined;
      },
    });
  };

  const uploadToGallery = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `music-acts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from("gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from("gallery").getPublicUrl(data.path).data.publicUrl;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    sheet.setFormError(null);
    try {
      set("cover_image_url", await uploadToGallery(file));
    } catch (err) {
      sheet.setFormError(`Cover upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  };

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingImages(true);
    sheet.setFormError(null);
    try {
      const urls = await Promise.all(files.map(uploadToGallery));
      setForm((f) => ({ ...f, image_urls: [...f.image_urls, ...urls] }));
    } catch (err) {
      sheet.setFormError(`Image upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const removeImage = (url: string) =>
    setForm((f) => ({ ...f, image_urls: f.image_urls.filter((u) => u !== url) }));

  const patchVideo = (id: string, patch: Partial<VideoItem>) =>
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_VIDEOS - videos.length;
    for (const file of files.slice(0, remaining)) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      if (file.size > MAX_VIDEO_BYTES) {
        setVideos((prev) => [...prev, { id, url: null, description: "", uploading: false, progress: 0, error: "File too large (max 250 MB).", previewUrl }]);
        continue;
      }
      setVideos((prev) => [...prev, { id, url: null, description: "", uploading: true, progress: 0, error: null, previewUrl }]);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      videoHandles.current[id] = uploadVideoResumable(file, path, {
        onProgress: (pct) => patchVideo(id, { progress: pct }),
        onSuccess: (publicUrl) => { patchVideo(id, { uploading: false, url: publicUrl, progress: 100 }); delete videoHandles.current[id]; },
        onError: (message) => { patchVideo(id, { uploading: false, error: message }); delete videoHandles.current[id]; },
      });
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const removeVideo = (id: string) => {
    videoHandles.current[id]?.abort();
    delete videoHandles.current[id];
    setVideos((prev) => {
      const entry = prev.find((v) => v.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((v) => v.id !== id);
    });
  };

  const title =
    mode === "add" ? "New music act" : mode === "edit" ? "Edit music act" : "View music act";

  const selectedCounts = selected
    ? (counts[selected.id] ?? { bookings: 0, completed: 0, upcoming: 0 })
    : null;
  const selectedSocials = selected ? socialsOf(selected) : [];
  const selectedVideos = selected
    ? (selected.video_urls ?? []).filter(Boolean).map((url, i) => ({
        url,
        description: (selected.video_descriptions ?? [])[i]?.trim() || "",
      }))
    : [];

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialActs.length === 0 ? (
        <EmptyState
          icon={Guitar}
          title="No music acts yet"
          description="Acts appear here automatically from band applications, or add one manually"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create act
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Music acts"
          count={shown.length}
          onAdd={openAdd}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search music acts"
              placeholder="Search by name, type, genre or contact"
            />
          }
        >
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
              <SearchX className="mb-1 h-7 w-7 text-admin-muted opacity-30" />
              <p className="text-sm font-semibold text-admin-ink">No matches</p>
              <p className="text-[11px] text-admin-muted">
                Nothing here matches &ldquo;{query.trim()}&rdquo;
              </p>
            </div>
          ) : (
            shown.map((act) => {
              const c = counts[act.id] ?? { bookings: 0, completed: 0, upcoming: 0 };
              const booked = c.upcoming > 0;
              const socials = socialsOf(act);
              return (
                <ListRow
                  key={act.id}
                  onClick={() => sheet.openView(act)}
                  status={
                    // Fixed width, so a row with no dates cannot narrow its grid
                    // and knock the columns out of line with the rest.
                    <StatusPill
                      tone={booked ? "success" : "neutral"}
                      icon={
                        booked ? (
                          <CalendarCheck className="h-3 w-3" />
                        ) : (
                          <CalendarX className="h-3 w-3" />
                        )
                      }
                      className="sm:w-28 sm:justify-center"
                    >
                      {booked ? `${c.upcoming} upcoming` : "No dates"}
                    </StatusPill>
                  }
                  actions={
                    <>
                      <FavoriteButton
                        active={act.is_favorite}
                        disabled={recordPending}
                        onToggle={() => toggleFavorite(act)}
                        stopPropagation
                      />
                      <MusicActNotesPopover
                        value={act.internal_notes ?? ""}
                        onSave={(notes) => saveNotes(act, notes)}
                      >
                        <NotesButton
                          hasNotes={!!act.internal_notes?.trim()}
                          name={act.group_name}
                          stopPropagation
                        />
                      </MusicActNotesPopover>
                    </>
                  }
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
                    {act.cover_image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={act.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Music2 className="h-4 w-4 text-admin-muted opacity-40" />
                      </span>
                    )}
                  </div>

                  {/* Fixed tracks, not content-sized ones - an "auto" column takes
                      its width from that row's own badges, which is what leaves
                      every genre starting somewhere different. */}
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_14rem_minmax(0,1.2fr)_8rem_6rem] sm:items-center sm:gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm leading-snug font-semibold text-admin-ink">
                        {act.group_name}
                      </p>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5 sm:mt-0">
                      <span className="truncate text-[11px] font-medium text-admin-muted sm:hidden">
                        {[act.type, act.genre].filter(Boolean).join(" · ") || "-"}
                      </span>
                      <span className="hidden items-center gap-1.5 sm:flex">
                        <InfoBadge icon={null}>{act.type || "No type"}</InfoBadge>
                        <InfoBadge icon={null}>{act.genre || "-"}</InfoBadge>
                      </span>
                    </div>

                    <div className="hidden min-w-0 items-center gap-1 sm:flex">
                      <span className="truncate text-[12px] font-medium text-admin-muted">
                        {act.contact?.email || act.contact?.full_name || "No contact"}
                      </span>
                      <ContactActions act={act} />
                    </div>

                    <p
                      className="hidden items-center gap-1.5 text-[11px] font-medium text-admin-muted sm:flex"
                      title={`${c.bookings} booked, ${c.completed} played, ${c.upcoming} upcoming`}
                    >
                      <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      <span className="sr-only">Bookings</span>
                      <span className="tabular-nums">{c.bookings} booked</span>
                    </p>

                    <div className="hidden items-center gap-1 sm:flex">
                      {socials.map(({ key, Icon, className, label }) => (
                        <span
                          key={key}
                          title={label}
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full",
                            className,
                          )}
                        >
                          <Icon className="h-2.5 w-2.5" />
                        </span>
                      ))}
                      {act.spotify_url && (
                        <span
                          title="Spotify"
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1DB954] text-white"
                        >
                          <SiSpotify className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </ListRow>
              );
            })
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={closeSheet}
        mode={mode}
        title={title}
        recordId={selected ? selected.id.slice(0, 8) : undefined}
        formId="music-act-form"
        isPending={sheet.isPending}
        saveDisabled={uploadingCover || uploadingImages || uploadingAnyVideo}
        onEdit={startEdit}
        onDelete={handleDelete}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <>
              <StatusPill
                tone={selectedCounts && selectedCounts.upcoming > 0 ? "success" : "neutral"}
                icon={
                  selectedCounts && selectedCounts.upcoming > 0 ? (
                    <CalendarCheck className="h-3 w-3" />
                  ) : (
                    <CalendarX className="h-3 w-3" />
                  )
                }
                showLabelOnMobile
              >
                {selectedCounts && selectedCounts.upcoming > 0
                  ? `${selectedCounts.upcoming} upcoming`
                  : "No dates"}
              </StatusPill>
              {selected.is_favorite && (
                <StatusPill tone="warning" icon={<Heart className="h-3 w-3 fill-current" />} showLabelOnMobile>
                  Favourite
                </StatusPill>
              )}
            </>
          )
        }
        actions={
          <>
            <FavoriteButton
              active={sheetFavorite}
              disabled={recordPending}
              onToggle={() => {
                if (showForm) set("is_favorite", !form.is_favorite);
                else if (selected) toggleFavorite(selected);
              }}
            />
            <MusicActNotesPopover
              value={sheetNotes}
              onSave={(notes) => {
                if (showForm) set("internal_notes", notes);
                else if (selected) return saveNotes(selected, notes);
              }}
            >
              <NotesButton hasNotes={!!sheetNotes.trim()} name={selected?.group_name} />
            </MusicActNotesPopover>
          </>
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                createdAt: selected.created_at,
                createdBy: employeeName(selected.created_by),
                updatedAt: selected.updated_at,
                updatedBy: employeeName(selected.updated_by),
                rows: [
                  {
                    label: "Bookings",
                    value: selectedCounts
                      ? `${selectedCounts.bookings} total, ${selectedCounts.completed} played`
                      : "-",
                  },
                ],
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            {selected.cover_image_url && (
              <DetailCard className="p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.cover_image_url}
                  alt={selected.group_name}
                  className="h-48 w-full rounded-xl object-cover sm:h-auto sm:max-h-75"
                />
              </DetailCard>
            )}

            <DetailCard>
              <DetailCell label="Name" value={selected.group_name} />
              <DetailCell label="Type" value={selected.type || "-"} />
              <DetailCell label="Genre" value={selected.genre || "-"} />
              <DetailCell
                label="Introduction"
                value={selected.introduction || "-"}
                multiline={!!selected.introduction}
              />
            </DetailCard>

            <DetailCard>
              <DetailCell label="Contact" value={selected.contact?.full_name || "-"} />
              <DetailCell
                label="Email"
                value={
                  selected.contact?.email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="break-all">{selected.contact.email}</span>
                      <a
                        href={`mailto:${selected.contact.email}`}
                        aria-label={`Email ${selected.group_name}`}
                        title={`Email ${selected.contact.email}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    </span>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailCell
                label="Phone"
                value={
                  selected.contact?.phone_no ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span>{selected.contact.phone_no}</span>
                      {telHref(selected.contact.phone_no) && (
                        <a
                          href={telHref(selected.contact.phone_no) as string}
                          aria-label={`Call ${selected.group_name}`}
                          title="Call this number"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </span>
                  ) : (
                    "-"
                  )
                }
              />
            </DetailCard>

            {(selected.bank_account_no || selected.bank_sort_code) && (
              <DetailCard>
                <DetailCell dense label="Bank name" value={selected.bank_account_name || "-"} />
                <DetailCell dense label="Account no" value={selected.bank_account_no || "-"} />
                <DetailCell dense label="Sort code" value={selected.bank_sort_code || "-"} />
                <DetailCell dense label="Payment ref" value={selected.bank_payment_ref || "-"} />
              </DetailCard>
            )}

            {selected.internal_notes && (
              <DetailCard>
                <DetailCell label="Notes" value={selected.internal_notes} multiline />
              </DetailCard>
            )}

            {(selectedSocials.length > 0 || selected.spotify_url || selected.web_url) && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedSocials.map(({ key, url, Icon, className, label }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full",
                      className,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
                {selected.spotify_url && (
                  <a
                    href={selected.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Spotify"
                    title="Spotify"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1DB954] text-white"
                  >
                    <SiSpotify className="h-4 w-4" />
                  </a>
                )}
                {selected.web_url && (
                  <a
                    href={selected.web_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Website"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-admin-line bg-admin-card px-3 text-[11px] font-semibold text-admin-primary"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Website
                  </a>
                )}
              </div>
            )}

            {selected.image_urls?.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selected.image_urls.map((url) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="aspect-square w-full rounded-xl border border-admin-line object-cover"
                  />
                ))}
              </div>
            )}

            {selectedVideos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedVideos.map((v, i) => (
                  <div key={v.url} className="min-w-0">
                    <VideoFacade url={v.url} title={v.description || `Video ${i + 1}`} />
                    {v.description && (
                      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-admin-muted">
                        {v.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="music-act-form"
            action={save}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            <DetailCard className="space-y-3 p-4">
              <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                Profile picture
              </span>
              {form.cover_image_url ? (
                <div className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.cover_image_url}
                    alt="Cover"
                    className="h-48 w-full rounded-xl object-cover sm:h-auto sm:max-h-64"
                  />
                  <button
                    type="button"
                    onClick={() => set("cover_image_url", "")}
                    aria-label="Remove cover"
                    className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-admin-line py-8 transition-colors hover:border-admin-primary hover:bg-admin-surface">
                  {uploadingCover ? (
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-admin-muted" />
                  ) : (
                    <Upload className="mb-2 h-8 w-8 text-admin-muted opacity-40" />
                  )}
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                    {uploadingCover ? "Uploading..." : "Click to upload"}
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
            </DetailCard>

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Group name" required>
                <input
                  required
                  aria-label="Group name"
                  placeholder="e.g. The Rolling Stones"
                  value={form.group_name}
                  onChange={(e) => set("group_name", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Type">
                <input
                  list="music-act-types"
                  aria-label="Type"
                  placeholder="Band / Singer / DJ"
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  className={FIELD_INPUT}
                />
                <datalist id="music-act-types">
                  {typeOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </FormRow>

              <FormRow label="Genre">
                <input
                  aria-label="Genre"
                  placeholder="e.g. Rock"
                  value={form.genre}
                  onChange={(e) => set("genre", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>

            </DetailCard>

            <TextAreaCard
              label="Introduction"
              value={form.introduction}
              onChange={(v) => set("introduction", v)}
              placeholder="A short bio / description of the act…"
            />

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Spotify">
                <input
                  type="url"
                  aria-label="Spotify"
                  placeholder="https://open.spotify.com/artist/…"
                  value={form.spotify_url}
                  onChange={(e) => set("spotify_url", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Website">
                <input
                  type="url"
                  aria-label="Website"
                  placeholder="https://…"
                  value={form.web_url}
                  onChange={(e) => set("web_url", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
              {SOCIAL_META.map(({ key, label }) => (
                <FormRow key={key} label={label}>
                  <input
                    type="url"
                    aria-label={label}
                    placeholder={`${label} URL`}
                    value={form.social_links[key] ?? ""}
                    onChange={(e) =>
                      set("social_links", { ...form.social_links, [key]: e.target.value })
                    }
                    className={FIELD_INPUT}
                  />
                </FormRow>
              ))}
            </DetailCard>

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Contact name">
                <input
                  aria-label="Contact name"
                  placeholder="Booker name"
                  value={form.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Email">
                <input
                  type="email"
                  aria-label="Email"
                  placeholder="email@example.com"
                  value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Phone">
                <input
                  type="tel"
                  aria-label="Phone"
                  placeholder="Phone number"
                  value={form.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
            </DetailCard>

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Bank name">
                <input
                  aria-label="Bank name"
                  placeholder="Account holder"
                  value={form.bank_account_name}
                  onChange={(e) => set("bank_account_name", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Account no">
                <input
                  aria-label="Account number"
                  placeholder="12345678"
                  value={form.bank_account_no}
                  onChange={(e) => set("bank_account_no", e.target.value)}
                  className={cn(FIELD_INPUT, "tabular-nums")}
                />
              </FormRow>
              <FormRow label="Sort code">
                <input
                  aria-label="Sort code"
                  placeholder="12-34-56"
                  value={form.bank_sort_code}
                  onChange={(e) => set("bank_sort_code", e.target.value)}
                  className={cn(FIELD_INPUT, "tabular-nums")}
                />
              </FormRow>
              <FormRow label="Payment ref">
                <input
                  aria-label="Payment reference"
                  placeholder="Reference"
                  value={form.bank_payment_ref}
                  onChange={(e) => set("bank_payment_ref", e.target.value)}
                  className={FIELD_INPUT}
                />
              </FormRow>
            </DetailCard>

            <DetailCard className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                  Photos
                </span>
                <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-admin-primary px-3 text-[11px] font-semibold text-white transition-colors hover:bg-admin-primary-hover">
                  {uploadingImages ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Add
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
              {form.image_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {form.image_urls.map((url) => (
                    <div
                      key={url}
                      className="relative aspect-square overflow-hidden rounded-xl border border-admin-line"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        aria-label="Remove photo"
                        className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </DetailCard>

            <DetailCard className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-admin-muted">
                  Videos <span className="opacity-60 tabular-nums">{videos.length}/{MAX_VIDEOS}</span>
                </span>
                {videos.length < MAX_VIDEOS && (
                  <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-admin-primary px-3 text-[11px] font-semibold text-white transition-colors hover:bg-admin-primary-hover">
                    <Upload className="h-3.5 w-3.5" />
                    Add
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
              {videos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {videos.map((v, i) => (
                    <div key={v.id} className="min-w-0">
                      {v.url ? (
                        <VideoFacade url={v.url} title={v.description || `Video ${i + 1}`} />
                      ) : (
                        <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl border border-black/10 bg-admin-ink">
                          {v.previewUrl && (
                            <video
                              src={`${v.previewUrl}#t=0.1`}
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
                              <span className="text-[10px] font-semibold text-red-200">{v.error}</span>
                            </span>
                          ) : (
                            <span className="relative flex flex-col items-center gap-1.5">
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                              <span className="text-[11px] font-semibold text-white tabular-nums">
                                {v.progress}%
                              </span>
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
                          placeholder="Description…"
                          className="min-w-0 flex-1 rounded-lg border border-admin-line bg-admin-surface px-2 py-1 text-[11px] text-admin-ink outline-none placeholder:text-admin-muted/50 focus:border-admin-primary/40"
                        />
                        <button
                          type="button"
                          onClick={() => removeVideo(v.id)}
                          aria-label="Remove video"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-admin-line bg-admin-card text-admin-muted transition-colors hover:border-admin-error/30 hover:bg-admin-error-bg hover:text-admin-error"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>
    </div>
  );
}

const ICON_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-admin-line bg-admin-card transition-colors hover:bg-admin-surface disabled:opacity-50 sm:h-9 sm:w-9";

function FavoriteButton({
  active,
  disabled,
  onToggle,
  stopPropagation,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  // Set on a row, where the click would otherwise carry on and open the sheet.
  stopPropagation?: boolean;
}) {
  const label = active ? "Remove from favourites" : "Mark as favourite";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onToggle();
      }}
      className={ICON_BUTTON}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          active ? "fill-rose-500 text-rose-500" : "text-admin-muted",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

function NotesButton({
  hasNotes,
  name,
  stopPropagation,
}: {
  hasNotes: boolean;
  name?: string;
  stopPropagation?: boolean;
}) {
  const label = name ? `Internal notes for ${name}` : "Internal notes";
  return (
    <button
      type="button"
      aria-label={label}
      title={hasNotes ? `${label} - has notes` : label}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={ICON_BUTTON}
    >
      <NotebookPen
        className={cn(
          "h-4 w-4 transition-colors",
          hasNotes ? "fill-admin-info/20 text-admin-info" : "text-admin-muted",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

// Lives inside a row that opens the sheet, so every click has to stop there.
function ContactActions({ act }: { act: MusicActWithContact }) {
  const email = act.contact?.email;
  const phone = telHref(act.contact?.phone_no);
  if (!email && !phone) return null;

  return (
    <span className="flex shrink-0 items-center gap-1">
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Email ${act.group_name}`}
          title={`Email ${email}`}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <Mail className="h-3.5 w-3.5" />
        </a>
      )}
      {phone && (
        <a
          href={phone}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Call ${act.group_name}`}
          title={`Call ${act.contact?.phone_no}`}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-primary-soft hover:text-admin-primary"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}

function TextAreaCard({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <DetailCard className="space-y-2 p-4">
      <label className="block text-[11px] font-semibold tracking-wide text-admin-muted">
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-2 w-full resize-y rounded-xl border border-admin-line bg-admin-surface px-3 py-2 text-sm font-medium text-admin-ink outline-none placeholder:text-admin-muted/40 focus:border-admin-primary/40"
        />
      </label>
    </DetailCard>
  );
}
