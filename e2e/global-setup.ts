import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

/**
 * Runs once before the E2E suite:
 *  1. Ensures a confirmed auth user exists in LOCAL Supabase (via service role).
 *  2. Links it to the seeded `employees` row so admin pages recognise the staff member.
 *  3. Logs in through the real /login form and saves the session (storageState)
 *     to e2e/.auth/admin.json for authenticated specs to reuse.
 */
export default async function globalSetup(_config: FullConfig) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const email = process.env.TEST_ADMIN_EMAIL!;
  const password = process.env.TEST_ADMIN_PASSWORD!;
  const baseURL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create (or reset) the auth user — idempotent across reruns.
  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    // Already exists — find it and force the known password.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === email);
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    }
  }

  // 2. Link the auth user to the seeded employee.
  if (userId) {
    await admin.from("employees").update({ auth_user_id: userId }).eq("email", email);
  }

  // 3. UI login → capture SSR cookies into storageState.
  const authDir = path.resolve(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.context().storageState({ path: path.join(authDir, "admin.json") });
  await browser.close();
}
