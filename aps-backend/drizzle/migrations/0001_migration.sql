alter table public.operators add constraint operators_name_key unique (name);
alter table public.shifts add constraint shifts_name_key unique (name);
alter table public.maintenance_events add column external_id text unique;