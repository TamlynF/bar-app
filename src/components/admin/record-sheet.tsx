"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SheetDragHandle } from "@/components/admin/sheet-drag-handle";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Pencil,
  Trash2,
  AlertCircle,
  Info,
  MoreHorizontal,
  X,
} from "lucide-react";

export type SheetMode = "closed" | "add" | "view" | "edit";

function serializeForm(form: HTMLFormElement): string {
  const parts: string[] = [];
  for (const [key, value] of new FormData(form)) {
    parts.push(`${key}=${value instanceof File ? `${value.name}:${value.size}` : value}`);
  }
  return parts.sort().join("\n");
}

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
      content?: React.ReactNode;
      confirmLabel?: string;
      action: () => Promise<ActionResult>;
    }) => {
      const ok = await confirm({
        title: opts.title,
        description: opts.description,
        content: opts.content,
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

  /* Stepping to the neighbouring record. Pass the rows as the page actually
     shows them - filtered and sorted - so the arrows follow the list behind the
     sheet rather than some order nobody can see. A record filtered out from
     under the open sheet has no place in the row, so both arrows go quiet
     rather than jumping somewhere arbitrary. */
  const navigateAcross = (row: T[] | undefined = records): RecordSheetNavigate | undefined => {
    if (!row || !getId || isAdding || !selected) return undefined;
    const at = row.findIndex((record) => getId(record) === getId(selected));
    if (at === -1) return undefined;
    return {
      onPrev: at > 0 ? () => openView(row[at - 1]) : undefined,
      onNext: at < row.length - 1 ? () => openView(row[at + 1]) : undefined,
      position: { index: at + 1, total: row.length },
    };
  };

  return {
    mode,
    open: isAdding || !!selected,
    selected,
    navigateAcross,
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

export type RecordSheetNavigate = {
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
};

export type RecordSheetAction = {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  // Instead of firing onSelect, opens this in a panel hanging off the menu
  // button. The callback closes the panel again once the panel is done.
  panel?: (close: () => void) => React.ReactNode;
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

function SystemInfoPanel({
  recordId,
  info,
}: {
  recordId?: number | string;
  info: SystemInfo;
}) {
  return (
    <>
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
    </>
  );
}

const HEADER_BUTTON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none";

const EDGE_BUTTON =
  "absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-admin-line bg-admin-card text-admin-ink shadow-xl transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none sm:flex";

const FOOTER_BUTTON =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-admin-line bg-admin-card text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink focus-visible:ring-2 focus-visible:ring-admin-gold focus-visible:outline-none active:scale-95 sm:hidden";

const SWIPE_DISTANCE = 64;

/* A sideways drag that starts on something with its own horizontal scroll, or
   on a control the finger is meant to be operating, belongs to that thing. */
function ownsHorizontalDrag(target: EventTarget | null, container: HTMLElement) {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== container) {
    if (node.matches("input, textarea, select, [data-no-swipe]")) return true;
    if (
      node.scrollWidth > node.clientWidth + 1 &&
      /auto|scroll/.test(getComputedStyle(node).overflowX)
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

const MENU_ITEM =
  "min-h-11 gap-2.5 rounded-xl px-3 text-[13px] font-semibold text-admin-ink focus:bg-admin-surface focus:text-admin-ink sm:min-h-9 [&_svg:not([class*='text-'])]:text-admin-muted";

const DESTRUCTIVE_ITEM =
  "data-[variant=destructive]:text-admin-error data-[variant=destructive]:focus:bg-admin-error-bg data-[variant=destructive]:focus:text-admin-error";

type OpenPanel = { kind: "system" } | { kind: "action"; index: number } | null;

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
  actions,
  navigate,
  openHref,
  layout = "sheet",
  emptyState,
  children,
}: {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  title: string;
  // Shown at the top of the System information panel, not in the header.
  recordId?: number | string;
  formId: string;
  isPending: boolean;
  saveDisabled?: boolean;
  // Left off for a record that can only be read, which drops the footer.
  onEdit?: () => void;
  // Lands in the header menu, not the footer, so the footer stays one button.
  onDelete?: () => void;
  onCancel?: () => void;
  /* A record with a page of its own: the view footer leads with a link to it
     and Edit becomes the secondary button. */
  openHref?: { href: string; label: string };
  confirmUI?: React.ReactNode;
  // Audit trail behind "System info" in the header menu. Hidden while adding,
  // since a record that does not exist yet has nothing to report.
  systemInfo?: SystemInfo;
  // Status pills, shown as the first line of the body so the state of the
  // record reads the same whether you are looking at it or editing it. Hidden
  // while adding.
  status?: React.ReactNode;
  // Record-level controls in the header menu - things you toggle rather than
  // fill in, so they read the same in view and edit.
  actions?: RecordSheetAction[];
  // Step to the record either side of this one, from the header arrows or by
  // swiping the body sideways. Left off for a sheet that is not backed by a
  // list, which hides the arrows.
  navigate?: RecordSheetNavigate;
  // "split" keeps the bottom sheet on phones and tablets but shows the record
  // beside the list from 1280px up.
  layout?: "sheet" | "split";
  emptyState?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isWide = useMediaQuery(SPLIT_QUERY);
  const split = layout === "split" && isWide;
  const TitleTag: React.ElementType = split ? "h2" : SheetTitle;
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  // The menu hands focus back to its button as it closes, which the panel
  // would read as a click outside itself and shut straight away.
  const panelPending = useRef(false);

  /* Closing a form only asks about discarding when something has actually
     changed: a user edit fires input/change on the form, and as a backstop
     the form's values are compared with a snapshot taken when it mounted
     (controls that set values without events still get caught). */
  const dirtyRef = useRef(false);
  const snapshotRef = useRef<string | null>(null);
  useEffect(() => {
    dirtyRef.current = false;
    snapshotRef.current = null;
    if (!open || mode === "view" || mode === "closed") return;
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    snapshotRef.current = serializeForm(form);
    const mark = () => {
      dirtyRef.current = true;
    };
    form.addEventListener("input", mark);
    form.addEventListener("change", mark);
    return () => {
      form.removeEventListener("input", mark);
      form.removeEventListener("change", mark);
    };
  }, [open, mode, formId]);

  const hasChanges = () => {
    if (dirtyRef.current) return true;
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement) || snapshotRef.current == null) return false;
    return serializeForm(form) !== snapshotRef.current;
  };

  /* Every way out of a half-finished edit goes through here: closing it,
     and stepping to the record either side. */
  const confirmDiscard = async (description: string, confirmLabel: string) => {
    if (mode === "view" || mode === "closed") return true;
    if (!hasChanges()) return true;
    return confirm({
      title: "Discard changes?",
      description,
      confirmLabel,
      variant: "destructive",
    });
  };

  const dismiss = async () => {
    if (mode === "view") {
      onClose();
      return;
    }
    const ok = await confirmDiscard(
      mode === "add"
        ? "This record hasn't been saved yet and will be lost."
        : "Anything you've changed on this record will be lost.",
      "Discard",
    );
    if (!ok) return;
    (onCancel ?? onClose)();
  };

  const step = async (direction: "prev" | "next") => {
    const go = direction === "prev" ? navigate?.onPrev : navigate?.onNext;
    if (!go) return;
    const ok = await confirmDiscard(
      `Anything you've changed on this record will be lost when you move to the ${direction === "prev" ? "previous" : "next"} one.`,
      "Discard and continue",
    );
    if (!ok) return;
    go();
  };

  const canStep = !!(navigate?.onPrev || navigate?.onNext);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const swipeFrom = useRef<{ x: number; y: number; axis: "none" | "x" | "y" } | null>(null);

  /* The record tracks the finger while the drag is in progress. Written
     straight to the node rather than through state: this runs on every touch
     frame, and re-rendering the whole record that often drops frames. */
  const slide = (dx: number, settle: boolean) => {
    const body = bodyRef.current;
    if (!body) return;
    body.style.transition = settle ? "transform 200ms ease-out, opacity 200ms ease-out" : "none";
    body.style.transform = dx === 0 ? "" : `translateX(${dx}px)`;
    body.style.opacity = dx === 0 ? "" : String(Math.max(0.4, 1 - Math.abs(dx) / 360));
  };

  // Pulling towards a record that isn't there drags heavy, so the end of the
  // list is felt rather than read.
  const withResistance = (dx: number) => {
    const target = dx > 0 ? navigate?.onPrev : navigate?.onNext;
    return target ? dx : dx * 0.25;
  };

  const onSwipeStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    swipeFrom.current =
      touch && !ownsHorizontalDrag(event.target, event.currentTarget)
        ? { x: touch.clientX, y: touch.clientY, axis: "none" }
        : null;
  };

  const onSwipeMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const from = swipeFrom.current;
    const touch = event.touches[0];
    if (!from || !touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    /* Which way the drag is going is settled once, a few pixels in, and held
       for the rest of it - otherwise a diagonal drag flickers between
       scrolling the body and dragging the record. */
    if (from.axis === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      from.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (from.axis === "x") slide(withResistance(dx), false);
  };

  const onSwipeEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const from = swipeFrom.current;
    const touch = event.changedTouches[0];
    swipeFrom.current = null;
    if (!from || from.axis !== "x") return;
    slide(0, true);
    if (!touch) return;
    const dx = touch.clientX - from.x;
    if (Math.abs(dx) < SWIPE_DISTANCE) return;
    void step(dx > 0 ? "prev" : "next");
  };

  const showPanel = (panel: OpenPanel) => {
    panelPending.current = true;
    setOpenPanel(panel);
  };
  const closePanel = () => setOpenPanel(null);

  const menuActions = actions ?? [];
  const showSystem = !!systemInfo && mode !== "add";
  const showDelete = mode === "view" && !!onDelete;
  const hasMenu = menuActions.length > 0 || showSystem || showDelete;
  const hasFooter = mode !== "view" || !!onEdit;

  const panelContent =
    openPanel?.kind === "system" && systemInfo ? (
      <SystemInfoPanel recordId={recordId} info={systemInfo} />
    ) : openPanel?.kind === "action" ? (
      menuActions[openPanel.index]?.panel?.(closePanel)
    ) : null;

  const stepLabel = (direction: "prev" | "next") => {
    const word = direction === "prev" ? "Previous" : "Next";
    return navigate?.position
      ? `${word} record (${navigate.position.index} of ${navigate.position.total})`
      : `${word} record`;
  };

  const arrow = (direction: "prev" | "next", className: string) => (
    <button
      type="button"
      onClick={() => void step(direction)}
      disabled={direction === "prev" ? !navigate?.onPrev : !navigate?.onNext}
      aria-label={`${direction === "prev" ? "Previous" : "Next"} record`}
      title={stepLabel(direction)}
      className={cn(className, "disabled:pointer-events-none disabled:opacity-30")}
    >
      {direction === "prev" ? (
        <ChevronLeft className="h-5 w-5 shrink-0" />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0" />
      )}
    </button>
  );

  const headerArrows = (
    <>
      {arrow("prev", HEADER_BUTTON)}
      {arrow("next", HEADER_BUTTON)}
    </>
  );

  /* On a screen with room either side of the sheet the arrows hang off its
     edges, clear of the record itself. They are children of the sheet so a
     click on one is not read as a click outside it. */
  const edgeArrows = (
    <>
      {arrow("prev", cn(EDGE_BUTTON, "-left-16"))}
      {arrow("next", cn(EDGE_BUTTON, "-right-16"))}
    </>
  );

  const panel = (
    <>
      <SheetDragHandle onClose={() => void dismiss()} className="bg-admin-card/80 backdrop-blur-md" />
      <div className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 border-b border-admin-line bg-admin-card/80 px-2 backdrop-blur-md sm:rounded-t-4xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label={mode === "view" ? "Close" : "Cancel"}
          title={mode === "view" ? "Close" : "Cancel"}
          className={HEADER_BUTTON}
        >
          <X className="h-5 w-5 shrink-0" />
        </button>
        <TitleTag className="min-w-0 flex-1 truncate px-1 text-base leading-tight font-bold tracking-tight text-admin-ink">
          {title}
        </TitleTag>
        {/* The record's state sits in the header beside its title, so it is
            read before the record and stays put while the body scrolls. */}
        {status && mode !== "add" && (
          <div className="flex shrink-0 items-center gap-1.5 pr-1">{status}</div>
        )}
        {canStep && split && <div className="flex shrink-0 items-center">{headerArrows}</div>}
        {hasMenu ? (
          <Popover open={openPanel !== null} onOpenChange={(next) => { if (!next) closePanel(); }}>
            <PopoverAnchor asChild>
              <div className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="More actions"
                      title="More actions"
                      className={HEADER_BUTTON}
                    >
                      <MoreHorizontal className="h-5 w-5 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 rounded-2xl border-2 border-admin-line bg-admin-card p-1.5 shadow-xl"
                    onCloseAutoFocus={(e) => {
                      if (panelPending.current) {
                        e.preventDefault();
                        panelPending.current = false;
                      }
                    }}
                  >
                    {menuActions.map((action, index) => (
                      <DropdownMenuItem
                        key={action.label}
                        disabled={action.disabled}
                        variant={action.destructive ? "destructive" : "default"}
                        onSelect={() => {
                          if (action.panel) showPanel({ kind: "action", index });
                          else action.onSelect?.();
                        }}
                        className={cn(MENU_ITEM, action.destructive && DESTRUCTIVE_ITEM)}
                      >
                        {action.icon}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                    {showSystem && (
                      <DropdownMenuItem
                        onSelect={() => showPanel({ kind: "system" })}
                        className={MENU_ITEM}
                      >
                        <Info className="h-4 w-4" />
                        System info
                      </DropdownMenuItem>
                    )}
                    {showDelete && (menuActions.length > 0 || showSystem) && (
                      <DropdownMenuSeparator className="my-1.5 bg-admin-line" />
                    )}
                    {showDelete && (
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isPending}
                        onSelect={onDelete}
                        className={cn(MENU_ITEM, DESTRUCTIVE_ITEM)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="end"
              className="w-80 overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card p-0"
            >
              {panelContent}
            </PopoverContent>
          </Popover>
        ) : (
          <div className="h-10 w-10 shrink-0" aria-hidden="true" />
        )}
      </div>

      <div
        className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6"
        ref={bodyRef}
        onTouchStart={canStep ? onSwipeStart : undefined}
        onTouchMove={canStep ? onSwipeMove : undefined}
        onTouchEnd={canStep ? onSwipeEnd : undefined}
        onTouchCancel={canStep ? onSwipeEnd : undefined}
      >
        {children}
        <div className="h-4" />
      </div>

      {(hasFooter || canStep) && (
        <div
          className={cn(
            "z-40 flex shrink-0 items-center gap-2 border-t-2 border-admin-primary/15 bg-admin-line px-4 py-3 pb-8 sm:rounded-b-4xl sm:pb-3",
            // With no action of its own the bar exists only to carry the phone
            // arrows, so it goes once they do.
            !hasFooter && "sm:hidden",
          )}
        >
          {/* A phone sheet is full width, so the arrows cannot hang off its
              edges the way they do on a larger screen. They sit either side of
              the action instead, where the thumb already is, rather than
              crowding the header and squeezing the title. */}
          {canStep && arrow("prev", FOOTER_BUTTON)}
          <div className="min-w-0 flex-1">
          {/* The two footers are keyed apart so React tears one down and builds the
              other. Reconciled in place, the button under the pointer would turn
              into Save mid-click and the browser would submit the form it now
              points at. */}
          {!hasFooter ? null : mode === "view" ? (
            <div key="view-actions" className="flex items-center gap-2">
              {/* A record with its own page gets that as the footer's main
                  action; Edit steps aside to a narrower outline button. */}
              {openHref && (
                <Link
                  href={openHref.href}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-admin-primary px-4 text-[13px] font-semibold tracking-wide text-white shadow-lg transition-colors hover:bg-admin-primary-hover active:scale-95"
                >
                  {openHref.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={onEdit}
                className={cn(
                  "h-12 rounded-2xl border border-admin-primary bg-admin-card px-4 text-[13px] font-semibold tracking-wide text-admin-primary hover:bg-admin-primary-soft hover:text-admin-primary active:scale-95",
                  openHref ? "shrink-0" : "w-full",
                )}
              >
                <Pencil className={cn("h-4 w-4", !openHref && "mr-2")} />
                {openHref ? <span className="sr-only sm:not-sr-only sm:ml-2">Edit</span> : "Edit"}
              </Button>
            </div>
          ) : (
            <Button
              key="form-actions"
              type="submit"
              form={formId}
              disabled={isPending || saveDisabled}
              className="h-12 w-full rounded-2xl bg-admin-primary text-[13px] font-semibold text-white shadow-lg hover:bg-admin-primary-hover active:scale-95"
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
          )}
          </div>
          {canStep && arrow("next", FOOTER_BUTTON)}
        </div>
      )}
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
        {ConfirmDialogUI}
      </aside>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) void dismiss(); }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex h-[92vh] flex-col rounded-t-[2.5rem] border-t-2 border-admin-line
          bg-admin-surface p-0 shadow-2xl outline-none
          sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:h-auto
          sm:max-h-[92vh] sm:w-180 sm:max-w-[calc(100vw-9rem)] sm:-translate-x-1/2
          sm:rounded-4xl sm:border-2 sm:border-admin-line"
      >
        {panel}
        {canStep && edgeArrows}
        {confirmUI}
        {ConfirmDialogUI}
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
  dense,
  children,
}: {
  label: string;
  required?: boolean;
  align?: "center" | "start";
  // The edit-mode twin of DetailCell's dense: same row height and rule, so a
  // card reads the same whether it is being viewed or edited.
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 px-4 sm:gap-3 sm:px-5",
        dense
          ? "border-b border-admin-line py-1.5 last:border-0 sm:py-2"
          : "py-2.5 sm:py-4",
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
