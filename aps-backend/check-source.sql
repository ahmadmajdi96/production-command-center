DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions'
  ) THEN
    RAISE EXCEPTION 'Expected pgcrypto in extensions';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  ) <> 16 THEN
    RAISE EXCEPTION 'Expected all 16 APS relations to use row-level security';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.schedule_versions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.schedule_versions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.schedule_versions', 'UPDATE')
     OR has_table_privilege('anon', 'public.schedule_versions', 'SELECT') THEN
    RAISE EXCEPTION 'APS schedule permissions do not match the source substrate';
  END IF;

  IF (SELECT count(*) FROM public.production_orders) <> 6
     OR (SELECT count(*) FROM public.integration_sources) <> 10
     OR (SELECT value FROM public.app_settings WHERE key = 'plant_timezone') IS DISTINCT FROM '"UTC"'::jsonb THEN
    RAISE EXCEPTION 'Expected isolated demo orders, source mappings and timezone configuration';
  END IF;
END
$$;

SET ROLE service_role;

INSERT INTO public.schedule_versions (id, version_no, created_by, horizon_start, input_snapshot)
VALUES ('41bd9501-b7ec-4f36-a662-cc5d09e8c176', 1, 'planner@example.test', now(), '{}'::jsonb);

INSERT INTO public.approvals (version_id, decision, signer_email, meaning)
VALUES ('41bd9501-b7ec-4f36-a662-cc5d09e8c176', 'approved', 'signer@example.test', 'Test approval');

INSERT INTO public.integration_events (source_system, idempotency_key, outcome)
VALUES ('mes', 'aps-test-delivery', 'accepted');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.integration_events (source_system, idempotency_key, outcome)
    VALUES ('mes', 'aps-test-delivery', 'accepted');
    RAISE EXCEPTION 'Duplicate integration idempotency key was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$$;

INSERT INTO public.audit_log (actor, action, entity)
VALUES
  ('planner@example.test', 'created', 'schedule_version'),
  ('signer@example.test', 'signed', 'schedule_version');

DO $$
DECLARE
  blocked_message text;
BEGIN
  BEGIN
    UPDATE public.audit_log SET action = 'unlogged';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS blocked_message = MESSAGE_TEXT;
  END;
  IF blocked_message IS DISTINCT FROM 'Audit records are append-only' THEN
    RAISE EXCEPTION 'Audit row update did not raise the expected append-only guard';
  END IF;

  blocked_message := NULL;
  BEGIN
    DELETE FROM public.audit_log;
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS blocked_message = MESSAGE_TEXT;
  END;
  IF blocked_message IS DISTINCT FROM 'Audit records are append-only' THEN
    RAISE EXCEPTION 'Audit row delete did not raise the expected append-only guard';
  END IF;
END
$$;

RESET ROLE;
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.verify_audit_chain() WHERE ok AND checked = 2 AND broken_seq IS NULL
  ) THEN
    RAISE EXCEPTION 'Two synthetic audit rows did not verify as a chain';
  END IF;
END
$$;

RESET ROLE;
SELECT 'PASS: schema, row policies, demo inputs, version and approval links, event uniqueness, audit update/delete guards and chain verification' AS evidence;
