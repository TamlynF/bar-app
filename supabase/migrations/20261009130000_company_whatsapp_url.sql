-- Invite link for the venue's WhatsApp group or Channel. Set on Settings →
-- Company; when present the Market Night page offers "Join the WhatsApp
-- group" beside the other alert options. Staff post the drops there by
-- hand - the WhatsApp Business API can't write to a group.
alter table public.company_information
  add column if not exists whatsapp_url text;
