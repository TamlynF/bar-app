-- Square orders a private hire deposit used to point at. Changing the deposit
-- amount or the date replaces the checkout, but a customer who still had the
-- old one open can pay it, so the webhook matches those orders here too.

alter table public.private_hire_requests
  add column if not exists superseded_square_order_ids text[] not null default '{}';

create index if not exists private_hire_requests_superseded_orders_idx
  on public.private_hire_requests using gin (superseded_square_order_ids);
