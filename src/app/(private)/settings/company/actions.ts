"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";

export async function getCompanyInfo() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_information")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching company info:", error);
    return null;
  }
  return data;
}

export async function updateCompanyInfo(formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id")?.toString();
  if (!id) return { error: "Missing record ID." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);

  // The row is seeded rather than created through the app, so the first save is
  // the only chance to record who it belongs to.
  const { data: existing } = await supabase
    .from("company_information")
    .select("created_at, created_by")
    .eq("id", id)
    .maybeSingle();

  const payload = {
    name: formData.get("name")?.toString() || null,
    logo_url: formData.get("logo_url")?.toString() || null,
    address: formData.get("address")?.toString() || null,
    email: formData.get("email")?.toString() || null,
    phone: formData.get("phone")?.toString() || null,
    instagram: formData.get("instagram")?.toString() || null,
    facebook: formData.get("facebook")?.toString() || null,
    twitter: formData.get("twitter")?.toString() || null,
    tiktok: formData.get("tiktok")?.toString() || null,
    youtube: formData.get("youtube")?.toString() || null,
    tagline: formData.get("tagline")?.toString() || null,
    tagline_accent: formData.get("tagline_accent")?.toString() || null,
    description: formData.get("description")?.toString() || null,
    opening_hours: JSON.parse(formData.get("opening_hours")?.toString() || "{}"),
    max_capacity: parseInt(formData.get("max_capacity")?.toString() || "0", 10) || null,
    private_hire_min_capacity: parseInt(formData.get("private_hire_min_capacity")?.toString() || "0", 10) || null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    created_by: existing?.created_by ?? currentEmployeeId,
    updated_at: new Date().toISOString(),
    updated_by: currentEmployeeId,
  };

  try {
    const { data: saved, error } = await supabase
      .from("company_information")
      .update(payload)
      .eq("id", id)
      .select("created_at, created_by, updated_at, updated_by")
      .single();

    if (error) throw error;

    revalidatePath("/settings/company");
    revalidatePath("/");
    return { success: true, audit: saved };
  } catch (error) {
    console.error("Error updating company info:", error);
    return { error: error instanceof Error ? error.message : "Failed to save." };
  }
}
