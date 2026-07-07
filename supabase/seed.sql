-- ─────────────────────────────────────────────────────────────────────────────
-- Deterministic seed for the local TEST database (loaded by `supabase db reset`).
-- Explicit ids are used so tests can reference rows; identity sequences are reset
-- at the end so the app's own inserts get fresh, non-colliding ids.
-- Dates are relative to CURRENT_DATE so seeded events are always "upcoming".
-- ─────────────────────────────────────────────────────────────────────────────

-- Company
insert into public.company_information (id, name, max_capacity, address, email)
values (1, 'Don Fenticas', 100, '1 Test Street', 'admin@example.com');

-- Marketing settings (single row; comparison area seeded for local E2E)
insert into public.marketing_settings (comparison_area, comparison_radius)
values ('Hinckley', '5 miles');

-- Staff (auth_user_id is linked at test runtime by Playwright global-setup)
insert into public.employees (id, full_name, email, start_date, status, role)
values (1, 'Test Admin', 'test-admin@example.com', CURRENT_DATE, 'active', 'manager');

-- Tables. Enough that the booking E2E (mobile + desktop) can't exhaust an event
-- and trip the "fully booked" state for the render test.
insert into public.tables (id, name, max_capacity, available) values
  (1, 'T1', 6,  true),
  (2, 'T2', 4,  true),
  (3, 'T3', 6,  true),
  (4, 'T4', 8,  true),
  (5, 'T5', 4,  true),
  (6, 'T6', 10, true);

-- Quiz config
insert into public.quiz_category_configs (id, category_name, short_name, question_count, order_no, is_active)
values (1, 'General Knowledge', 'GK', 5, 1, true);

-- A contact for booking tests
insert into public.contacts (id, full_name, email, country_code, phone_no)
values (1, 'Test Punter', 'punter@example.com', '+44', '7000000000');

-- ── Taxonomy ─────────────────────────────────────────────────────────────────

insert into public.event_types (id, name, color) values
  (1, 'games',   'fuchsia'),
  (2, 'music',   'orange'),
  (3, 'party',   'yellow'),
  (4, 'private', 'rose');

insert into public.event_subtypes
  (id, event_types_id, name, color, tagline, default_event_title,
   behavior, is_bookable,
   host_required, seating_required, payment_required, default_payment_amount, booking_config)
values
  (1, 1, 'quiz',     'fuchsia', 'Eight rounds, one winning team.', 'Quiz Night',
      'quiz',      true,  false, true,  false, 0,  '{}'::jsonb),
  (2, 1, 'bingo',    'red',     'Bingo with a beat.',              'Music Bingo',
      'bingo',     true,  false, true,  false, 0,  '{}'::jsonb),
  (3, 2, 'band',     'orange',  null,                              null,
      'music_act', false, false, true,  false, 0,  '{}'::jsonb),
  (4, 2, 'karaoke',  'blue',    'World famous karaoke.',           'Karaoke Night',
      'karaoke',   false, false, true,  false, 0,  '{}'::jsonb),
  (5, 4, 'birthday', 'rose',    null,                              null,
      'private',   false, true,  true,  false, 0,  '{}'::jsonb),
  (6, 2, 'gig',      'teal',    'Live music, ticketed.',           'Live Gig',
      'music_act', true,  true,  false, true,  10, '{"fields":{"phone":{"visible":true,"label":"Phone Number","required":false},"group_size":{"visible":true,"label":"Number of People","required":true,"min":1,"max":8}}}'::jsonb);

-- A badge on the quiz subtype
insert into public.event_subtype_badges (id, event_subtypes_id, icon, title, description)
values (1, 1, 'Calendar', 'Every Thursday', '8:00PM start');

-- ── Events (all upcoming, mix of bookable/non-bookable) ──────────────────────

insert into public.events
  (id, date, start_time, end_time, title, tagline, event_types_id, event_subtypes_id,
   is_active, is_bookable, seating_required, payment_amount, booking_config)
values
  (1, CURRENT_DATE + 7,  '20:00+00', '22:00+00', 'Quiz Night',  'Eight rounds, one winning team.', 1, 1, true, true,  true,  0,  '{}'::jsonb),
  (2, CURRENT_DATE + 8,  '20:00+00', '22:00+00', 'Music Bingo', 'Bingo with a beat.',             1, 2, true, true,  true,  0,  '{}'::jsonb),
  (3, CURRENT_DATE + 9,  '19:30+00', '23:00+00', 'Live Gig',    'Live music, ticketed.',          2, 6, true, true,  false, 10, '{"fields":{"phone":{"visible":true,"label":"Phone Number","required":false},"group_size":{"visible":true,"label":"Number of People","required":true,"min":1,"max":8}}}'::jsonb),
  (4, CURRENT_DATE + 10, '21:00+00', '23:30+00', 'The Kinks',   null,                             2, 3, true, false, true,  0,  '{}'::jsonb),
  -- Dedicated quiz for the booking happy-path E2E (public-booking.spec.ts), kept
  -- separate from event 1 so booking it can't affect the render test's event.
  (5, CURRENT_DATE + 14, '20:00+00', '22:00+00', 'Quiz Night (Booking E2E)', 'Reserved for the booking test.', 1, 1, true, true, true, 0, '{}'::jsonb);

-- ── Band applications (review queue) ─────────────────────────────────────────

insert into public.band_booking_requests
  (id, booker_name, email, phone_no, type, genre, group_name, status, preferred_dates, notes)
values
  ('b0000000-0000-0000-0000-000000000001', 'PW Band Booker', 'pwband@example.com', '+44 7700 900123',
   'band', 'rock', 'The Test Band', 'pending',
   ARRAY[(CURRENT_DATE + 21), (CURRENT_DATE + 28)]::date[], 'Flexible on set length.');

-- ── Specials (drink/food deals shown on the public home page) ────────────────
-- days_of_week uses ISO weekday numbers (1=Mon … 7=Sun); empty = every day.
insert into public.specials
  (title, description, badges, start_date, end_date, days_of_week, is_active, display_order)
values
  ('Two-for-Tuesday', '<p>Any two house cocktails for £12, all night. From the house cocktail list at the bar — not with other offers.</p>',
   ARRAY['Cocktails'], CURRENT_DATE, CURRENT_DATE + 60, ARRAY[2]::smallint[], true, 0),
  ('Quiz-Night Pints', '<p>£4 selected draught while the rounds run. One per round, be sensible.</p>',
   ARRAY['Draught'], CURRENT_DATE, null, ARRAY[4]::smallint[], true, 1),
  ('Last Orders Deal', '<p>Half-price shots in the final hour, Friday &amp; Saturday. Spirits &amp; shots only, subject to availability.</p>',
   ARRAY['Late'], CURRENT_DATE, null, ARRAY[5,6]::smallint[], true, 2);

-- ── Reset identity sequences past the seeded ids ─────────────────────────────

select setval(pg_get_serial_sequence('public.event_types', 'id'),       (select max(id) from public.event_types));
select setval(pg_get_serial_sequence('public.event_subtypes', 'id'),     (select max(id) from public.event_subtypes));
select setval(pg_get_serial_sequence('public.event_subtype_badges','id'),(select max(id) from public.event_subtype_badges));
select setval(pg_get_serial_sequence('public.events', 'id'),             (select max(id) from public.events));
select setval(pg_get_serial_sequence('public.employees', 'id'),          (select max(id) from public.employees));
select setval(pg_get_serial_sequence('public.tables', 'id'),             (select max(id) from public.tables));
select setval(pg_get_serial_sequence('public.contacts', 'id'),           (select max(id) from public.contacts));
select setval(pg_get_serial_sequence('public.quiz_category_configs','id'),(select max(id) from public.quiz_category_configs));
select setval('public.company_information_id_seq', (select max(id) from public.company_information));
