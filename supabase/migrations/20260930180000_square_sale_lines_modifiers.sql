-- The modifiers rung on each Square order line - for a spirit, which mixer it
-- was sold with (Tonic, Red Bull...). Normal sales still count the line as one
-- spirit; this is kept for mixer reporting. Each entry is
--   { "catalogObjectId": text, "name": text, "quantity": number, "totalPrice": number (pounds) }
-- and a line with no modifiers holds [].

alter table public.square_sale_lines
  add column if not exists modifiers jsonb not null default '[]'::jsonb;

alter table public.square_sale_lines
  drop constraint if exists square_sale_lines_modifiers_array;

alter table public.square_sale_lines
  add constraint square_sale_lines_modifiers_array check (jsonb_typeof(modifiers) = 'array');

-- Backfill from the raw order payloads already synced. Lines are matched on
-- their uid, or on their position when Square gave none, the same key the
-- sync uses.
update public.square_sale_lines l
set modifiers = found.modifiers
from (
  select
    s.square_order_id,
    coalesce(li.value->>'uid', li.ordinality::text) as line_uid,
    jsonb_agg(
      jsonb_build_object(
        'catalogObjectId', m->>'catalogObjectId',
        'name', m->>'name',
        'quantity', coalesce(nullif(m->>'quantity', '')::numeric, 1),
        'totalPrice', round(coalesce(nullif(m->'totalPriceMoney'->>'amount', '')::numeric, 0) / 100, 2)
      )
    ) as modifiers
  from public.square_sales s
  cross join lateral jsonb_array_elements(coalesce(s.raw->'lineItems', '[]'::jsonb)) with ordinality as li(value, ordinality)
  cross join lateral jsonb_array_elements(coalesce(li.value->'modifiers', '[]'::jsonb)) as m
  group by s.square_order_id, coalesce(li.value->>'uid', li.ordinality::text)
) as found
where l.square_order_id = found.square_order_id
  and l.line_uid = found.line_uid;
