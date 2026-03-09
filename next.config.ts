import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "http://192.168.0.82",
    "http://192.168.0.82:3000",
    "http://localhost:3000",
  ],
};

export default nextConfig;
