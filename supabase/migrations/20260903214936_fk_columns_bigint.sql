-- Every referenced id is bigint; these FK columns were int4/int2 and capped
-- the referenceable range. The two views below depend on some of the columns
-- and must be recreated around the type change.

drop view if exists public.events_reordered;
drop view if exists public.v_event_types_subtypes_events;

alter table public.band_booking_notes
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.band_booking_requests
  alter column created_by type bigint,
  alter column event_id type bigint,
  alter column updated_by type bigint;

alter table public.booking_scores
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.bookings
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.contacts
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.email_templates
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.employees
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.event_category_playlists
  alter column events_id type bigint,
  alter column quiz_category_configs_id type bigint;

alter table public.event_subtypes
  alter column created_by type bigint,
  alter column modified_by type bigint;

alter table public.event_types
  alter column created_by type bigint,
  alter column modified_by type bigint;

alter table public.events
  alter column created_by type bigint,
  alter column host_employee_id type bigint,
  alter column updated_by type bigint;

alter table public.gallery_images
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.generated_quiz_questions
  alter column events_id type bigint,
  alter column quiz_category_configs_id type bigint;

alter table public.marketing_settings
  alter column updated_by type bigint;

alter table public.marketing_trends
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.merchandise
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.music_acts
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.past_quiz_questions
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.private_hire_requests
  alter column created_by type bigint,
  alter column event_id type bigint,
  alter column event_subtypes_id type bigint,
  alter column updated_by type bigint;

alter table public.settings
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.specials
  alter column created_by type bigint,
  alter column updated_by type bigint;

alter table public.tables
  alter column created_by type bigint,
  alter column updated_by type bigint;

create view public.v_event_types_subtypes_events
with (security_invoker = on) as
select e.id as e_id,
  e.date as e_date,
  e.start_time as e_start,
  e.end_time as e_end,
  e.title as e_title,
  e.is_active as e_active,
  e.is_bookable as e_isbookable,
  e.host_employee_id as e_host_emp,
  e.seating_required as e_seating_req,
  e.payment_amount as e_payment_req,
  et.id as et_id,
  et.name as et_name,
  et.booking_grouping,
  et.is_bookable as et_isbookable,
  es.id as es_id,
  es.name as es_name,
  es.is_bookable as es_isbookable,
  es.host_required as es_host_req,
  es.seating_required as es_seating_req,
  es.payment_required as es_payment_req,
  es.behavior,
  e.event_types_id,
  e.event_subtypes_id
from events e
  join event_types et on e.event_types_id = et.id
  join event_subtypes es on e.event_subtypes_id = es.id
order by e.date;

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
    e.booking_id,
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

grant all on public.v_event_types_subtypes_events to anon, authenticated, service_role;
grant all on public.events_reordered to anon, authenticated, service_role;
