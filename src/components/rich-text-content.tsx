"use client";

import { cn } from "@/lib/utils";

type Props = {
  html: string | null;
  variant: "public" | "admin";
  className?: string;
};

export function RichTextContent({ html, variant, className }: Props) {
  if (!html) return null;

  return (
    <div
      className={cn(
        "rich-content",
        variant === "public" && "rich-content--public",
        variant === "admin" && "rich-content--admin",
        className
      )}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
