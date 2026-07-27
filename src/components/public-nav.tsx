import { getCompanyInfo, instagramUrl } from "@/lib/company-info";
import { PublicNavBar } from "@/components/public-nav-bar";

export async function PublicNav({
  currentPath,
  overlay = false,
}: {
  currentPath?: string;
  overlay?: boolean;
}) {
  const info = await getCompanyInfo();

  return (
    <PublicNavBar
      currentPath={currentPath}
      overlay={overlay}
      instagramUrl={instagramUrl(info?.instagram)}
    />
  );
}
