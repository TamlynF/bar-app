"use client";

import React, { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
   * Whether a click outside or Escape dismisses the dialog as "cancel". Defaults to
   * true, which is right when cancelling is the safe way out ("Delete?" → Cancel).
   * Set false when the cancel action is itself destructive (e.g. "Discard"), so a
   * stray click or keypress can't lose work — only the buttons then answer.
   */
  dismissible?: boolean;
}

/**
 * Promise-based confirm dialog.
 *
 * Built on the Radix Dialog rather than a hand-rolled `createPortal`, deliberately:
 * these dialogs are opened from inside a Sheet, which is itself a modal Radix
 * dialog with a focus trap. A portal Radix doesn't know about sits *outside* that
 * trap, so its FocusScope pulls focus straight back out — buttons still click, but
 * any input inside is impossible to type in. As a Radix layer, this one joins the
 * stack and takes focus properly.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined);

  const settle = useCallback((value: boolean) => {
    setOpen(false);
    const resolve = resolveRef.current;
    resolveRef.current = undefined;
    resolve?.(value);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    // Opening a second dialog while one is in flight would overwrite resolveRef and
    // strand the first promise forever, hanging whatever is awaiting it. Settle the
    // old one as cancelled first.
    resolveRef.current?.(false);
    resolveRef.current = undefined;
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const isDestructive = options.variant === "destructive";
  const locked = options.dismissible === false;

  const ConfirmDialogUI = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
    >
      <DialogContent
        showCloseButton={false}
        // When cancelling is destructive, only the buttons may answer.
        onInteractOutside={(e) => {
          if (locked) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (locked) e.preventDefault();
        }}
        className="max-w-96 gap-0 overflow-hidden rounded-3xl border-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 shadow-2xl"
      >
        <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4">
          <DialogTitle className="font-black text-base tracking-tight text-[#1F1F1A] uppercase">
            {options.title}
          </DialogTitle>
          {options.description ? (
            <DialogDescription className="text-xs leading-relaxed font-medium text-[#5F624F]">
              {options.description}
            </DialogDescription>
          ) : (
            // Radix wants every dialog described; fall back to the title.
            <DialogDescription className="sr-only">{options.title}</DialogDescription>
          )}
        </div>
        {options.content && <div className="max-h-[45vh] overflow-y-auto px-6 pb-2">{options.content}</div>}
        <div className="flex flex-row gap-2 px-6 pt-2 pb-6">
          {!options.hideCancel && (
            <button
              type="button"
              onClick={() => settle(false)}
              className="h-11 flex-1 rounded-xl border-2 border-[#E6DFC8] bg-white font-black text-[10px] tracking-widest text-[#5F624F] uppercase transition-colors hover:bg-[#F7F4EA]"
            >
              {options.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            type="button"
            onClick={() => settle(true)}
            className={
              isDestructive
                ? "h-11 flex-1 rounded-xl bg-red-600 font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-red-700"
                : "h-11 flex-1 rounded-xl bg-[#5C4033] font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#5C4033]/90"
            }
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { confirm, ConfirmDialogUI };
}
