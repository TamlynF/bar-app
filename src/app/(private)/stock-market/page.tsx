import { CandlestickChart } from "lucide-react";
import { AdminHubSection } from "@/components/admin-hub-tiles";
import { MARKET_HUB_HREF, MARKET_NAV_ITEMS } from "@/lib/admin-nav";

export default function StockMarketHubPage() {
  return (
    <div className="space-y-6 px-2 py-2 sm:px-8 sm:py-0">
      <AdminHubSection
        label="Stock market"
        items={[
          {
            label: "Market nights",
            href: MARKET_HUB_HREF,
            icon: CandlestickChart,
            description: "Open a night and run the trading floor",
          },
          ...MARKET_NAV_ITEMS,
        ]}
      />
    </div>
  );
}
