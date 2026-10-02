"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Heart,
  NotebookPen,
  Music2,
  Guitar,
  SearchX,
  CalendarCheck,
  CalendarX,
  CalendarDays,
  Mail,
  Phone,
} from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteMusicActAction, setMusicActFavoriteAction } from "./actions";
import {
  MusicActSheet,
  socialsOf,
  telHref,
  type ActCounts,
  type EmployeeOption,
  type MusicActWithContact,
} from "./music-act-sheet";
import {
  useRecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  EmptyState,
} from "@/components/admin";

export type { ActCounts, EmployeeOption, MusicActWithContact };

export default function MusicActsClient({
  initialActs = [],
  counts = {},
  unreadEmails = {},
  typeOptions = [],
  employees = [],
  maxVideoBytes,
}: {
  initialActs: MusicActWithContact[];
  counts: Record<string, ActCounts>;
  unreadEmails?: Record<string, number>;
  typeOptions: string[];
  employees?: EmployeeOption[];
  maxVideoBytes: number;
}) {
  const sheet = useRecordSheet<MusicActWithContact>({
    records: initialActs,
    getId: (record) => record.id,
  });
  const { selected } = sheet;
  const [query, setQuery] = useState("");
  const [focusNotes, setFocusNotes] = useState(false);
  const [recordPending, startRecordTransition] = useTransition();

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

  const openAdd = () => {
    setFocusNotes(false);
    sheet.openAdd();
  };

  const openAct = (act: MusicActWithContact) => {
    setFocusNotes(false);
    sheet.openView(act);
  };

  const openNotes = (act: MusicActWithContact) => {
    setFocusNotes(true);
    sheet.openView(act);
  };

  const closeSheet = () => {
    setFocusNotes(false);
    sheet.close();
  };

  const toggleFavorite = (act: MusicActWithContact) => {
    startRecordTransition(async () => {
      const result = await setMusicActFavoriteAction(act.id, !act.is_favorite);
      if ("error" in result) toast.error(result.error);
    });
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Delete music act",
      description: `Delete "${selected.group_name}"? This cannot be undone. Linked band requests are kept but unlinked.`,
      action: async () => {
        const result = await deleteMusicActAction(selected.id);
        if ("error" in result) {
          toast.error(result.error);
          return { error: result.error };
        }
        toast.success("Music act deleted");
        return undefined;
      },
    });
  };

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
                  onClick={() => openAct(act)}
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
                      {(unreadEmails[act.id] ?? 0) > 0 && (
                        <span
                          className="relative flex h-11 w-11 shrink-0 items-center justify-center sm:h-9 sm:w-9"
                          title={`${unreadEmails[act.id]} new email${unreadEmails[act.id] === 1 ? "" : "s"} from ${act.group_name}`}
                        >
                          <Mail className="h-4 w-4 text-admin-warning" aria-hidden="true" />
                          <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-admin-warning px-1 text-[11px] leading-none font-semibold text-white tabular-nums">
                            {unreadEmails[act.id]}
                          </span>
                          <span className="sr-only">{unreadEmails[act.id]} new emails</span>
                        </span>
                      )}
                      <FavoriteButton
                        active={act.is_favorite}
                        disabled={recordPending}
                        onToggle={() => toggleFavorite(act)}
                        stopPropagation
                      />
                      <NotesButton
                        count={act.notes?.length ?? 0}
                        name={act.group_name}
                        onOpen={() => openNotes(act)}
                      />
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

      <MusicActSheet
        open={sheet.open}
        act={selected}
        counts={selected ? (counts[selected.id] ?? { bookings: 0, completed: 0, upcoming: 0 }) : null}
        unreadEmails={selected ? (unreadEmails[selected.id] ?? 0) : 0}
        typeOptions={typeOptions}
        employees={employees}
        maxVideoBytes={maxVideoBytes}
        navigate={sheet.navigateAcross(shown)}
        focusNotes={focusNotes}
        onClose={closeSheet}
        onDelete={handleDelete}
      />
      {sheet.ConfirmDialogUI}
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

// Opens the act at its notes card, so the row click underneath must not fire.
function NotesButton({ count, name, onOpen }: { count: number; name: string; onOpen: () => void }) {
  const label = `Internal notes for ${name}`;
  return (
    <button
      type="button"
      aria-label={count > 0 ? `${label}: ${count}` : label}
      title={count > 0 ? `${label} - ${count}` : label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(ICON_BUTTON, "relative")}
    >
      <NotebookPen
        className={cn("h-4 w-4 transition-colors", count > 0 ? "fill-admin-info/20 text-admin-info" : "text-admin-muted")}
        aria-hidden="true"
      />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-admin-info px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
          {count}
        </span>
      )}
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
