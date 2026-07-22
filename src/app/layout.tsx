import type { Metadata, Viewport } from "next";
import { Anton, Archivo, Archivo_Black } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-ui",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-black",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bookingsdonfenticas.co.uk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Don Fenticas | Bar & Live Music Venue",
    template: "%s | Don Fenticas",
  },
  description:
    "Don Fenticas, Regent Street, Hinckley — quiz nights, live music, karaoke, and unforgettable nights out.",
  icons: {
    icon: "/df-mark.jpg",
    shortcut: "/df-mark.jpg",
    apple: "/df-mark.jpg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Don Fenticas",
  },
  openGraph: {
    title: "Don Fenticas | Bar & Live Music Venue",
    description:
      "Regent Street, Hinckley — quiz nights, live music, karaoke, and unforgettable nights out.",
    siteName: "Don Fenticas",
    url: siteUrl,
    locale: "en_GB",
    type: "website",
    images: [
      {
        url: "/logo.jpeg",
        width: 1080,
        height: 1080,
        alt: "Don Fenticas logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Don Fenticas | Bar & Live Music Venue",
    description:
      "Regent Street, Hinckley — quiz nights, live music, karaoke, and unforgettable nights out.",
    images: ["/logo.jpeg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#14180a", // After Dark: deepened from #26300D
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-surface="dark"
      className={`${anton.variable} ${archivo.variable} ${archivoBlack.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="min-h-screen font-ui antialiased"
      >
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
