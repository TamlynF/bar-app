"use client";

import { useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { Check, ChevronRight, Copy, Loader2, MapPin, Plus, SearchX, Store, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { MarketingCompetitor } from "@/app/(private)/marketing/lib/types";
import { rivalMenuUrls, rivalMenuStatus, rivalStartUrls, RIVAL_CAPTURE_BATCH } from "@/app/(private)/marketing/lib/rivals";
import { stripTrackingParams } from "@/app/(private)/marketing/lib/http-url";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
} from "@/components/admin";
import {
  listRivalCaptureQueueAction,
  captureRivalUploadAction,
  captureRivalUrlAction,
  deleteRivalAction,
  discoverRivalsAction,
  saveRivalAction,
} from "./actions";

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

type JobProgressState = {
  label: string;
  current?: number;
  total?: number;
};

function JobProgress({ job }: { job: JobProgressState }) {
  const determinate = job.current != null && job.total != null && job.total > 0;
  const pct = determinate ? Math.min(100, Math.round((job.current! / job.total!) * 100)) : null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="rounded-2xl border border-admin-line bg-admin-primary-soft px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#34451F]" />
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-admin-ink">{job.label}</p>
        {determinate ? (
          <p className="shrink-0 text-[12px] font-semibold text-admin-muted">
            {job.current} of {job.total}
          </p>
        ) : null}
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-admin-card"
        aria-hidden={pct == null}
      >
        {pct != null ? (
          <div
            className="h-full rounded-full bg-[#34451F] transition-[width] duration-300 w-[var(--job-pct)]"
            style={{ "--job-pct": `${pct}%` } as CSSProperties}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#34451F]" />
        )}
      </div>
    </div>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function sourceLabel(rival: MarketingCompetitor): string {
  if (!rival.last_captured_at) return "None yet — set when drink prices are saved";
  if (rival.last_capture_source === "upload") return "Board photo";
  if (rival.last_capture_source === "menu_url") return "Menu URL";
  if (rival.last_capture_source === "website") return "Website";
  return "None yet — set when drink prices are saved";
}

function UrlValue({ href, label }: { href: string | null; label: string }) {
  if (!href) return "—";
  const clean = stripTrackingParams(href);

  const copy = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(clean);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy that link.");
    }
  };

  return (
    <span className="flex w-full min-w-0 items-start justify-end gap-1">
      <a
        href={clean}
        target="_blank"
        rel="noopener noreferrer"
        title={clean}
        className="min-w-0 flex-1 break-all text-left text-[13px] font-semibold leading-snug text-[#34451F] underline-offset-2 hover:underline"
      >
        {clean}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-admin-muted hover:bg-admin-surface hover:text-admin-ink"
      >
        <Copy className="h-4 w-4" />
      </button>
    </span>
  );
}

export default function RivalsClient({
  area,
  radius,
  initialRivals,
  priceCounts,
}: {
  area: string;
  radius: string | null;
  initialRivals: MarketingCompetitor[];
  priceCounts: Record<string, number>;
}) {
  const sheet = useRecordSheet<MarketingCompetitor>({
    records: initialRivals,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [job, setJob] = useState<JobProgressState | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialRivals;
    return initialRivals.filter((rival) =>
      [rival.name, rival.address, rival.website, ...(rival.menu_urls ?? [])]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    );
  }, [initialRivals, query]);

  const pinnedCount = initialRivals.filter((r) => r.is_pinned).length;
  const lastFoundAt = useMemo(() => {
    const times = initialRivals.map((rival) => rival.fetched_at).filter(Boolean).sort();
    return times[times.length - 1] ?? null;
  }, [initialRivals]);
  const selectedPriceCount = selected
    ? (priceCounts[selected.id] ?? priceCounts[`name:${selected.name}`] ?? 0)
    : 0;

  const loadForm = (record: MarketingCompetitor | null) => {
    setIsPinned(record?.is_pinned ?? true);
  };

  const openAdd = () => {
    loadForm(null);
    sheet.openAdd();
  };

  const startEdit = () => {
    loadForm(selected);
    sheet.startEdit();
  };

  const cancel = () => {
    if (mode === "add") sheet.close();
    else if (selected) sheet.openView(selected);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sheet.submit(async (formData) => {
      setJob({ label: "Saving rival" });
      try {
        const result = await saveRivalAction(formData);
        if ("error" in result) return { error: result.error };
        if (result.captureError) toast.error(result.captureError);
        else if (result.captured) toast.success(`Read ${result.captured} drink prices.`);
      } finally {
        setJob(null);
      }
    })(new FormData(e.currentTarget));
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Remove rival",
      description: `"${selected.name}" will leave the comparison and its captured prices will be deleted.`,
      action: async () => {
        setJob({ label: "Removing rival" });
        try {
          const result = await deleteRivalAction(selected.id);
          if ("error" in result) return { error: result.error };
        } finally {
          setJob(null);
        }
      },
    });
  };

  const handleDiscover = async () => {
    if (job) return;
    setJob({ label: "Looking up nearby pubs" });
      try {
        const result = await discoverRivalsAction();
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        if (result.added === 0 && result.updated === 0 && result.needsCapture.length === 0) {
          if (result.skippedIndustry) {
            toast(`Skipped ${result.skippedIndustry} nearby places that are not bars or pubs.`);
            return;
          }
          toast("No pubs found in that radius. Try a wider area on the price-off.");
          return;
        }

        const foundBits = [
          result.added || result.updated
            ? `Found ${result.added} new ${result.added === 1 ? "pub" : "pubs"}${
                result.updated ? `, updated ${result.updated}` : ""
              }`
            : null,
          result.skippedIndustry
            ? `Skipped ${result.skippedIndustry} that are not bars or pubs`
            : null,
        ].filter(Boolean);
        if (foundBits.length) toast.success(`${foundBits.join(". ")}.`);

        const targets = result.needsCapture.slice(0, RIVAL_CAPTURE_BATCH);
        if (!targets.length) {
          toast("None of those pubs have a website to read yet. Add a menu URL or upload a board photo.");
          return;
        }

        let captured = 0;
        let failed = 0;
        let prices = 0;
        for (let i = 0; i < targets.length; i += 1) {
          const target = targets[i];
          setJob({
            label: `Reading drinks menu · ${target.name}`,
            current: i + 1,
            total: targets.length,
          });
          const cap = await captureRivalUrlAction(target.id);
          if ("error" in cap) failed += 1;
          else {
            captured += 1;
            prices += cap.count;
          }
        }
        const remaining = result.needsCapture.length - targets.length;
        if (captured === 0) {
          toast.error(
            `Could not read drink prices from those sites.${
              remaining ? " Click Find drinks menus to try the next pubs, or upload a board photo." : ""
            }`,
          );
          return;
        }
        toast.success(
          `Read ${prices} drink prices from ${captured} ${captured === 1 ? "rival" : "rivals"}${
            failed ? `. ${failed} had no drinks menu online` : ""
          }${remaining ? `. ${remaining} still to go — click Find drinks menus.` : "."}`,
        );
      } finally {
        setJob(null);
      }
  };

  const handleCaptureAll = async () => {
    if (job) return;
    setJob({ label: "Finding drinks menus" });
      try {
        const queued = await listRivalCaptureQueueAction();
        if ("error" in queued) {
          toast.error(queued.error);
          return;
        }
        let captured = 0;
        let failed = 0;
        let prices = 0;
        for (let i = 0; i < queued.rivals.length; i += 1) {
          const target = queued.rivals[i];
          setJob({
            label: `Reading drinks menu · ${target.name}`,
            current: i + 1,
            total: queued.rivals.length,
          });
          const cap = await captureRivalUrlAction(target.id);
          if ("error" in cap) failed += 1;
          else {
            captured += 1;
            prices += cap.count;
          }
        }
        if (captured === 0) {
          toast.error("Could not read drink prices from those sites. Try a drinks menu URL, or upload a board photo.");
          return;
        }
        toast.success(
          `Read ${prices} drink prices from ${captured} ${captured === 1 ? "rival" : "rivals"}${
            failed ? `. ${failed} had no drinks menu online` : ""
          }${queued.leftover ? `. ${queued.leftover} still to go — click Find drinks menus again.` : "."}`,
        );
      } finally {
        setJob(null);
      }
  };

  const handleCaptureUrl = async () => {
    if (!selected || job) return;
    setJob({ label: `Reading drinks menu · ${selected.name}` });
      try {
        const result = await captureRivalUrlAction(selected.id);
        if ("error" in result) toast.error(result.error);
        else toast.success(`Read ${result.count} drink prices from ${selected.name}.`);
      } finally {
        setJob(null);
      }
  };

  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected || job) return;
    const formData = new FormData(e.currentTarget);
    void (async () => {
      setJob({ label: "Reading board photo" });
      try {
        const result = await captureRivalUploadAction(formData);
        if ("error" in result) toast.error(result.error);
        else toast.success(`Read ${result.count} prices from the board photo.`);
      } finally {
        setJob(null);
      }
    })();
  };

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;
  const title = mode === "add" ? "New rival" : mode === "edit" ? "Edit rival" : "Rival";
  const hasAnyMenuUrl = initialRivals.some((r) => rivalStartUrls(r).length);
  const hasMenuUrl = selected ? rivalStartUrls(selected).length > 0 : false;
  const busy = !!job || sheet.isPending;

  const discoverButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleDiscover();
      }}
      disabled={busy}
      className="inline-flex h-11 items-center rounded-xl bg-admin-primary px-4 text-[13px] font-semibold text-white hover:bg-admin-primary-hover disabled:opacity-60 sm:h-9"
    >
      {job ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-1.5 h-3.5 w-3.5" />}
      Find nearby pubs
    </button>
  );

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {job ? <JobProgress job={job} /> : null}
      {initialRivals.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No rivals yet"
          description={`Find pubs near ${area}${radius ? ` (${radius})` : ""} and we will pin them for the price-off. Unpin any that are not real rivals.`}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {discoverButton}
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex h-9 items-center rounded-lg border border-admin-line px-4 text-[13px] font-semibold text-admin-muted hover:bg-admin-surface"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add rival
              </button>
            </div>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Rivals"
          count={shown.length}
          subtitle={`${pinnedCount} on the price-off near ${area}${
            lastFoundAt ? ` · Find nearby last ran ${formatWhen(lastFoundAt)}` : ""
          }`}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex h-11 items-center rounded-xl border border-admin-line px-3 text-[13px] font-semibold text-admin-muted hover:bg-admin-surface sm:h-9"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Rival
              </button>
              <button
                type="button"
                onClick={handleCaptureAll}
                disabled={busy || !hasAnyMenuUrl}
                className="inline-flex h-11 items-center rounded-xl border border-[#34451F] px-3 text-[13px] font-semibold text-[#34451F] hover:bg-[#E5EBD8] disabled:opacity-60 sm:h-9"
              >
                {job ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Find drinks menus
              </button>
              {discoverButton}
            </div>
          }
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search rivals"
              placeholder="Search by name or address"
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
            shown.map((rival) => {
              const menu = rivalMenuStatus(rival);
              const prices = priceCounts[rival.id] ?? priceCounts[`name:${rival.name}`] ?? 0;
              return (
              <ListRow
                key={rival.id}
                onClick={() => sheet.openView(rival)}
                status={
                  <StatusPill
                    tone={rival.is_pinned ? "success" : "neutral"}
                    icon={
                      rival.is_pinned ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )
                    }
                    className="sm:w-28 sm:justify-center"
                  >
                    {rival.is_pinned ? "Pinned" : "Off"}
                  </StatusPill>
                }
              >
                <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(0,0.7fr)_minmax(0,0.5fr)] sm:items-center sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-admin-ink">{rival.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-admin-muted sm:hidden">
                      {menu.label} · {prices} {prices === 1 ? "price" : "prices"}
                    </p>
                    {rival.website ? (
                      <a
                        href={stripTrackingParams(rival.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 block truncate text-[12px] text-[#34451F] underline-offset-2 hover:underline sm:hidden"
                      >
                        {stripTrackingParams(rival.website)}
                      </a>
                    ) : null}
                  </div>
                  {rival.website ? (
                    <a
                      href={stripTrackingParams(rival.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={stripTrackingParams(rival.website)}
                      onClick={(e) => e.stopPropagation()}
                      className="hidden truncate text-[12px] text-[#34451F] underline-offset-2 hover:underline sm:block"
                    >
                      {stripTrackingParams(rival.website)}
                    </a>
                  ) : (
                    <p className="hidden truncate text-[12px] text-admin-muted sm:block">—</p>
                  )}
                  <p className="hidden truncate text-[12px] text-admin-muted sm:block">
                    {rival.address ?? "—"}
                  </p>
                  <p className="hidden truncate text-[12px] text-admin-muted sm:block">
                    {menu.label}
                  </p>
                  <p className="hidden truncate text-[12px] font-semibold tabular-nums text-admin-ink sm:block">
                    {prices}
                  </p>
                </div>
              </ListRow>
              );
            })
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={mode}
        navigate={sheet.navigateAcross(shown)}
        title={title}
        recordId={selected?.id}
        formId="rival-form"
        isPending={sheet.isPending || busy}
        onEdit={selected ? startEdit : undefined}
        onDelete={selected ? handleDelete : undefined}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill
              tone={selected.is_pinned ? "success" : "neutral"}
              icon={
                selected.is_pinned ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )
              }
              showLabelOnMobile
            >
              {selected.is_pinned ? "Pinned" : "Off"}
            </StatusPill>
          )
        }
      >
        {job ? <div className="mb-3"><JobProgress job={job} /></div> : null}
        {showForm ? (
          <form id="rival-form" onSubmit={handleSubmit} className="space-y-3">
            {formDefault && <input type="hidden" name="id" value={formDefault.id} />}
            <input type="hidden" name="is_pinned" value={isPinned ? "true" : "false"} />
            <DetailCard>
              <FormRow label="Name" required>
                <input
                  name="name"
                  required
                  defaultValue={formDefault?.name ?? ""}
                  placeholder="The Flintlock"
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Website">
                <input
                  name="website"
                  type="url"
                  defaultValue={formDefault?.website ?? ""}
                  placeholder="https://"
                  className={FIELD_INPUT}
                />
              </FormRow>
              <FormRow label="Menu URLs" align="start">
                <textarea
                  name="menu_urls"
                  rows={3}
                  defaultValue={(formDefault?.menu_urls ?? []).join("\n")}
                  placeholder={"https://example.com/menu\nhttps://example.com/drinks.pdf"}
                  className="min-h-20 flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40"
                />
              </FormRow>
              {formDefault && (
                <FormRow label="Pinned">
                  <label className="flex flex-1 cursor-pointer items-center justify-end gap-2">
                    <span className="text-[12px] font-semibold text-admin-muted">
                      {isPinned ? "On the price-off" : "Hidden"}
                    </span>
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="h-5 w-5 accent-[#34451F]"
                      aria-label="Include this rival on the price-off"
                    />
                  </label>
                </FormRow>
              )}
            </DetailCard>
            <p className="px-1 text-[12px] text-admin-muted">
              If they have no digital menu, save the name then upload a photo of the drinks board.
            </p>
          </form>
        ) : selected ? (
          <div className="space-y-3">
            <DetailCard>
              <DetailCell label="Name" value={selected.name} />
              <DetailCell
                label="Address"
                multiline
                value={
                  selected.address ? (
                    <span className="flex w-full min-w-0 items-start justify-end gap-1">
                      <span className="min-w-0 flex-1 break-words text-left text-sm font-semibold leading-snug text-admin-ink">
                        {selected.address}
                      </span>
                      <a
                        href={mapsSearchUrl(selected.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open address in Google Maps"
                        title="Open in Google Maps"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#34451F] hover:bg-admin-surface"
                      >
                        <MapPin className="h-4 w-4" />
                      </a>
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailCell
                label="Website"
                multiline
                value={<UrlValue href={selected.website} label="website" />}
              />
              <DetailCell
                label="Menu URLs"
                multiline
                value={
                  rivalMenuUrls(selected).length ? (
                    <span className="flex w-full flex-col gap-2">
                      {rivalMenuUrls(selected).map((href) => (
                        <UrlValue key={href} href={href} label="menu URL" />
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailCell label="Last found" value={formatWhen(selected.fetched_at)} />
              <DetailCell label="Last captured" value={formatWhen(selected.last_captured_at)} />
              <DetailCell label="Source" value={sourceLabel(selected)} />
              <DetailCell
                label="Prices"
                value={
                  selectedPriceCount > 0 ? (
                    <Link
                      href={`/marketing/trends?tab=prices&rival=${encodeURIComponent(selected.id)}&venue=${encodeURIComponent(selected.name)}#sourced-prices`}
                      className="inline-flex min-h-11 items-center justify-end gap-1 text-[13px] font-semibold text-[#34451F] underline-offset-2 hover:underline"
                    >
                      {selectedPriceCount} drink {selectedPriceCount === 1 ? "price" : "prices"}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    "None saved"
                  )
                }
              />
            </DetailCard>

            <form onSubmit={handleUpload} className="space-y-2 rounded-3xl border-2 border-admin-line bg-admin-card p-4">
              <input type="hidden" name="id" value={selected.id} />
              <p className="text-[13px] font-semibold text-admin-ink">Capture prices</p>
              <p className="text-[12px] text-admin-muted">
                Read their drinks menu, follow Menu → Drinks → PDF if the site has it, or upload photos of the board.
              </p>
              <label htmlFor="rival-menu-file" className="sr-only">
                Drinks board photo or PDF
              </label>
              <input
                id="rival-menu-file"
                name="file"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="block w-full text-[12px] text-admin-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-admin-line file:bg-admin-surface file:px-3 file:text-[13px] file:font-semibold file:text-admin-ink"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-11 items-center rounded-xl border border-[#34451F] px-4 text-[13px] font-semibold text-[#34451F] hover:bg-[#E5EBD8] disabled:opacity-60"
                >
                  {job ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Upload board
                </button>
                <button
                  type="button"
                  onClick={handleCaptureUrl}
                  disabled={busy || !hasMenuUrl}
                  className="inline-flex h-11 items-center rounded-xl bg-[#34451F] px-4 text-[13px] font-semibold text-white hover:bg-[#283719] disabled:opacity-60"
                >
                  {job ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Find drinks menus
                </button>
              </div>
              {!hasMenuUrl && (
                <p className="text-[12px] text-admin-muted">
                  No website yet — add one under Edit, or upload a photo.
                </p>
              )}
            </form>
          </div>
        ) : null}
      </RecordSheet>
    </div>
  );
}
