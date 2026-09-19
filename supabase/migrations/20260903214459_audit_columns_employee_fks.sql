alter table public.event_types
  add constraint event_types_created_by_fkey
  foreign key (created_by) references public.employees(id) on delete set null,
  add constraint event_types_modified_by_fkey
  foreign key (modified_by) references public.employees(id) on delete set null;

alter table public.event_subtypes
  add constraint event_subtypes_created_by_fkey
  foreign key (created_by) references public.employees(id) on delete set null,
  add constraint event_subtypes_modified_by_fkey
  foreign key (modified_by) references public.employees(id) on delete set null;

alter table public.marketing_trends
  add constraint marketing_trends_created_by_fkey
  foreign key (created_by) references public.employees(id) on delete set null,
  add constraint marketing_trends_updated_by_fkey
  foreign key (updated_by) references public.employees(id) on delete set null;

alter table public.marketing_settings
  add constraint marketing_settings_updated_by_fkey
  foreign key (updated_by) references public.employees(id) on delete set null;
