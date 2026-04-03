import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updatePassword } from "./actions";

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

        <form 
          action={async (formData: FormData) => {
            "use server";
            await updatePassword(formData);
          }} 
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-[#26300D]">
              New Password
            </label>
            <input
              type="password"
              name="password"
                            required
                            placeholder="••••••••"
              minLength={6}
              className="w-full px-4 py-3 bg-white border border-[#E6DFC8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#26300D]"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-[#26300D]">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
                            required
                            placeholder="••••••••"
              minLength={6}
              className="w-full px-4 py-3 bg-white border border-[#E6DFC8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#26300D]"
            />
          </div>

                    <button
                        type="submit"
                        className="w-full h-12 bg-[#26300D] hover:bg-[#1a2109] text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors mt-2"
                    >
                        Save Password
                    </button>
                </form>
            </div>
        </div>
    );
}