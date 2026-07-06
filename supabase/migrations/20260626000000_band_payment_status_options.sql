-- Widen band_booking_requests.payment_status to support derived payment states.
-- The status is now computed from payment_amount vs paid_amount in the admin UI:
--   no_payment      → payment_amount = 0
--   unpaid          → paid_amount = 0 (with payment_amount > 0)
--   partially_paid  → 0 < paid_amount < payment_amount
--   paid            → paid_amount = payment_amount
--   over_paid       → paid_amount > payment_amount

ALTER TABLE public.band_booking_requests
  DROP CONSTRAINT IF EXISTS band_booking_requests_payment_status_check;

ALTER TABLE public.band_booking_requests
  ADD CONSTRAINT band_booking_requests_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'no_payment'::text,
    'unpaid'::text,
    'partially_paid'::text,
    'paid'::text,
    'over_paid'::text
  ]));
