DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (has_table_privilege('authenticated', c.oid, 'SELECT')
           OR has_table_privilege('anon', c.oid, 'SELECT'))
  ) OR has_function_privilege('authenticated', 'public.verify_audit_chain()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Browser identities can still read APS projections or call the verifier';
  END IF;

  IF has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE') THEN
    RAISE EXCEPTION 'APS service role can still truncate the audit log';
  END IF;
END
$$;

SET ROLE service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.verify_audit_chain() WHERE ok AND checked = 2 AND broken_seq IS NULL
  ) THEN
    RAISE EXCEPTION 'APS service role could not verify the existing audit chain';
  END IF;

  IF (SELECT count(*) FROM public.schedule_versions) <> 1 THEN
    RAISE EXCEPTION 'APS service role lost its planning data read';
  END IF;
END
$$;

RESET ROLE;
SELECT 'PASS: APS service access, direct browser read removal and audit TRUNCATE denial' AS evidence;
