import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "./update-password-form";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  
  // Verify the user is actually logged in via the recovery link
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Session_missing");
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-[#E6DFC8]">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[#26300D] mb-2">
          Update Password
        </h1>
        <p className="text-sm font-medium text-[#5F624F] mb-6">
          Please enter your new password below.
        </p>

        <UpdatePasswordForm />
      </div>
    </div>
  );
}