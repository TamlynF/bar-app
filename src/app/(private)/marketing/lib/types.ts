import type { MenuItemPrice } from "@/lib/menu-price";

export type TrendKind = "advertising" | "event_idea" | "price";
export type TrendState = "new" | "saved" | "ignored";
export type TrendEffort = "Easy" | "Medium" | "Big";
export type CompetitorItemType = "drink" | "snack" | "food";

export type MarketingTrend = {
  id: string;
  kind: TrendKind;
  title: string;
  summary: string | null;
  relevance: string | null;
  action: string | null;
  effort: TrendEffort | null;
  category: string | null;
  source_url: string | null;
  source_name: string | null;
  tags: string[];
  state: TrendState;
  signature: string | null;
  area: string | null;
  fetched_at: string;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export type CompetitorPrice = {
  id: string;
  venue_name: string;
  item_name: string;
  item_type: CompetitorItemType | null;
  price_text: string | null;
  price_amount: number | null;
  area: string | null;
  source_url: string | null;
  source_name: string | null;
  fetched_at: string;
};

export type MarketingSettings = {
  id: string;
  comparison_area: string | null;
  comparison_radius: string | null;
  last_trends_refresh_at: string | null;
  last_prices_refresh_at: string | null;
  updated_at: string;
  updated_by?: number | null;
};

export type MenuItemLite = {
  id: number;
  name: string;
  price: string;
  category?: string | null;
  // Charged on top for a spirit's mixer, so the spirit round compares like for like.
  mixer_surcharge?: number | null;
  // The round this item stands for, set by hand. Null falls back to the keyword match.
  benchmark_key?: string | null;
  // One row per measure sold. When present, the round takes the serve it asks
  // for instead of the first amount in the display text.
  prices?: MenuItemPrice[];
};

export type PriceBenchmark = {
  id: number;
  key: string;
  label: string;
  // Comma-separated serves that can price this round, e.g. "small,glass".
  serves: string;
  display_order: number;
  is_active: boolean;
};

export type AiTrend = {
  title: string;
  summary?: string;
  relevance?: string;
  action?: string;
  effort?: string;
  category?: string;
  source_url?: string;
  source_name?: string;
  tags?: string[];
};

export type AiCompetitorPrice = {
  venue_name: string;
  item_name: string;
  item_type?: string;
  price_text?: string;
  source_url?: string;
  source_name?: string;
};
