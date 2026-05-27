"use client";

import { Printer, Download } from "lucide-react";

export default function PrintButton() {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-stone-400 text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors active:scale-95"
      >
        <Printer className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Print</span>
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        title="Save as PDF (choose 'Save as PDF' in print dialog)"
        className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-stone-400 text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Save PDF</span>
      </button>
    </div>
  );
}
