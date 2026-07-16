"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 font-black text-[10px] tracking-widest text-[#5F624F] uppercase transition-colors hover:text-[#1F1F1A]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
