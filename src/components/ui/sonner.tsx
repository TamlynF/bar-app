"use client";

import { usePathname } from "next/navigation";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const ADMIN_ROUTE_PREFIXES = [
  "/dashboard",
  "/event-bookings",
  "/event-setups",
  "/guests",
  "/marketing",
  "/requests",
  "/settings",
  "/stock-market",
];

function isAdminPath(pathname: string) {
  return ADMIN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const SURFACE_TOKENS = {
  light: {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
  },
  dark: {
    "--normal-bg": "var(--canvas-2)",
    "--normal-text": "var(--ink)",
    "--normal-border": "var(--hairline)",
  },
} as const;

export function Toaster(props: ToasterProps) {
  const pathname = usePathname();
  const theme: ToasterProps["theme"] = isAdminPath(pathname ?? "") ? "light" : "dark";

  return (
    <Sonner
      theme={theme}
      className="group"
      style={SURFACE_TOKENS[theme] as React.CSSProperties}
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
