import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Config is a phase-aware function so we can reliably detect the dev server.
// (process.env.NODE_ENV isn't guaranteed to be set when this file is evaluated.)
const config = (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  // Kept for parity with the dev-server detection above; no dev-only config
  // is currently applied. (LocatorJS click-to-source was removed: @locator
  // 0.5.1 embeds the file's Windows path unescaped and re-parses it, so every
  // file under C:\… throws "Bad character escape sequence" and the loader
  // silently falls back to untransformed source — i.e. it never worked here.)
  void isDev;

  const nextConfig: NextConfig = {
    reactCompiler: true,
    experimental: {
      serverActions: {
        bodySizeLimit: '10mb',
      },
    },
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "*.supabase.co",
        },
        {
          // Spotify album art (Web API `album.images[].url`)
          protocol: "https",
          hostname: "i.scdn.co",
        },
      ],
    },
    allowedDevOrigins: [
      "192.168.0.*",
      "172.21.240.1",
    ],
  };

  return nextConfig;
};

export default config;
