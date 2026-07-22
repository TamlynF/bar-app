import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "./update-password-form";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Session_missing");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EA] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E6DFC8] bg-white p-8 shadow-sm">
        <h1 className="mb-2 font-black text-2xl tracking-tight text-[#26300D] uppercase">
          Update Password
        </h1>
        <p className="mb-6 text-sm font-medium text-[#5F624F]">
          Please enter your new password below.
        </p>

        <UpdatePasswordForm />
      </div>
    </div>
  );
}