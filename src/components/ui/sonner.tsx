"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * App-wide toast host. Mounted once in the root layout so `toast()` calls from
 * either surface render. `richColors` gives success/error/warning their own
 * accents; `top-center` keeps toasts clear of the admin bottom nav on mobile.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
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
