import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getCurrentEmployeeId(
  supabase: ServerClient
): Promise<number | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  return data?.id ?? null;
}
