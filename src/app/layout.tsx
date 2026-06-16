import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bookingsdonfenticas.co.uk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Don Fenticas | Bar & Live Music Venue",
    template: "%s | Don Fenticas",
  },
  description:
    "Don Fenticas, Regent Street, Hinckley — quiz nights, live music, karaoke, and unforgettable nights out.",
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
  themeColor: "#26300D",
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
    <html lang="en" suppressHydrationWarning>
      <body 
        suppressHydrationWarning
        className="antialiased min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}
