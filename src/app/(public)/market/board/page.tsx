import { Bebas_Neue, IBM_Plex_Mono } from "next/font/google";
import QRCode from "qrcode";
import MarketBoard, { type BoardView } from "./market-board";

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-board-display",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-board-mono",
  display: "swap",
});

export const metadata = {
  title: "Drinks Exchange",
  description: "Live drinks market board - prices rise and fall all night.",
  robots: { index: false },
};

function resolveView(view: string | string[] | undefined): BoardView {
  if (view === "table") return "table";
  if (view === "movers") return "movers";
  return "categories";
}

export default async function MarketBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  const initialView = resolveView(view);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bookingsdonfenticas.co.uk";
  const qrDataUrl = await QRCode.toDataURL(`${siteUrl}/market`, {
    width: 384,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1a2008", light: "#ffffff" },
  }).catch(() => null);
  return (
    <main
      className={`${bebas.variable} ${plexMono.variable} h-dvh w-full overflow-hidden bg-[#1a2008] text-[#f3f0dc] antialiased`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `html, body { background-color: #1a2008 !important; margin: 0; padding: 0; overflow: hidden; }`,
        }}
      />
      <MarketBoard initialView={initialView} qrDataUrl={qrDataUrl} />
    </main>
  );
}
