"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
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

  const ConfirmDialogUI = (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm rounded-3xl border-2 border-[#E6DFC8] bg-[#F7F4EA] p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 gap-1.5">
          <DialogTitle className="text-base font-black uppercase tracking-tight text-[#1F1F1A]">
            {options.title}
          </DialogTitle>
          {options.description && (
            <DialogDescription className="text-[12px] text-[#5F624F] font-medium leading-relaxed">
              {options.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="px-6 pb-6 flex-row gap-2 sm:flex-row">
          <button
            onClick={handleCancel}
            className="flex-1 h-11 rounded-xl border-2 border-[#E6DFC8] bg-white text-[10px] font-black uppercase tracking-widest text-[#5F624F] hover:bg-[#F7F4EA] transition-colors"
          >
            {options.cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={handleConfirm}
            className={
              isDestructive
                ? "flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-colors"
                : "flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#FDCC4B] bg-[#26300D] hover:bg-[#26300D]/90 transition-colors"
            }
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, ConfirmDialogUI };
}
