create extension if not exists pgcrypto with schema extensions;

alter table public.products
  add column bom_revision text, add column routing_revision text, add column recipe_revision text,
  add column effective_from timestamptz, add column quality_hold boolean not null default false, add column quality_note text;
alter table public.materials
  add column as_of timestamptz, add column quality_status text not null default 'released';
alter table public.production_orders
  add column order_revision int not null default 1, add column sales_order_ref text, add column source_updated_at timestamptz;
alter table public.business_rules
  add column code text, add column domain text not null default 'planning';
update public.business_rules b set code = 'APS-PLAN-' || lpad(x.rn::text, 3, '0')
  from (select id, row_number() over (order by rule_priority, name) rn from public.business_rules) x where x.id = b.id;
alter table public.business_rules add constraint business_rules_code_key unique (code);
alter table public.schedule_versions
  add column approved_at timestamptz, add column dispatch_status text not null default 'not_released',
  add column released_at timestamptz, add column acknowledged_at timestamptz, add column acknowledged_by text,
  add column input_snapshot jsonb;

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  event_id text, correlation_id text, source_system text not null, entity_id text, entity_revision text,
  schema_version text not null default '1', idempotency_key text unique, occurred_at timestamptz,
  received_at timestamptz not null default now(), records int not null default 0,
  outcome text not null, error text
);
create table public.execution_feedback (
  id uuid primary key default gen_random_uuid(),
  po_number text not null, seq int not null, version_no int, status text not null,
  actual_start timestamptz, actual_end timestamptz, good_qty numeric, scrap_qty numeric,
  reported_at timestamptz, received_at timestamptz not null default now(),
  unique (po_number, seq)
);
create table public.app_settings (
  key text primary key, value jsonb not null, updated_by text, updated_at timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['integration_events','execution_feedback','app_settings'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Signed-in users can read" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;
insert into public.app_settings (key, value) values ('plant_timezone', '"UTC"'), ('audit_retention_years', '10');
insert into public.integration_sources (key, name, provider_system, data_scope) values
('qms','QMS / QC','CORTA QC System','Quality holds and dispositions for products and materials'),
('mes','MES Execution','MES Command Central','Schedule acknowledgements and execution actuals');

-- Tamper-evident audit trail: hash chain, append-only.
alter table public.audit_log add column seq bigint generated always as identity, add column prev_hash text, add column hash text;
create or replace function public.audit_row_hash(r public.audit_log, prev text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(prev,'') || '|' || r.seq || '|' || r.at::text || '|' || r.actor || '|' || r.action || '|' || r.entity || '|' ||
    coalesce(r.entity_id,'') || '|' || coalesce(r.before_value::text,'') || '|' || coalesce(r.after_value::text,'') || '|' || coalesce(r.reason,''), 'sha256'), 'hex')
$$;
do $$
declare r public.audit_log; prev text := null;
begin
  for r in select * from public.audit_log order by seq loop
    update public.audit_log set prev_hash = prev, hash = public.audit_row_hash(r, prev) where id = r.id;
    prev := public.audit_row_hash(r, prev);
  end loop;
end $$;
create or replace function public.audit_chain_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(4242001);
  new.at := now();
  select hash into new.prev_hash from public.audit_log order by seq desc limit 1;
  new.hash := public.audit_row_hash(new, new.prev_hash);
  return new;
end $$;
create trigger audit_chain_insert before insert on public.audit_log for each row execute function public.audit_chain_insert();
create or replace function public.audit_block_change() returns trigger
language plpgsql as $$ begin raise exception 'Audit records are append-only'; end $$;
create trigger audit_block_change before update or delete on public.audit_log for each row execute function public.audit_block_change();
create or replace function public.verify_audit_chain() returns table (ok boolean, checked int, broken_seq bigint)
language plpgsql stable security definer set search_path = public as $$
declare r public.audit_log; prev text := null; n int := 0;
begin
  for r in select * from public.audit_log order by seq loop
    n := n + 1;
    if r.prev_hash is distinct from prev or r.hash is distinct from public.audit_row_hash(r, prev) then
      ok := false; checked := n; broken_seq := r.seq; return next; return;
    end if;
    prev := r.hash;
  end loop;
  ok := true; checked := n; broken_seq := null; return next;
end $$;
revoke all on function public.verify_audit_chain() from public, anon;
grant execute on function public.verify_audit_chain() to authenticated;