-- Admin-authored notes about the band, separate from the applicant's booking
-- notes (`notes`) and the outcome-email staff note (`admin_notes`).
ALTER TABLE public.band_booking_requests
  ADD COLUMN IF NOT EXISTS band_notes text;
