import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.resolve(__dirname, ".env.test") });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],

  webServer: {
    command: `next dev -p ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL!,
      RESEND_API_KEY: process.env.RESEND_API_KEY!,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL!,
      EMAIL_FROM: process.env.EMAIL_FROM!,
      SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT!,
      SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN!,
      SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID!,
      NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    },
  },
});
