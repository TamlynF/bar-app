-- Square order lines - one row per line item, for market "normal sales".
--
-- square_sales keeps one row per order with its raw payload. The market's
-- tier engine needs units sold per catalog variation per trading night, so
-- the nightly sync also writes every line here. trading_night is the venue
-- local date the order closed on, rolled back a day before 06:00, so a sale
-- at 01:45 on Sunday morning belongs to Saturday night.

create table if not exists public.square_sale_lines (
  square_order_id text not null references public.square_sales(square_order_id) on delete cascade,
  line_uid        text not null,
  variation_id    text,
  quantity        numeric not null default 1,
  closed_at       timestamptz not null,
  trading_night   date not null,
  primary key (square_order_id, line_uid)
);

create index if not exists square_sale_lines_variation_night_idx
  on public.square_sale_lines (variation_id, trading_night);
create index if not exists square_sale_lines_trading_night_idx
  on public.square_sale_lines (trading_night);

grant all on public.square_sale_lines to anon, authenticated, service_role;

-- Backfill from the raw payloads already synced. Later syncs replace an
-- order's lines wholesale, so the index fallback for a missing uid is only
-- ever a stopgap for old rows.
insert into public.square_sale_lines (square_order_id, line_uid, variation_id, quantity, closed_at, trading_night)
select
  s.square_order_id,
  coalesce(li.value->>'uid', li.ordinality::text),
  li.value->>'catalogObjectId',
  coalesce(nullif(li.value->>'quantity', '')::numeric, 1),
  closed.at,
  ((closed.at at time zone 'Europe/London') - interval '6 hours')::date
from public.square_sales s
cross join lateral jsonb_array_elements(coalesce(s.raw->'lineItems', '[]'::jsonb)) with ordinality as li(value, ordinality)
cross join lateral (
  select coalesce(nullif(s.raw->>'closedAt', '')::timestamptz, nullif(s.raw->>'createdAt', '')::timestamptz, s.created_at) as at
) as closed
where coalesce(nullif(li.value->>'quantity', '')::numeric, 1) > 0
on conflict (square_order_id, line_uid) do nothing;

-- Normal sales no longer use a per-event history window.
alter table public.stock_market_events
  drop column if exists history_from,
  drop column if exists history_to;
