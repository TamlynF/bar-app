-- Stores a QR code (PNG data URL) for a bookable event's shareable booking link.
-- Generated on demand from booking_page_url; cleared when the event is not bookable.
alter table public.events add column if not exists booking_qr_url text;
