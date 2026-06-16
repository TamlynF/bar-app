import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Config is a phase-aware function so we can reliably detect the dev server.
// (process.env.NODE_ENV isn't guaranteed to be set when this file is evaluated.)
export default (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

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
      ],
    },
    allowedDevOrigins: [
      "192.168.0.*",
      "172.21.240.1",
    ],
    // LocatorJS: inject data-locatorjs-id attributes for click-to-source.
    // Dev-only so it never runs during `next build` (no attributes in prod
    // HTML, no build cost). Runs as a source transform before SWC, so the
    // React Compiler / SWC pipeline is untouched.
    ...(isDev && {
      turbopack: {
        rules: {
          "**/*.{tsx,jsx}": {
            loaders: [
              {
                loader: "@locator/webpack-loader",
                options: { env: "development" },
              },
            ],
          },
        },
      },
    }),
  };

  return nextConfig;
};
