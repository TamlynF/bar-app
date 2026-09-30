-- How much Square sales history each variation has, for the Square links
-- page. One row per variation: the order lines synced, the units they add up
-- to and the first and last trading night seen. Runs as the caller so the
-- square_sale_lines policy still applies.

create or replace view public.v_square_sale_line_counts
with (security_invoker = true) as
select
  variation_id,
  count(*)::integer as line_count,
  sum(quantity) as units,
  min(trading_night) as first_night,
  max(trading_night) as last_night
from public.square_sale_lines
where variation_id is not null
group by variation_id;

grant select on public.v_square_sale_line_counts to authenticated, service_role;
