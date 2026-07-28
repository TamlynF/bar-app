import { createClient } from "@/lib/supabase/server";
import PrivateHireForm from "./_components/private-hire-form";
import { PublicNav } from "@/components/public-nav";
import { getCompanyInfo } from "@/lib/company-info";

export const metadata = {
  title: "Private Hire | Don Fenticas",
  description: "Book Don Fenticas for your private event.",
};

export default async function PrivateHirePage() {
  const supabase = await createClient();

  const companyInfo = await getCompanyInfo();

  const { data: subtypeRows } = await supabase
    .from("event_subtypes")
    .select("id, name, default_event_title, event_types!inner(name)")
    .eq("behavior", "private")
    .eq("event_types.name", "private")
    .order("name");

  const subtypes = (subtypeRows ?? []).map((s) => ({
    id: s.id as number,
    name: s.name as string,
    default_event_title: (s.default_event_title as string | null) ?? null,
  }));

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-stone-300 antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 10px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <PublicNav currentPath="/book/private" />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-12 pb-4 sm:px-6 sm:pt-14 sm:pb-12 lg:px-8">

        <div className="relative mb-12 rounded-[2.5rem] border border-white/10 bg-white/3 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
            <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]" />
          </div>

          <div className="relative z-10 mb-8 text-center">
            <h3 className="font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl">Private Hire</h3>
            <p className="mt-2 text-xs font-medium text-stone-500 sm:text-base">Fill in your details and we&apos;ll confirm availability.</p>
          </div>

          <div className="relative z-10">
            <PrivateHireForm
              subtypes={subtypes}
              minCapacity={companyInfo?.private_hire_min_capacity ?? null}
              maxCapacity={companyInfo?.max_capacity ?? null}
            />
          </div>
        </div>

        <div className="mt-auto mb-6 flex flex-col items-center gap-3 pt-8">
          <div className="flex items-center gap-4 text-stone-300">
            <div className="h-px w-6 bg-white/20" />
            <span className="text-[10px] font-bold tracking-[0.4em] uppercase">Don Fenticas</span>
            <div className="h-px w-6 bg-white/20" />
          </div>
          <p className="text-[9px] tracking-widest text-stone-400 uppercase">
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>

      </div>
    </main>
  );
}
