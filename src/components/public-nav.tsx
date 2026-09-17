import { getCompanyInfo, instagramUrl } from "@/lib/company-info";
import { PublicNavBar } from "@/components/public-nav-bar";

export async function PublicNav({
  currentPath,
  overlay = false,
  ticker = true,
}: {
  currentPath?: string;
  overlay?: boolean;
  ticker?: boolean;
}) {
  const info = await getCompanyInfo();

  return (
    <PublicNavBar
      currentPath={currentPath}
      overlay={overlay}
      ticker={ticker}
      instagramUrl={instagramUrl(info?.instagram)}
    />
  );
}
