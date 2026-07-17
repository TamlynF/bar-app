"use client";

import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./confirm-dialog.module.css";

interface ConfirmOptions {
  title: string;
  description?: string;
  /** Optional rich content rendered below the description (e.g. an email preview). */
  content?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  /** Hide the cancel button, turning the dialog into a single-action acknowledgement (e.g. a validation alert). */
  hideCancel?: boolean;
  /**
   * Whether clicking the backdrop cancels. Defaults to true, which is right when
   * cancelling is the safe way out ("Delete?" → Cancel). Set false when the cancel
   * action itself is destructive (e.g. "Discard"), so a stray click can't lose work
   * — the dialog then only resolves via its buttons.
   */
  dismissOnBackdrop?: boolean;
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    // Opening a second dialog while one is in flight would overwrite resolveRef and
    // strand the first promise forever — and any `await confirm(...)` sitting inside
    // a startTransition would then never finish, leaving isPending stuck true and
    // every button gated on it permanently dead. Settle the old one as cancelled.
    resolveRef.current?.(false);
    resolveRef.current = undefined;
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setOpen(false);
    resolveRef.current?.(false);
  };

  const isDestructive = options.variant === "destructive";

  // Portal to <body> so the dialog escapes any in-tree stacking context and
  // paints above modal surfaces like a Radix Sheet (which is itself portalled).
  const ConfirmDialogUI = open && typeof document !== "undefined" ? createPortal(
    <>
      {/* Backdrop. Still blocks the surface underneath when it doesn't dismiss. */}
      <div
        className={styles.backdrop}
        onClick={options.dismissOnBackdrop === false ? undefined : handleCancel}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {/* Dialog box */}
      <div
        className={`${styles.dialog} overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-[#F7F4EA] shadow-2xl`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4">
          <h2 className="font-black text-base tracking-tight text-[#1F1F1A] uppercase">
            {options.title}
          </h2>
          {options.description && (
            <p className="text-xs leading-relaxed font-medium text-[#5F624F]">
              {options.description}
            </p>
          )}
        </div>
        {options.content && (
          <div className="max-h-[45vh] overflow-y-auto px-6 pb-2">{options.content}</div>
        )}
        <div className="flex flex-row gap-2 px-6 pb-6">
          {!options.hideCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="h-11 flex-1 rounded-xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-widest text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA]"
            >
              {options.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={
              isDestructive
                ? "h-11 flex-1 rounded-xl bg-red-600 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-red-700"
                : "h-11 flex-1 rounded-xl bg-[#5C4033] font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#5C4033]/90"
            }
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return { confirm, ConfirmDialogUI };
}
