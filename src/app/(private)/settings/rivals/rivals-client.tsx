"use client";

import { useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  MapPin,
  Plus,
  SearchX,
  Store,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MarketingCompetitor, RivalRunLog, RivalRunStep } from "@/app/(private)/marketing/lib/types";
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
  saveRivalRunLogAction,
} from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

function runStep(level: RivalRunStep["level"], title: string, detail?: string): RivalRunStep {
  return { at: new Date().toISOString(), level, title, detail };
}

function runHeadline(log: RivalRunLog | null): { tone: "success" | "error" | "neutral"; text: string } {
  if (!log) return { tone: "neutral", text: "Find nearby has not been logged yet" };
  const when = formatWhen(log.finishedAt);
  const verb = log.kind === "menus" ? "Find drinks menus" : "Find nearby pubs";
  if (log.ok) return { tone: "success", text: `${verb} succeeded · ${when}` };
  return { tone: "error", text: `${verb} had errors · ${when}` };
}

const RUN_TONE = {
  success: "text-admin-success hover:bg-admin-success-bg",
  error: "text-admin-error hover:bg-admin-error-bg",
  neutral: "text-admin-muted",
} as const;

function RunStatusLink({
  log,
  fallbackAt,
  onOpen,
}: {
  log: RivalRunLog | null;
  fallbackAt: string | null;
  onOpen: () => void;
}) {
  const headline = runHeadline(log);
  const Icon = headline.tone === "success" ? CheckCircle2 : headline.tone === "error" ? AlertTriangle : Info;
  const text =
    !log && fallbackAt
      ? `Find nearby pubs last ran ${formatWhen(fallbackAt)} · before run logging started`
      : headline.text;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!log}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl px-2 text-left text-[13px] font-semibold transition-colors disabled:cursor-default",
        RUN_TONE[headline.tone],
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{text}</span>
      {log && <span className="shrink-0 underline underline-offset-2">View log</span>}
    </button>
  );
}

const STEP_ICON = {
  ok: { Icon: CheckCircle2, className: "text-admin-success" },
  error: { Icon: XCircle, className: "text-admin-error" },
  info: { Icon: Info, className: "text-admin-muted" },
} as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function RunLogDialog({
  log,
  open,
  onOpenChange,
}: {
  log: RivalRunLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;
  const verb = log.kind === "menus" ? "Find drinks menus" : "Find nearby pubs";
  const errors = log.steps.filter((step) => step.level === "error").length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(42rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-surface p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-admin-line px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-base font-bold tracking-tight text-admin-ink">{verb} · run log</DialogTitle>
          <DialogDescription className="text-[13px] text-admin-muted">
            {log.summary} · started {formatWhen(log.startedAt)}, finished {formatTime(log.finishedAt)}
            {errors ? ` · ${errors} ${errors === 1 ? "error" : "errors"}` : ""}
          </DialogDescription>
        </DialogHeader>
        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {log.steps.map((step, index) => {
            const { Icon, className } = STEP_ICON[step.level];
            return (
              <li key={`${step.at}-${index}`} className="rounded-2xl border border-admin-line bg-admin-card px-4 py-3">
                <div className="flex items-start gap-2">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} />
                  <p className="min-w-0 flex-1 text-[13px] font-semibold text-admin-ink">{step.title}</p>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-admin-muted">{formatTime(step.at)}</span>
                </div>
                {step.detail && (
                  <p className="mt-2 pl-6 text-[12px] leading-snug wrap-break-word whitespace-pre-wrap text-admin-muted">{step.detail}</p>
                )}
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
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
  lastRivalRun,
}: {
  area: string;
  radius: string | null;
  initialRivals: MarketingCompetitor[];
  priceCounts: Record<string, number>;
  lastRivalRun: RivalRunLog | null;
}) {
  const sheet = useRecordSheet<MarketingCompetitor>({
    records: initialRivals,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [job, setJob] = useState<JobProgressState | null>(null);
  const [lastRun, setLastRun] = useState<RivalRunLog | null>(lastRivalRun);
  const [logOpen, setLogOpen] = useState(false);

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

  /* The log is shown straight away and then written to the settings row, so a
     run survives a reload and the next person to open the page sees how the
     last one went. */
  const finishRun = async (log: RivalRunLog) => {
    setLastRun(log);
    const saved = await saveRivalRunLogAction(log);
    if (saved.error) toast.error(`The run log could not be saved: ${saved.error}`);
  };

  const captureBatch = async (targets: { id: string; name: string }[], steps: RivalRunStep[]) => {
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
      const detail = cap.notes.join("\n") || undefined;
      if ("error" in cap) {
        failed += 1;
        steps.push(runStep("error", `${target.name}: ${cap.error}`, detail));
      } else {
        captured += 1;
        prices += cap.count;
        steps.push(
          runStep("ok", `${target.name}: read ${cap.count} drink ${cap.count === 1 ? "price" : "prices"}`, detail),
        );
      }
    }
    return { captured, failed, prices };
  };

  const noPricesMessage = (count: number) =>
    `None of those ${count} sites list drink prices we could read. Open the run log to see what was tried, then paste a drinks menu URL or upload a board photo.`;

  const handleDiscover = async () => {
    if (job) return;
    const startedAt = new Date().toISOString();
    const steps: RivalRunStep[] = [runStep("info", `Asked Google Places for pubs near ${area}${radius ? ` within ${radius}` : ""}`)];
    const finish = (ok: boolean, summary: string) =>
      finishRun({ startedAt, finishedAt: new Date().toISOString(), kind: "discover", ok, summary, steps });
    setJob({ label: "Looking up nearby pubs" });
    try {
      const result = await discoverRivalsAction();
      if ("error" in result) {
        steps.push(runStep("error", result.error));
        toast.error(result.error);
        await finish(false, result.error);
        return;
      }
      steps.push(
        runStep(
          "ok",
          `Found ${result.added} new, updated ${result.updated}, unpinned ${result.unpinned}`,
          [
            result.skippedOwn ? `Skipped ${result.skippedOwn} that looked like our own venue` : null,
            result.skippedIndustry ? `Skipped ${result.skippedIndustry} that are not bars or pubs` : null,
          ]
            .filter(Boolean)
            .join("\n") || undefined,
        ),
      );
      if (result.added === 0 && result.updated === 0 && result.needsCapture.length === 0) {
        const summary = result.skippedIndustry
          ? `Skipped ${result.skippedIndustry} nearby places that are not bars or pubs.`
          : "No pubs found in that radius. Try a wider area on the price-off.";
        steps.push(runStep("info", summary));
        toast(summary);
        await finish(true, summary);
        return;
      }

      const foundBits = [
        result.added || result.updated
          ? `Found ${result.added} new ${result.added === 1 ? "pub" : "pubs"}${
              result.updated ? `, updated ${result.updated}` : ""
            }`
          : null,
        result.skippedIndustry ? `Skipped ${result.skippedIndustry} that are not bars or pubs` : null,
      ].filter(Boolean);
      if (foundBits.length) toast.success(`${foundBits.join(". ")}.`);

      const targets = result.needsCapture.slice(0, RIVAL_CAPTURE_BATCH);
      if (!targets.length) {
        const summary = "None of those pubs have a website to read yet. Add a menu URL or upload a board photo.";
        steps.push(runStep("info", summary));
        toast(summary);
        await finish(true, `${foundBits.join(". ") || "Nothing new"}. Nothing to read yet.`);
        return;
      }

      steps.push(runStep("info", `Reading drinks menus for ${targets.length} of ${result.needsCapture.length} waiting rivals`));
      const { captured, failed, prices } = await captureBatch(targets, steps);
      const remaining = result.needsCapture.length - targets.length;
      if (captured === 0) {
        steps.push(runStep("error", `No drink prices read from any of the ${targets.length} sites tried`));
        toast.error(noPricesMessage(targets.length));
        await finish(false, `Found ${result.added} new. No drink prices read from ${targets.length} sites.`);
        return;
      }
      const summary = `Read ${prices} drink prices from ${captured} ${captured === 1 ? "rival" : "rivals"}${
        failed ? `. ${failed} had no drinks menu online` : ""
      }${remaining ? `. ${remaining} still to go — click Find drinks menus.` : "."}`;
      steps.push(runStep(failed ? "info" : "ok", summary));
      toast.success(summary);
      await finish(true, summary);
    } finally {
      setJob(null);
    }
  };

  const handleCaptureAll = async () => {
    if (job) return;
    const startedAt = new Date().toISOString();
    const steps: RivalRunStep[] = [];
    const finish = (ok: boolean, summary: string) =>
      finishRun({ startedAt, finishedAt: new Date().toISOString(), kind: "menus", ok, summary, steps });
    setJob({ label: "Finding drinks menus" });
    try {
      const queued = await listRivalCaptureQueueAction();
      if ("error" in queued) {
        steps.push(runStep("error", queued.error));
        toast.error(queued.error);
        await finish(false, queued.error);
        return;
      }
      steps.push(
        runStep(
          "info",
          `Queued ${queued.rivals.length} rivals with a website or menu URL`,
          queued.rivals.map((rival) => rival.name).join(", "),
        ),
      );
      const { captured, failed, prices } = await captureBatch(queued.rivals, steps);
      if (captured === 0) {
        steps.push(runStep("error", `No drink prices read from any of the ${queued.rivals.length} sites tried`));
        toast.error(noPricesMessage(queued.rivals.length));
        await finish(false, `No drink prices read from ${queued.rivals.length} sites.`);
        return;
      }
      const summary = `Read ${prices} drink prices from ${captured} ${captured === 1 ? "rival" : "rivals"}${
        failed ? `. ${failed} had no drinks menu online` : ""
      }${queued.leftover ? `. ${queued.leftover} still to go — click Find drinks menus again.` : "."}`;
      steps.push(runStep(failed ? "info" : "ok", summary));
      toast.success(summary);
      await finish(true, summary);
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
          layout="stacked"
          title="Rivals"
          count={shown.length}
          subtitle={`${pinnedCount} on the price-off near ${area}${radius ? ` (${radius})` : ""}`}
          banner={<RunStatusLink log={lastRun} fallbackAt={lastFoundAt} onOpen={() => setLogOpen(true)} />}
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

      <RunLogDialog log={lastRun} open={logOpen} onOpenChange={setLogOpen} />

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
              {selected.last_capture_error && (
                <DetailCell
                  label="Last attempt"
                  multiline
                  value={
                    <span className="block text-left">
                      <span className="block text-[12px] font-semibold text-admin-muted">
                        {formatWhen(selected.last_capture_attempted_at ?? null)}
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug font-medium wrap-break-word whitespace-pre-wrap text-admin-error">
                        {selected.last_capture_error}
                      </span>
                    </span>
                  }
                />
              )}
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
