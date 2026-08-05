"use client";

import React, { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Save,
  Pencil,
  Trash2,
  AlertCircle,
  Info,
} from "lucide-react";

export type SheetMode = "closed" | "add" | "view" | "edit";

type ActionResult = { error?: string } | void | null | undefined;

export function useRecordSheet<T>(options?: {
  // Pass the live list and an id reader to keep the open record in step with the
  // server. Without them the sheet holds the snapshot it opened with, which goes
  // stale the moment a save revalidates the page.
  records?: T[];
  getId?: (record: T) => number | string;
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [held, setSelected] = useState<T | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const openView = useCallback((record: T) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(record);
  }, []);

  const openAdd = useCallback(() => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setIsAdding(true);
  }, []);

  const startEdit = useCallback(() => {
    setFormError(null);
    setIsEditing(true);
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
  }, []);

  // Saving an edit drops back to the record rather than dismissing the sheet -
  // you asked to change it, not to leave. A new record has nothing to fall back
  // to, so that one closes.
  const submit = useCallback(
    (action: (formData: FormData) => Promise<ActionResult>) =>
      (formData: FormData) => {
        setFormError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) {
            setFormError(result.error);
            return;
          }
          if (isAdding) close();
          else setIsEditing(false);
        });
      },
    [close, isAdding],
  );

  const confirmDelete = useCallback(
    async (opts: {
      title: string;
      description?: string;
      confirmLabel?: string;
      action: () => Promise<ActionResult>;
    }) => {
      const ok = await confirm({
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel ?? "Delete",
        variant: "destructive",
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await opts.action();
        if (result?.error) setFormError(result.error);
        else close();
      });
    },
    [confirm, close],
  );

  const { records, getId } = options ?? {};
  const selected =
    held && records && getId
      ? (records.find((record) => getId(record) === getId(held)) ?? held)
      : held;

  const mode: SheetMode = isAdding
    ? "add"
    : isEditing
      ? "edit"
      : selected
        ? "view"
        : "closed";

  return {
    mode,
    open: isAdding || !!selected,
    selected,
    isPending,
    formError,
    setFormError,
    openView,
    openAdd,
    startEdit,
    close,
    submit,
    confirm,
    confirmDelete,
    ConfirmDialogUI,
  };
}

const SPLIT_QUERY = "(min-width: 1280px)";

export type SystemInfo = {
  createdAt?: string | null;
  createdBy?: React.ReactNode;
  updatedAt?: string | null;
  updatedBy?: React.ReactNode;
  // Anything the record wants on top of the audit trail. These sit directly
  // under the ID, above Created, so the shared rows stay in a fixed order.
  rows?: { label: string; value: React.ReactNode }[];
};

function formatSystemDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SystemInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-admin-line px-4 py-2 last:border-0 sm:px-5">
      <span className="shrink-0 pt-0.5 text-[12px] font-semibold text-admin-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold text-admin-ink">{value || "-"}</span>
    </div>
  );
}

function SystemInfoPopover({
  recordId,
  info,
}: {
  recordId?: number | string;
  info: SystemInfo;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="System information"
          title="Creation and modification details"
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-admin-line bg-admin-surface px-2.5 text-admin-ink transition-colors hover:bg-admin-line sm:px-3"
        >
          <Info className="h-4.5 w-4.5 shrink-0" />
          <span className="hidden text-[13px] font-semibold sm:inline">System</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card p-0"
      >
        <span className="block border-b border-admin-line bg-admin-line px-4 py-2.5 text-[12px] font-semibold text-admin-primary">
          System information
        </span>
        {recordId != null && (
          <SystemInfoRow label="ID" value={<span className="tabular-nums">#{recordId}</span>} />
        )}
        {(info.rows ?? []).map((row) => (
          <SystemInfoRow key={row.label} label={row.label} value={row.value} />
        ))}
        <SystemInfoRow label="Created" value={formatSystemDate(info.createdAt)} />
        <SystemInfoRow label="Created by" value={info.createdBy} />
        <SystemInfoRow label="Last modified" value={formatSystemDate(info.updatedAt)} />
        <SystemInfoRow label="Modified by" value={info.updatedBy} />
      </PopoverContent>
    </Popover>
  );
}

export function RecordSheet({
  open,
  onClose,
  mode,
  title,
  recordId,
  formId,
  isPending,
  saveDisabled,
  onEdit,
  onDelete,
  onCancel,
  confirmUI,
  systemInfo,
  status,
  layout = "sheet",
  emptyState,
  children,
}: {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  title: string;
  recordId?: number | string;
  formId: string;
  isPending: boolean;
  saveDisabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  confirmUI?: React.ReactNode;
  // Audit trail behind an "i" in the header. Hidden while adding, since a
  // record that does not exist yet has nothing to report.
  systemInfo?: SystemInfo;
  // Status pills, shown under the title so the state of the record reads the
  // same whether you are looking at it or editing it. Hidden while adding.
  status?: React.ReactNode;
  // "split" keeps the bottom sheet on phones and tablets but shows the record
  // beside the list from 1280px up.
  layout?: "sheet" | "split";
  emptyState?: React.ReactNode;
  children: React.ReactNode;
}) {
  const showForm = mode === "add" || mode === "edit";
  const isWide = useMediaQuery(SPLIT_QUERY);
  const split = layout === "split" && isWide;
  const TitleTag: React.ElementType = split ? "h2" : SheetTitle;

  const panel = (
    <>
      <div className="sticky top-0 z-30 shrink-0 border-b border-admin-line bg-admin-card/80 px-4 py-3 backdrop-blur-md sm:rounded-t-4xl">
        <div className="flex items-center justify-between gap-3">
          <TitleTag className="flex min-w-0 items-baseline gap-2 text-xl leading-tight font-bold tracking-tight text-admin-ink">
            <span className="truncate">{title}</span>
            {recordId != null && (
              <span className="shrink-0 text-[13px] font-semibold text-admin-muted italic tabular-nums">
                (#ID: {recordId})
              </span>
            )}
          </TitleTag>
          {systemInfo && mode !== "add" && (
            <SystemInfoPopover recordId={recordId} info={systemInfo} />
          )}
        </div>
        {status && mode !== "add" && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">{status}</div>
        )}
      </div>

      <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">
        {children}
        <div className="h-4" />
      </div>

      <div className="z-40 shrink-0 border-t-2 border-admin-primary/15 bg-admin-line px-6 py-5 pb-10 sm:rounded-b-4xl sm:pb-5">
        {/* The two footers are keyed apart so React tears one down and builds the
            other. Reconciled in place, the button under the pointer would turn
            into Save mid-click and the browser would submit the form it now
            points at. */}
        {mode === "view" ? (
          <div key="view-actions" className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={isPending}
              className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-[13px] font-semibold text-admin-error hover:border-admin-error/30 hover:bg-admin-error-bg"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onEdit}
              className="h-14 rounded-2xl border border-admin-primary bg-admin-card px-4 text-[13px] font-semibold tracking-wide text-admin-primary hover:bg-admin-primary-soft hover:text-admin-primary active:scale-95"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : (
          showForm && (
            <div key="form-actions" className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
                // The footer is admin-line, so an admin-line border on it is
                // invisible. Needs its own edge and a lift off the background.
                className="h-14 rounded-2xl border-2 border-admin-muted/35 bg-admin-card text-[13px] font-semibold text-admin-ink shadow-sm hover:border-admin-muted/60 hover:bg-admin-surface"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form={formId}
                disabled={isPending || saveDisabled}
                className="h-14 rounded-2xl bg-admin-primary text-[13px] font-semibold text-white shadow-lg hover:bg-admin-primary-hover active:scale-95"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          )
        )}
      </div>
    </>
  );

  if (split) {
    return (
      <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-4xl border-2 border-admin-line bg-admin-surface shadow-xl">
        {open ? (
          panel
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            {emptyState ?? (
              <>
                <p className="text-sm font-semibold text-admin-ink">Nothing selected</p>
                <p className="mt-1 text-[11px] text-admin-muted">
                  Pick a record from the list to see its details here.
                </p>
              </>
            )}
          </div>
        )}
        {confirmUI}
      </aside>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex h-[92vh] flex-col rounded-t-[2.5rem] border-t-2 border-admin-line
          bg-admin-surface p-0 shadow-2xl outline-none
          sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:h-auto
          sm:max-h-[92vh] sm:w-180 sm:max-w-[calc(100vw-3rem)] sm:-translate-x-1/2
          sm:rounded-4xl sm:border-2 sm:border-admin-line"
      >
        {panel}
        {confirmUI}
      </SheetContent>
    </Sheet>
  );
}

export function DetailCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DetailCell({
  label,
  value,
  icon,
  valueClassName,
  multiline,
  dense,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  valueClassName?: string;
  multiline?: boolean;
  // For cards that are a run of short facts, where full-height rows push the
  // rest of the record off the screen.
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 border-b border-admin-line px-4 last:border-0 sm:gap-3 sm:px-5",
        dense ? "py-1.5 sm:py-2" : "py-2.5 sm:py-4",
        multiline ? "items-start" : "items-center",
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5 text-admin-muted opacity-70 sm:gap-2">
        {icon}
        <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "flex-1 text-right text-sm leading-snug font-semibold break-words text-admin-ink",
          multiline && "text-left whitespace-pre-line",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function FormRow({
  label,
  required,
  align = "center",
  children,
}: {
  label: string;
  required?: boolean;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4",
        align === "start" ? "items-start" : "items-center",
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5 text-admin-muted opacity-70 sm:gap-2">
        <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap">
          {label}
        </span>
        {required && (
          <span className="text-[11px] font-semibold text-admin-error">*</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-admin-error/30 bg-admin-error-bg p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-admin-error" />
      <p className="text-sm leading-snug font-semibold text-admin-error">
        {message}
      </p>
    </div>
  );
}
