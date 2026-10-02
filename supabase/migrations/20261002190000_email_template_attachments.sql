-- Files attached to an email template go out with every email sent from it -
-- a stage plot, a load-in map, a poster spec.
--
-- attachments is a list of {name, path, size, contentType}. The files sit in
-- the private email-attachments bucket under templates/<scenario_key>/ and
-- are read with the service role at send time; they are never public.
-- Null or an empty list means no attachments.

alter table public.email_templates add column if not exists attachments jsonb;
