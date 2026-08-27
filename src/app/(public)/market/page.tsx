import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { SectionHeading } from "@/components/editorial/section-heading";
import MarketFeed from "./market-feed";

export const metadata = {
  title: "Market Night | Don Fenticas",
  description:
    "The drinks menu turns into a live stock market - prices rise and fall all night with what people are drinking.",
};

export default function MarketPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#1a2008] text-white antialiased selection:bg-[#FDCC4B] selection:text-[#1a2008]">
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow-x: hidden; }`,
        }}
      />

      <PublicNav currentPath="/market" />

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <SectionHeading eyebrow="Live from the bar" title="Market Night" />
        <p className="-mt-2 mb-8 text-sm leading-relaxed font-medium text-stone-400">
          Every drink trades like a stock. Buy pressure sends it up, quiet spells drag it
          down - the price on the board is the price at the bar.
        </p>
        <MarketFeed />
        <div className="mt-10 flex justify-center">
          <Link
            href="/market/board"
            className="inline-flex min-h-11 items-center gap-2 font-black text-[10px] tracking-widest text-stone-400 uppercase transition-colors hover:text-white"
          >
            <MonitorPlay className="h-4 w-4" aria-hidden="true" />
            Big screen view
          </Link>
        </div>
      </div>
    </main>
  );
}
