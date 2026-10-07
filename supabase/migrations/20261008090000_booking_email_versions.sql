-- Named versions of the customer booking emails, chosen per event type,
-- sub-type and event.
--
-- email_templates was one row per scenario. A row with variant_name null is
-- still that scenario's Standard override; a row with a name is a separate
-- version staff can pick. Versions override the built-in copy slot by slot,
-- exactly like the Standard row does.
--
-- booking_emails maps a booking email (confirmed, waitlisted, payment_pending,
-- changed_by_customer, changed_by_admin, cancelled_by_customer,
-- cancelled_by_admin) to an email_templates id. Each email resolves on its own:
-- event, then sub-type, then type, then Standard. Null or a missing key means
-- inherit.
--
-- The quiz form had its own confirmed/waitlisted wording. That form is gone,
-- so its copy becomes a "Quiz Night" version of the event emails and every quiz
-- sub-type picks it.

alter table public.email_templates
  add column if not exists variant_name text;

alter table public.email_templates
  drop constraint if exists email_templates_scenario_key_key;

create unique index if not exists email_templates_standard_key
  on public.email_templates (scenario_key)
  where variant_name is null;

create unique index if not exists email_templates_variant_key
  on public.email_templates (scenario_key, lower(variant_name))
  where variant_name is not null;

alter table public.email_templates
  drop constraint if exists email_templates_variant_name_not_blank;
alter table public.email_templates
  add constraint email_templates_variant_name_not_blank
  check (variant_name is null or length(btrim(variant_name)) > 0);

alter table public.event_types add column if not exists booking_emails jsonb;
alter table public.event_subtypes add column if not exists booking_emails jsonb;
alter table public.events add column if not exists booking_emails jsonb;

delete from public.email_templates
  where scenario_key in ('booking.quiz.confirmed', 'booking.quiz.waitlisted');

insert into public.email_templates (scenario_key, variant_name, subject, heading, greeting, intro, cta_label, footnote)
values
  (
    'booking.event.confirmed',
    'Quiz Night',
    'Quiz Night Table Confirmed! 🎉',
    '{{eventTitle}}',
    'Hey {{customerName}}!',
    'Great news! Your team "{{groupName}}" is locked in.',
    'Manage Booking',
    'Can''t make it? Please cancel at least 24 hours in advance using Manage Booking, so we can offer your place to someone else.'
  ),
  (
    'booking.event.waitlisted',
    'Quiz Night',
    'You are on the Waitlist',
    '{{eventTitle}}',
    'Hey {{customerName}}!',
    'We''re currently full, so "{{groupName}}" has been added to our waitlist.',
    'Manage Booking',
    null
  )
on conflict do nothing;

update public.event_subtypes s
set booking_emails = coalesce(s.booking_emails, '{}'::jsonb) || jsonb_build_object(
  'confirmed', (select id from public.email_templates
                where scenario_key = 'booking.event.confirmed' and variant_name = 'Quiz Night'),
  'waitlisted', (select id from public.email_templates
                 where scenario_key = 'booking.event.waitlisted' and variant_name = 'Quiz Night')
)
where s.behavior = 'quiz';
