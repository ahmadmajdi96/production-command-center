
create table public.products (
  sku text primary key,
  name text not null,
  setup_family text not null default 'default',
  bom_status text not null default 'approved',
  routing_status text not null default 'approved',
  recipe_status text not null default 'approved',
  recipe_required boolean not null default true,
  bom jsonb not null default '[]'::jsonb,
  routing jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.materials (
  code text primary key,
  name text not null,
  uom text not null default 'kg',
  on_hand numeric not null default 0,
  on_hold numeric not null default 0,
  expected_qty numeric not null default 0,
  expected_at timestamptz,
  status text not null default 'released',
  updated_at timestamptz not null default now()
);
create table public.machines (
  code text primary key,
  name text not null,
  machine_type text not null,
  line text not null default 'Line 1',
  rate_per_hour numeric not null default 1000,
  status text not null default 'running',
  repair_eta timestamptz,
  updated_at timestamptz not null default now()
);
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_hour int not null,
  end_hour int not null,
  break_start_hour numeric,
  break_minutes int not null default 0,
  days int[] not null default '{1,2,3,4,5,6,0}'
);
create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  skills text[] not null default '{}',
  shift_name text not null,
  available boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  machine_code text not null,
  kind text not null default 'planned',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text
);
create table public.changeovers (
  id uuid primary key default gen_random_uuid(),
  from_family text not null,
  to_family text not null,
  minutes int not null,
  unique (from_family, to_family)
);
create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  sku text not null,
  quantity numeric not null,
  due_date timestamptz not null,
  priority int not null default 3,
  status text not null default 'released',
  source text not null default 'OMS',
  updated_at timestamptz not null default now()
);
create table public.business_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  criterion text not null,
  direction text not null default 'asc',
  rule_priority int not null default 10,
  conflict_policy text,
  active boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
create table public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  version_no int not null,
  parent_id uuid references public.schedule_versions(id),
  status text not null default 'draft',
  kind text not null default 'generated',
  trigger text,
  reason text,
  created_by text not null,
  created_at timestamptz not null default now(),
  horizon_start timestamptz not null,
  items jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  rules_applied jsonb not null default '[]'::jsonb,
  feasibility jsonb not null default '[]'::jsonb
);
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.schedule_versions(id) on delete cascade,
  decision text not null,
  signer_email text not null,
  signer_name text,
  meaning text not null,
  comment text,
  signed_at timestamptz not null default now()
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text
);
create table public.integration_sources (
  key text primary key,
  name text not null,
  provider_system text not null,
  data_scope text not null,
  last_sync_at timestamptz,
  last_status text not null default 'never',
  records_last_sync int not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['products','materials','machines','shifts','operators','maintenance_events','changeovers','production_orders','business_rules','schedule_versions','approvals','audit_log','integration_sources'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Signed-in users can read" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Seed data (demo plant)
insert into public.products (sku, name, setup_family, bom, routing) values
('SKU-OJ-1L','Orange Juice 1L','cap-blue','[{"material":"MAT-ORANGE","qty_per_unit":0.9},{"material":"MAT-BOTTLE-1L","qty_per_unit":1},{"material":"MAT-CAP-BLUE","qty_per_unit":1}]',
 '[{"seq":10,"name":"Mixing","machine_type":"mixer","process_min":15,"setup_min":5,"min_gap_after":10,"skill":"mixing","depends_on":[]},{"seq":20,"name":"Filling","machine_type":"filler","process_min":0,"setup_min":10,"min_gap_after":0,"skill":"filling","depends_on":[10]},{"seq":30,"name":"Capping & Labeling","machine_type":"capper","process_min":0,"setup_min":5,"min_gap_after":0,"skill":"packing","depends_on":[20]}]'),
('SKU-AJ-1L','Apple Juice 1L','cap-orange','[{"material":"MAT-APPLE","qty_per_unit":0.9},{"material":"MAT-BOTTLE-1L","qty_per_unit":1},{"material":"MAT-CAP-ORANGE","qty_per_unit":1}]',
 '[{"seq":10,"name":"Mixing","machine_type":"mixer","process_min":20,"setup_min":5,"min_gap_after":10,"skill":"mixing","depends_on":[]},{"seq":20,"name":"Filling","machine_type":"filler","process_min":0,"setup_min":10,"min_gap_after":0,"skill":"filling","depends_on":[10]},{"seq":30,"name":"Capping & Labeling","machine_type":"capper","process_min":0,"setup_min":5,"min_gap_after":0,"skill":"packing","depends_on":[20]}]'),
('SKU-GJ-1L','Grape Juice 1L','cap-blue','[{"material":"MAT-GRAPE","qty_per_unit":0.9},{"material":"MAT-BOTTLE-1L","qty_per_unit":1},{"material":"MAT-CAP-BLUE","qty_per_unit":1}]',
 '[{"seq":10,"name":"Mixing","machine_type":"mixer","process_min":15,"setup_min":5,"min_gap_after":10,"skill":"mixing","depends_on":[]},{"seq":20,"name":"Filling","machine_type":"filler","process_min":0,"setup_min":10,"min_gap_after":0,"skill":"filling","depends_on":[10]},{"seq":30,"name":"Capping & Labeling","machine_type":"capper","process_min":0,"setup_min":5,"min_gap_after":0,"skill":"packing","depends_on":[20]}]'),
('SKU-MJ-500','Mango Nectar 500ml','cap-green','[{"material":"MAT-MANGO","qty_per_unit":0.45},{"material":"MAT-BOTTLE-500","qty_per_unit":1},{"material":"MAT-CAP-GREEN","qty_per_unit":1}]',
 '[{"seq":10,"name":"Mixing","machine_type":"mixer","process_min":25,"setup_min":5,"min_gap_after":15,"skill":"mixing","depends_on":[]},{"seq":20,"name":"Filling","machine_type":"filler","process_min":0,"setup_min":15,"min_gap_after":0,"skill":"filling","depends_on":[10]},{"seq":30,"name":"Capping & Labeling","machine_type":"capper","process_min":0,"setup_min":5,"min_gap_after":0,"skill":"packing","depends_on":[20]}]');
insert into public.products (sku, name, setup_family, bom_status, recipe_status, bom, routing) values
('SKU-LM-1L','Lemonade 1L','cap-yellow','draft','pending','[]','[]');

insert into public.materials (code, name, uom, on_hand, on_hold, expected_qty, expected_at) values
('MAT-ORANGE','Orange concentrate','L',12000,0,0,null),
('MAT-APPLE','Apple concentrate','L',3000,500,6000, now() + interval '2 days'),
('MAT-GRAPE','Grape concentrate','L',9000,0,0,null),
('MAT-MANGO','Mango pulp','kg',4000,0,0,null),
('MAT-BOTTLE-1L','PET bottle 1L','ea',40000,0,0,null),
('MAT-BOTTLE-500','PET bottle 500ml','ea',15000,0,0,null),
('MAT-CAP-BLUE','Cap blue','ea',30000,0,0,null),
('MAT-CAP-ORANGE','Cap orange','ea',12000,0,0,null),
('MAT-CAP-GREEN','Cap green','ea',15000,0,0,null);

insert into public.machines (code, name, machine_type, line, rate_per_hour, status) values
('MX-01','Mixer 01','mixer','Line 1',6000,'running'),
('MX-02','Mixer 02','mixer','Line 2',4500,'running'),
('FL-01','Filler 01','filler','Line 1',3000,'running'),
('FL-02','Filler 02 (high speed)','filler','Line 2',4200,'running'),
('CP-01','Capper 01','capper','Line 1',3500,'running'),
('CP-02','Capper 02','capper','Line 2',3200,'down');
update public.machines set repair_eta = now() + interval '6 hours' where code = 'CP-02';

insert into public.shifts (name, start_hour, end_hour, break_start_hour, break_minutes) values
('Morning',6,14,10,30),('Evening',14,22,18,30);

insert into public.operators (name, skills, shift_name, available) values
('Ahmad K.','{mixing,filling}','Morning',true),
('Lina S.','{filling,packing}','Morning',true),
('Omar R.','{packing}','Morning',true),
('Sara M.','{mixing}','Evening',true),
('Yousef A.','{filling,packing}','Evening',true),
('Rami H.','{packing,mixing}','Evening',false);

insert into public.maintenance_events (machine_code, kind, starts_at, ends_at, note) values
('FL-01','planned', date_trunc('day', now()) + interval '1 day 10 hours', date_trunc('day', now()) + interval '1 day 12 hours','Nozzle PM'),
('CP-02','failure', now() - interval '1 hour', now() + interval '6 hours','Torque head failure');

insert into public.changeovers (from_family, to_family, minutes) values
('cap-blue','cap-orange',30),('cap-orange','cap-blue',30),('cap-blue','cap-green',40),('cap-green','cap-blue',40),
('cap-orange','cap-green',35),('cap-green','cap-orange',35);

insert into public.production_orders (po_number, sku, quantity, due_date, priority, status) values
('PO-001','SKU-OJ-1L',6000, now() + interval '2 days', 2, 'released'),
('PO-002','SKU-AJ-1L',5000, now() + interval '3 days', 3, 'released'),
('PO-003','SKU-GJ-1L',4000, now() + interval '2 days 12 hours', 3, 'released'),
('PO-004','SKU-MJ-500',8000, now() + interval '1 day 18 hours', 1, 'released'),
('PO-005','SKU-OJ-1L',3000, now() + interval '4 days', 4, 'released'),
('PO-006','SKU-LM-1L',2000, now() + interval '3 days', 3, 'released');

insert into public.business_rules (name, description, criterion, direction, rule_priority, conflict_policy, active) values
('Earliest due date first','Orders with the nearest delivery date are sequenced first.','due_date','asc',1,null,true),
('Production priority','Higher production priority (1 = highest) breaks due-date ties.','priority','asc',2,null,true),
('Group by setup family','Sequence orders with the same cap / setup family together to reduce changeovers.','changeover','asc',3,'protect_due_dates',true),
('Shortest processing time','Shorter orders first when other criteria are equal.','processing_time','asc',4,null,false);

insert into public.integration_sources (key, name, provider_system, data_scope) values
('oms','OMS','MES Command Central','Production orders, quantities, due dates, priorities'),
('wms','WMS','MES Command Central','Inventory availability, material lots, material status'),
('rms','RMS','Product Lifecycle Command','Recipe definitions, operation parameters, processing times'),
('routing','Routing','Product Lifecycle Command','Operation sequence, dependencies, setup and time constraints'),
('machines','Machine Microservices','MES Command Center','Machine status, availability, production speed, downtime'),
('workforce','Workforce / Labor','Production Command Center','Operators, skills, certifications, shifts, breaks'),
('maintenance','Maintenance System','Command Center Digital','Planned maintenance, failures, estimated repair time'),
('bom','BOM / Product Master','Product Lifecycle Command','Bill of materials, product definitions, material requirements');
