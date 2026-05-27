"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveEmployeeAction(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();

  const payload = {
    full_name: formData.get("full_name")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    role: formData.get("role")?.toString() || null,
    employment_type: formData.get("employment_type")?.toString() || null,
    status: formData.get("status")?.toString() || "",
    start_date: formData.get("start_date")?.toString() || new Date().toISOString().split('T')[0],
    end_date: formData.get("end_date")?.toString() || null,
    phone_no: formData.get("phone_no")?.toString() || null,
    country_code: formData.get("phone_no")?.toString()
      ? formData.get("country_code")?.toString() || null
      : null,
    birthday: formData.get("birthday")?.toString() || null,
  };

  if (!payload.full_name || !payload.email || !payload.start_date) {
    return { error: "Full Name, Email, and Start Date are required." };
  }

  // Resolve current logged-in user to an employee id
  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (emp) currentEmployeeId = emp.id;
  }

  try {
    if (id) {
      // Update existing employee
      const { error } = await supabase.from("employees").update({
        ...payload,
        updated_at: new Date().toISOString(),
        updated_by: currentEmployeeId,
      }).eq("id", id);

      if (error?.code === '23505') {
        throw new Error("An employee with this email address already exists.");
      } else if (error) {
        throw error;
      }
    } else {
      // Invite the employee as a Supabase auth user so they can log in
      const adminSupabase = createAdminClient();
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
        payload.email,
        { redirectTo: `${redirectUrl}/accept-invite` }
      );

      if (inviteError && inviteError.message !== "User already registered") {
        throw new Error(`Failed to send login invite: ${inviteError.message}`);
      }

      // Resolve auth_user_id — either from the invite or by looking up an existing user
      let authUserId: string | null = inviteData?.user?.id ?? null;
      if (!authUserId) {
        const { data: { users } } = await adminSupabase.auth.admin.listUsers();
        const existingUser = users.find((u) => u.email === payload.email);
        if (existingUser) authUserId = existingUser.id;
      }

      // Use admin client for the insert to bypass RLS (the acting user may not have an employee record yet)
      const { error } = await adminSupabase.from("employees").insert({
        ...payload,
        auth_user_id: authUserId,
        invite_sent_at: !inviteError ? new Date().toISOString() : null,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });

      if (error?.code === '23505') throw new Error("An employee with this email address already exists.");
      if (error) throw error;
    }

    revalidatePath("/settings/users");
    return { success: true };
  } catch (error) {
    console.error("Error saving employee:", error);
    return { error: error instanceof Error ? error.message : "Failed to save employee." };
  }
}

export async function sendPasswordResetAction(email: string) {
  const adminSupabase = createAdminClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const { error } = await adminSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/accept-invite`,
  });

  if (error) {
    return { error: error.message };
  }

  // Stamp the employee record with when the reset email was sent
  const supabase = await createClient();
  await supabase
    .from("employees")
    .update({ password_reset_sent_at: new Date().toISOString() })
    .eq("email", email);

  return { success: true };
}

export async function markInviteAcceptedAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;
  await supabase
    .from("employees")
    .update({ invite_accepted_at: new Date().toISOString() })
    .eq("email", user.email);
}

export async function deleteEmployeeAction(id: number) {
  const supabase = await createClient();

  // Prevent deleting your own employee record
  const { data: { user } } = await supabase.auth.getUser();
  const { data: target } = await supabase
    .from("employees")
    .select("email")
    .eq("id", id)
    .maybeSingle();

  if (target?.email && user?.email && target.email === user.email) {
    return { error: "You cannot delete your own account." };
  }

  try {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/settings/users");
    return { success: true };
  } catch (error) {
    console.error("Error deleting employee:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23503") {
      return { error: "Cannot delete this employee because they are linked to existing events or records. Mark as inactive instead." };
    }
    return { error: error instanceof Error ? error.message : "Failed to delete employee." };
  }
}
