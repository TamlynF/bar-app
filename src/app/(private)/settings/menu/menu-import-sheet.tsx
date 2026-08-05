"use client";

import { useRef, useState, useTransition } from "react";
import {
  Loader2,
  Upload,
  FileText,
  Plus,
  ArrowRight,
  EyeOff,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecordSheet, DetailCard, ErrorBox, StatusPill } from "@/components/admin";
import { parseMenuUploadAction, applyMenuImportAction } from "./actions";
import {
  defaultSelection,
  summarise,
  type ChangeKind,
  type MenuChange,
} from "@/lib/menu-import";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

const KIND_ORDER: ChangeKind[] = [
  "price-change",
  "new-item",
  "new-category",
  "absent",
  "unchanged",
];

const KIND_META: Record<
  ChangeKind,
  { label: string; blurb: string; tone: "success" | "warning" | "error" | "info" | "neutral" }
> = {
  "price-change": {
    label: "Price changes",
    blurb: "These go live on the public menu straight away.",
    tone: "warning",
  },
  "new-item": { label: "New items", blurb: "Added to the end of their category.", tone: "success" },
  "new-category": {
    label: "New categories",
    blurb: "Added to the end of the menu.",
    tone: "success",
  },
  absent: {
    label: "Not on this menu",
    blurb: "Ticking these hides the item. Nothing is ever deleted.",
    tone: "error",
  },
  unchanged: { label: "Unchanged", blurb: "Already matches - nothing to do.", tone: "neutral" },
};

function KindIcon({ kind }: { kind: ChangeKind }) {
  if (kind === "price-change") return <ArrowRight className="h-3 w-3" />;
  if (kind === "absent") return <EyeOff className="h-3 w-3" />;
  if (kind === "unchanged") return <Check className="h-3 w-3" />;
  return <Plus className="h-3 w-3" />;
}

export default function MenuImportSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, startParse] = useTransition();
  const [isApplying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<number | null>(null);
  const [changes, setChanges] = useState<MenuChange[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  const reset = () => {
    setFileName(null);
    setError(null);
    setImportId(null);
    setChanges([]);
    setPicked([]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    startParse(async () => {
      const result = await parseMenuUploadAction(formData);
      if ("error" in result) {
        setError(result.error);
        setChanges([]);
        setImportId(null);
        return;
      }
      setImportId(result.importId);
      setChanges(result.changes);
      setPicked(defaultSelection(result.changes));
    });
  };

  const toggle = (key: string) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleGroup = (kind: ChangeKind) => {
    const keys = changes.filter((c) => c.kind === kind).map((c) => c.key);
    const allOn = keys.every((k) => picked.includes(k));
    setPicked((prev) =>
      allOn ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])],
    );
  };

  const apply = () => {
    if (importId == null) return;
    startApply(async () => {
      const result = await applyMenuImportAction(importId, picked);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success(
        `Applied ${result.applied} change${result.applied === 1 ? "" : "s"} to the menu.`,
      );
      close();
    });
  };

  const summary = summarise(changes);
  const hasResult = changes.length > 0;
  const pickedCount = picked.length;

  return (
    <RecordSheet
      open={open}
      onClose={close}
      mode={hasResult ? "edit" : "add"}
      title="Import menu from a file"
      formId="menu-import-form"
      isPending={isApplying}
      saveDisabled={!hasResult || pickedCount === 0 || isParsing}
      onCancel={close}
    >
      <form
        id="menu-import-form"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="animate-in space-y-4 duration-200 fade-in"
      >
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            isParsing
              ? "border-admin-line bg-admin-surface"
              : "border-admin-primary/40 bg-admin-card hover:bg-admin-primary-soft/40",
          )}
        >
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            aria-label="Menu file"
            disabled={isParsing || isApplying}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="sr-only"
          />
          {isParsing ? (
            <Loader2 className="h-7 w-7 animate-spin text-admin-primary" />
          ) : hasResult ? (
            <FileText className="h-7 w-7 text-admin-primary" />
          ) : (
            <Upload className="h-7 w-7 text-admin-primary" />
          )}
          <span className="text-sm font-semibold text-admin-ink">
            {isParsing ? "Reading the menu…" : fileName || "Choose a PDF or photo"}
          </span>
          <span className="text-[11px] text-admin-muted">
            {isParsing
              ? "This can take up to a minute on a long menu."
              : "PDF, PNG or JPEG, up to 15MB. Nothing changes until you apply."}
          </span>
        </label>

        {error && <ErrorBox message={error} />}

        {hasResult && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {KIND_ORDER.filter((kind) => summary[kind] > 0).map((kind) => (
                <StatusPill
                  key={kind}
                  tone={KIND_META[kind].tone}
                  icon={<KindIcon kind={kind} />}
                  showLabelOnMobile
                >
                  {summary[kind]} {KIND_META[kind].label.toLowerCase()}
                </StatusPill>
              ))}
            </div>

            {KIND_ORDER.filter((kind) => summary[kind] > 0).map((kind) => {
              const rows = changes.filter((c) => c.kind === kind);
              const actionable = kind !== "unchanged";
              const allOn = actionable && rows.every((r) => picked.includes(r.key));

              return (
                <DetailCard key={kind}>
                  <div className="flex items-center gap-2 border-b border-admin-line bg-admin-surface px-4 py-2 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold tracking-wide text-admin-primary">
                        {KIND_META[kind].label} ({rows.length})
                      </span>
                      <span className="block text-[11px] font-medium text-admin-muted">
                        {KIND_META[kind].blurb}
                      </span>
                    </span>
                    {actionable && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(kind)}
                        className="shrink-0 text-[11px] font-semibold text-admin-primary hover:underline"
                      >
                        {allOn ? "None" : "All"}
                      </button>
                    )}
                  </div>

                  {rows.map((change) => (
                    <label
                      key={change.key}
                      className={cn(
                        "flex items-start gap-2.5 border-b border-admin-line px-4 py-2.5 last:border-0 sm:px-5",
                        actionable && "cursor-pointer hover:bg-admin-surface/60",
                      )}
                    >
                      {actionable ? (
                        <input
                          type="checkbox"
                          checked={picked.includes(change.key)}
                          onChange={() => toggle(change.key)}
                          aria-label={`Apply: ${change.itemName ?? change.categoryName}`}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-admin-primary"
                        />
                      ) : (
                        <span className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-admin-ink">
                          {change.itemName ?? change.categoryName}
                        </span>
                        <span className="block truncate text-[11px] font-medium text-admin-muted">
                          {change.itemName ? change.categoryName : "New category"}
                        </span>
                      </span>

                      <span className="shrink-0 text-right text-[11px] font-semibold tabular-nums">
                        {change.before && change.kind !== "unchanged" && (
                          <span className="block text-admin-muted line-through">
                            {change.before}
                          </span>
                        )}
                        <span
                          className={cn(
                            "block",
                            change.kind === "absent" ? "text-admin-error" : "text-admin-ink",
                          )}
                        >
                          {change.after ?? "Hide from menu"}
                        </span>
                      </span>
                    </label>
                  ))}
                </DetailCard>
              );
            })}

            <p className="px-1 text-[11px] font-medium text-admin-muted">
              {pickedCount === 0
                ? "Tick at least one change to apply."
                : `${pickedCount} change${pickedCount === 1 ? "" : "s"} will be applied. Anything left unticked is ignored.`}
            </p>
          </>
        )}
      </form>
    </RecordSheet>
  );
}
