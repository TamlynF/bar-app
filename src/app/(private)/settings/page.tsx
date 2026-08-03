import { AdminHubSection } from "@/components/admin-hub-tiles";
import { SETTINGS_NAV_GROUPS } from "@/lib/admin-nav";

export default function SettingsBasePage() {
  return (
    <div className="space-y-6 px-2 py-2 sm:px-8 sm:py-0">
      {SETTINGS_NAV_GROUPS.map((group) => (
        <AdminHubSection key={group.label} label={group.label} items={group.items} />
      ))}
    </div>
  );
}
