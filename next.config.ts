import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const config = (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  const nextConfig: NextConfig = {
    ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
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
        ...(isDev
          ? ([
              {
                protocol: "http" as const,
                hostname: "127.0.0.1",
                port: "54321",
              },
            ])
          : []),
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
