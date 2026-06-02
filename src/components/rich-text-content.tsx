"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  html: string | null;
  variant: "public" | "admin";
  className?: string;
};

export function RichTextContent({ html, variant, className }: Props) {
  const [clean, setClean] = useState<string>("");

  useEffect(() => {
    if (!html) {
      setClean("");
      return;
    }
    // Dynamically import DOMPurify so it only runs client-side
    import("dompurify").then(({ default: DOMPurify }) => {
      setClean(DOMPurify.sanitize(html));
    });
  }, [html]);

  if (!clean) return null;

  return (
    <div
      className={cn(
        "rich-content",
        variant === "public" && "rich-content--public",
        variant === "admin" && "rich-content--admin",
        className
      )}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
