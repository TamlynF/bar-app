"use client";

import React, { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  content?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  hideCancel?: boolean;
  dismissible?: boolean;
}

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
        onInteractOutside={(e) => {
          if (locked) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (locked) e.preventDefault();
        }}
        className="max-w-96 gap-0 overflow-hidden rounded-3xl border-2 border-[#D8D5C8] bg-[#F4F1E8] p-0 shadow-2xl"
      >
        <div className="flex flex-col gap-1.5 px-6 pt-6 pb-4">
          <DialogTitle className="font-black text-base tracking-tight text-[#20231A] uppercase">
            {options.title}
          </DialogTitle>
          {options.description ? (
            <DialogDescription className="text-xs leading-relaxed font-medium text-[#5E6654]">
              {options.description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{options.title}</DialogDescription>
          )}
        </div>
        {options.content && <div className="max-h-[45vh] overflow-y-auto px-6 pb-2">{options.content}</div>}
        <div className="flex flex-row gap-2 px-6 pt-2 pb-6">
          {!options.hideCancel && (
            <button
              type="button"
              onClick={() => settle(false)}
              className="h-11 flex-1 rounded-xl border-2 border-[#D8D5C8] bg-white font-black text-[10px] tracking-widest text-[#5E6654] uppercase transition-colors hover:bg-[#F4F1E8]"
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
                : "h-11 flex-1 rounded-xl bg-[#34451F] font-black text-[10px] tracking-widest text-white uppercase transition-colors hover:bg-[#34451F]/90"
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
