-- events.booking_id was a second copy of the quiz winner (booking_scores.is_winner
-- is the one the app reads) and formed a cycle with bookings.event_id. Any
-- winner recorded only on the event is moved into booking_scores before the
-- column goes. The events_reordered view selects the column, so it is rebuilt.

insert into public.booking_scores (booking_id, event_id, is_winner, created_by, updated_by)
select e.booking_id, e.id, true, e.updated_by, e.updated_by
from public.events e
where e.booking_id is not null
  and not exists (
    select 1 from public.booking_scores s
    where s.event_id = e.id and s.is_winner
  );

drop view if exists public.events_reordered;

alter table public.events drop column if exists booking_id;

create view public.events_reordered as
with base as (
  select e.id,
    e.date,
    e.start_time,
    e.end_time,
    e.title,
    et.name as event_type_name,
    est.name as event_subtype_name,
    e.tagline,
    he.full_name as host_employee_name,
    e.seating_required,
    e.payment_amount,
    e.is_bookable,
    e.booking_config,
    e.booking_page_url,
    e.is_active,
    e.is_fully_booked,
    e.group_name,
    e.external_link,
    e.karaoke_request_url,
    e.event_types_id,
    e.event_subtypes_id,
    e.host_employee_id,
    e.floor_plan_layout,
    e.booking_card_title,
    e.booking_card_tagline,
    e.booking_card_icon,
    e.booking_card_badge,
    e.created_at,
    ce.full_name as created_by_employee_name,
    e.updated_at,
    ue.full_name as updated_by_employee_name
  from events e
    left join event_types et on et.id = e.event_types_id
    left join event_subtypes est on est.id = e.event_subtypes_id
    left join employees he on he.id = e.host_employee_id
    left join employees ce on ce.id = e.created_by
    left join employees ue on ue.id = e.updated_by
), event_types_cols as (
  select e.id as event_id1,
    et.description as event_type_description,
    et.color as event_type_color,
    et.created_at as event_type_created_at,
    et.modified_at as event_type_modified_at,
    et.created_by as event_type_created_by,
    et.modified_by as event_type_modified_by,
    et.booking_grouping as event_type_booking_grouping,
    et.booking_card_title as event_type_booking_card_title,
    et.booking_card_tagline as event_type_booking_card_tagline,
    et.booking_card_icon as event_type_booking_card_icon,
    et.booking_card_badge as event_type_booking_card_badge,
    et.is_bookable as event_type_is_bookable,
    et.booking_config as event_type_booking_config
  from events e
    left join event_types et on et.id = e.event_types_id
), event_subtypes_cols as (
  select e.id as event_id2,
    est.tagline as event_subtype_tagline,
    est.created_at as event_subtype_created_at,
    est.modified_at as event_subtype_modified_at,
    est.color as event_subtype_color,
    est.default_event_title as event_subtype_default_event_title,
    est.is_bookable as event_subtype_is_bookable,
    est.booking_config as event_subtype_booking_config,
    est.host_required as event_subtype_host_required,
    est.seating_required as event_subtype_seating_required,
    est.payment_required as event_subtype_payment_required,
    est.default_payment_amount as event_subtype_default_payment_amount,
    est.created_by as event_subtype_created_by,
    est.modified_by as event_subtype_modified_by,
    est.behavior as event_subtype_behavior,
    est.booking_card_title as event_subtype_booking_card_title,
    est.booking_card_tagline as event_subtype_booking_card_tagline,
    est.booking_card_icon as event_subtype_booking_card_icon,
    est.booking_card_badge as event_subtype_booking_card_badge
  from events e
    left join event_subtypes est on est.id = e.event_subtypes_id
), bookings_json as (
  select e.id as event_id3,
    coalesce(jsonb_agg(to_jsonb(b_1.*) - 'event_id'::text) filter (where b_1.id is not null), '[]'::jsonb) as bookings
  from events e
    left join bookings b_1 on b_1.event_id = e.id
  group by e.id
), band_booking_requests_json as (
  select e.id as event_id4,
    coalesce(jsonb_agg(to_jsonb(br.*) - 'event_id'::text) filter (where br.id is not null), '[]'::jsonb) as band_booking_requests
  from events e
    left join band_booking_requests br on br.event_id = e.id
  group by e.id
), private_hire_requests_json as (
  select e.id as event_id5,
    coalesce(jsonb_agg(to_jsonb(pr.*) - 'event_id'::text) filter (where pr.id is not null), '[]'::jsonb) as private_hire_requests
  from events e
    left join private_hire_requests pr on pr.event_id = e.id
  group by e.id
)
select b.id,
  b.date,
  b.start_time,
  b.end_time,
  b.title,
  b.event_type_name,
  etc.event_type_booking_grouping,
  etc.event_type_is_bookable,
  etc.event_type_booking_card_title,
  etc.event_type_booking_card_tagline,
  etc.event_type_booking_card_icon,
  etc.event_type_booking_card_badge,
  b.event_subtype_name,
  esc.event_subtype_behavior,
  esc.event_subtype_color,
  esc.event_subtype_tagline,
  esc.event_subtype_default_event_title,
  esc.event_subtype_is_bookable,
  esc.event_subtype_booking_card_title,
  esc.event_subtype_booking_card_tagline,
  esc.event_subtype_booking_card_icon,
  esc.event_subtype_booking_card_badge,
  esc.event_subtype_booking_config,
  esc.event_subtype_host_required,
  esc.event_subtype_seating_required,
  esc.event_subtype_payment_required,
  esc.event_subtype_default_payment_amount,
  b.tagline,
  b.host_employee_name,
  b.seating_required,
  b.payment_amount,
  b.is_bookable,
  b.booking_config,
  b.booking_page_url,
  b.is_active,
  b.is_fully_booked,
  b.karaoke_request_url,
  b.booking_card_title,
  b.booking_card_tagline,
  b.booking_card_icon,
  b.booking_card_badge,
  b.created_at,
  b.updated_at,
  etc.event_id1,
  etc.event_type_description,
  esc.event_id2,
  bj.bookings,
  bbrj.band_booking_requests,
  phj.private_hire_requests
from base b
  left join event_types_cols etc on etc.event_id1 = b.id
  left join event_subtypes_cols esc on esc.event_id2 = b.id
  left join bookings_json bj on bj.event_id3 = b.id
  left join band_booking_requests_json bbrj on bbrj.event_id4 = b.id
  left join private_hire_requests_json phj on phj.event_id5 = b.id;

grant all on public.events_reordered to anon, authenticated, service_role;
