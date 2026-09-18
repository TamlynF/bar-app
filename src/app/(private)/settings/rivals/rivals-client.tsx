"use client";

import { useMemo, useState, useTransition, type MouseEvent } from "react";
import { Check, Copy, Loader2, MapPin, Plus, SearchX, Store, X } from "lucide-react";
import { toast } from "sonner";
import type { MarketingCompetitor } from "@/app/(private)/marketing/lib/types";
import { rivalMenuUrls, rivalStartUrls } from "@/app/(private)/marketing/lib/rivals";
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
  captureAllRivalMenusAction,
  captureRivalUploadAction,
  captureRivalUrlAction,
  deleteRivalAction,
  discoverRivalsAction,
  saveRivalAction,
} from "./actions";

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";

function formatCaptured(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sourceLabel(rival: MarketingCompetitor): string {
  if (rival.last_capture_source === "upload") return "Board photo";
  if (rival.last_capture_source === "menu_url") return "Menu URL";
  if (rival.last_capture_source === "website") return "Website";
  return "—";
}

function UrlValue({ href, label }: { href: string | null; label: string }) {
  if (!href) return "—";

  const copy = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(href);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy that link.");
    }
  };

  return (
    <span className="flex min-w-0 items-center justify-end gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={href}
        className="min-w-0 truncate text-[#34451F] underline-offset-2 hover:underline"
      >
        {href}
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
}: {
  area: string;
  radius: string | null;
  initialRivals: MarketingCompetitor[];
}) {
  const sheet = useRecordSheet<MarketingCompetitor>({
    records: initialRivals,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [isDiscovering, startDiscover] = useTransition();
  const [isCapturing, startCapture] = useTransition();
  const [isCapturingAll, startCaptureAll] = useTransition();

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialRivals;
    return initialRivals.filter((rival) =>
      [rival.name, rival.address, rival.website, rival.menu_url, ...(rival.menu_urls ?? [])]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    );
  }, [initialRivals, query]);

  const pinnedCount = initialRivals.filter((r) => r.is_pinned).length;

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
      const result = await saveRivalAction(formData);
      if ("error" in result) return { error: result.error };
      if (result.captureError) toast.error(result.captureError);
      else if (result.captured) toast.success(`Read ${result.captured} drink prices.`);
    })(new FormData(e.currentTarget));
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Remove rival",
      description: `"${selected.name}" will leave the comparison and its captured prices will be deleted.`,
      action: async () => {
        const result = await deleteRivalAction(selected.id);
        if ("error" in result) return { error: result.error };
      },
    });
  };

  const handleDiscover = () => {
    startDiscover(async () => {
      const result = await discoverRivalsAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.added === 0 && result.updated === 0) {
        if (result.skippedIndustry) {
          toast(`Skipped ${result.skippedIndustry} nearby places that are not bars or pubs.`);
          return;
        }
        toast("No pubs found in that radius. Try a wider area on the price-off.");
        return;
      }
      toast.success(
        `Found ${result.added} new ${result.added === 1 ? "pub" : "pubs"}${
          result.updated ? `, updated ${result.updated}` : ""
        }${
          result.skippedIndustry
            ? `. Skipped ${result.skippedIndustry} that are not bars or pubs`
            : ""
        }${
          result.menusCaptured
            ? `. Read drinks menus for ${result.menusCaptured}.`
            : "."
        }`,
      );
    });
  };

  const handleCaptureAll = () => {
    startCaptureAll(async () => {
      const result = await captureAllRivalMenusAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Read ${result.prices} drink prices from ${result.captured} ${result.captured === 1 ? "rival" : "rivals"}${
          result.failed ? `. ${result.failed} had no drinks menu online.` : "."
        }`,
      );
    });
  };

  const handleCaptureUrl = () => {
    if (!selected) return;
    startCapture(async () => {
      const result = await captureRivalUrlAction(selected.id);
      if ("error" in result) toast.error(result.error);
      else toast.success(`Read ${result.count} drink prices from ${selected.name}.`);
    });
  };

  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const formData = new FormData(e.currentTarget);
    startCapture(async () => {
      const result = await captureRivalUploadAction(formData);
      if ("error" in result) toast.error(result.error);
      else toast.success(`Read ${result.count} prices from the board photo.`);
    });
  };

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;
  const title = mode === "add" ? "New rival" : mode === "edit" ? "Edit rival" : "Rival";
  const hasAnyMenuUrl = initialRivals.some((r) => rivalStartUrls(r).length);
  const hasMenuUrl = selected ? rivalStartUrls(selected).length > 0 : false;
  const busy = isDiscovering || isCapturing || isCapturingAll;

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
      {isDiscovering ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-1.5 h-3.5 w-3.5" />}
      Find nearby pubs
    </button>
  );

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
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
          subtitle={`${pinnedCount} compared near ${area}`}
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
                {isCapturingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
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
            shown.map((rival) => (
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
                    {rival.is_pinned ? "Compared" : "Off"}
                  </StatusPill>
                }
              >
                <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-admin-ink">{rival.name}</p>
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
                    {rival.last_captured_at
                      ? formatCaptured(rival.last_captured_at)
                      : "No menu yet"}
                  </p>
                </div>
              </ListRow>
            ))
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={mode}
        title={title}
        recordId={selected?.id}
        formId="rival-form"
        isPending={sheet.isPending || isCapturing || isCapturingAll}
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
              {selected.is_pinned ? "Compared" : "Off"}
            </StatusPill>
          )
        }
      >
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
                <FormRow label="Compared">
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
              <DetailCell label="Address" value={selected.address ?? "—"} />
              <DetailCell label="Website" value={<UrlValue href={selected.website} label="website" />} />
              <DetailCell
                label="Menu URLs"
                multiline
                value={
                  rivalMenuUrls(selected).length ? (
                    <span className="flex flex-col items-end gap-1">
                      {rivalMenuUrls(selected).map((href) => (
                        <UrlValue key={href} href={href} label="menu URL" />
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailCell label="Last captured" value={formatCaptured(selected.last_captured_at)} />
              <DetailCell label="Source" value={sourceLabel(selected)} />
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
                  {isCapturing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Upload board
                </button>
                <button
                  type="button"
                  onClick={handleCaptureUrl}
                  disabled={busy || !hasMenuUrl}
                  className="inline-flex h-11 items-center rounded-xl bg-[#34451F] px-4 text-[13px] font-semibold text-white hover:bg-[#283719] disabled:opacity-60"
                >
                  {isCapturing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
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
