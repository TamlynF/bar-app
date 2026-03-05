import { redirect } from "next/navigation";

export default function SettingsBasePage() {
  // Automatically redirect users to the tables settings page
  redirect("/dashboard/settings/tables");
}