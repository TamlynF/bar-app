-- The proposed-slot card and the "Note from our team" block in band emails
-- become styleable and their headings editable.
--
-- email_brand gains shared styles for those booking blocks. Null keeps the
-- current look, the same rule as every other brand column.
--
-- email_templates gains two copy slots: card_title (the heading on the slot
-- card, e.g. "Proposed Slot") and note_title (the heading on the team note).
-- Null means "not overridden", so templates keep the built-in wording.

alter table public.email_brand add column if not exists card_label_color text;
alter table public.email_brand add column if not exists card_label_case text;
alter table public.email_brand add column if not exists card_value_size text;
alter table public.email_brand add column if not exists card_bg text;
alter table public.email_brand add column if not exists card_border text;
alter table public.email_brand add column if not exists note_bar text;

alter table public.email_templates add column if not exists card_title text;
alter table public.email_templates add column if not exists note_title text;
