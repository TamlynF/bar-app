"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [mounted, setMounted] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined);

  useEffect(() => { setMounted(true); }, []);

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

  const ConfirmDialogUI =
    mounted && open
      ? createPortal(
          <>
            {/* Backdrop */}
            <div
              style={{ position: "fixed", inset: 0, zIndex: 10000, backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={handleCancel}
            />
            {/* Dialog box */}
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10001,
                width: "calc(100% - 2rem)",
                maxWidth: "384px",
              }}
              className="rounded-3xl border-2 border-[#E6DFC8] bg-[#F7F4EA] overflow-hidden shadow-2xl"
            >
              <div className="px-6 pt-6 pb-4 flex flex-col gap-1.5">
                <h2 className="text-base font-black uppercase tracking-tight text-[#1F1F1A]">
                  {options.title}
                </h2>
                {options.description && (
                  <p className="text-[12px] text-[#5F624F] font-medium leading-relaxed">
                    {options.description}
                  </p>
                )}
              </div>
              <div className="px-6 pb-6 flex flex-row gap-2">
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
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return { confirm, ConfirmDialogUI };
}
