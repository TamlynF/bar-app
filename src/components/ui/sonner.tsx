"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      offset={{ top: "calc(env(safe-area-inset-top) + 24px)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-2xl border-2 font-bold",
        },
      }}
      {...props}
    />
  );
}
