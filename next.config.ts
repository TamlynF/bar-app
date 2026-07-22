import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const config = (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

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
