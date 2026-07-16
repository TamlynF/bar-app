"use client";

import { Printer, Download } from "lucide-react";

export default function PrintButton() {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-wide text-stone-400 uppercase transition-colors hover:bg-white/10 hover:text-white active:scale-95 sm:text-xs"
      >
        <Printer className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Print</span>
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        title="Save as PDF (choose 'Save as PDF' in print dialog)"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-wide text-stone-400 uppercase transition-colors hover:bg-white/10 hover:text-white active:scale-95 sm:text-xs"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Save PDF</span>
      </button>
    </div>
  );
}
