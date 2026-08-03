import { AdminHubGrid } from "@/components/admin-hub-tiles";
import { QUIZ_NAV_ITEMS } from "@/lib/admin-nav";

export default function QuizHubPage() {
  return (
    <div className="space-y-6 px-2 py-2 sm:px-8 sm:py-0">
      <AdminHubGrid items={QUIZ_NAV_ITEMS} />
    </div>
  );
}
