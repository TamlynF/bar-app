import { getCompanyInfo, instagramHandle, instagramUrl } from "@/lib/company-info";
import { describeBarStatus } from "@/lib/opening-hours";
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
      instagramHandle={instagramHandle(info?.instagram)}
      status={describeBarStatus(info?.opening_hours, new Date())}
    />
  );
}
