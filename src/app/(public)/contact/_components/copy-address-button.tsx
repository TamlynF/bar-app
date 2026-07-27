"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the address");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Address copied" : "Copy address"}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FDCC4B]",
        copied
          ? "border-[#FDCC4B]/40 bg-[#FDCC4B]/10 text-[#FDCC4B]"
          : "border-white/10 bg-white/5 text-stone-400 hover:border-[#FDCC4B]/40 hover:bg-[#FDCC4B]/10 hover:text-[#FDCC4B]"
      )}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
