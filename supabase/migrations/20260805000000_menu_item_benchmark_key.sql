-- Which price-comparison round this item stands for on /marketing/prices.
-- Null means "work it out from the name and category"; 'none' keeps the item
-- out of the comparison entirely. No CHECK constraint - the set of rounds is
-- owned by src/app/(private)/marketing/lib/compare.ts and validated there.
alter table public.menu_items add column if not exists benchmark_key text;

create index if not exists menu_items_benchmark_key_idx
  on public.menu_items (benchmark_key)
  where benchmark_key is not null;
