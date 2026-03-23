"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveEmployeeAction(formData: FormData) {
  const supabase = await createClient();
  
  const id = formData.get("id")?.toString();
  console.log("Received form data for employee:", {
    id,
    full_name: formData.get("full_name")?.toString(),
    email: formData.get("email")?.toString(),
    role: formData.get("role")?.toString(),
  });

  // Extracting data matching the schema
  const payload = {
    full_name: formData.get("full_name")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    role: formData.get("role")?.toString() || null,
    status: formData.get("status")?.toString() || "",
    start_date: formData.get("start_date")?.toString() || new Date().toISOString().split('T')[0],
    end_date: formData.get("end_date")?.toString() || null,
    country_code: formData.get("country_code")?.toString() || null,
    phone_no: formData.get("phone_no")?.toString() || null,
    birthday: formData.get("birthday")?.toString() || null,
    is_skeleton_staff: formData.get("is_skeleton_staff") === "on",
  };

  if (!payload.full_name || !payload.email || !payload.start_date) {
    return { error: "Full Name, Email, and Start Date are required." };
  }

  // Resolve current logged-in user to an employee id
  let currentEmployeeId: number | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  console.log("Current logged-in user:", user);

  if (user?.email) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .single();
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
      
      // Catch unique email violations nicely
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
      
      console.log("Invite Email:", payload.email);
      console.log("Environment variables:", {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      });
      console.log("Redirect URL for invite:", redirectUrl);
      const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
        payload.email,
        { redirectTo: `${redirectUrl}/accept-invite` }
      );

      console.log("Invite result:", { inviteError });

      if (inviteError && inviteError.message !== "User already registered") {
        throw new Error(`Failed to send login invite: ${inviteError.message}`);
      }

      // Insert new employee, storing the auth user id and audit fields
      const { error } = await supabase.from("employees").insert({
        ...payload,
        auth_user_id: inviteData?.user?.id ?? null,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });

      // Catch unique email violations nicely
      if (error?.code === '23505') {
        throw new Error("An employee with this email address already exists.");
      } else if (error) {
        throw error;
      }
    }

    revalidatePath("/settings/system-users"); // Adjust to your actual route
    return { success: true };
  } catch (error) {
    console.error("Error saving employee:", error);
      return { error: error instanceof Error ? error.message : "Failed to save employee." };
      
  }
}

export async function deleteEmployeeAction(id: number) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;
    
    revalidatePath("/settings/system-users");
    return { success: true };
  } catch (error) {
    console.error("Error deleting employee:", error);
    // If a foreign key restriction occurs (e.g., they hosted an event or modified a record)
    //if (error?.code === '23503') {
    //  return { error: "Cannot delete this employee because they are linked to existing events or records." };
    //}
      return { error: error instanceof Error ? error.message : "Failed to delete employee." };
  }
}