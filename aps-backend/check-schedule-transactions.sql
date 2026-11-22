-- Run after the parallel creation and signing steps in check-local.sh.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.aps_create_schedule_draft(text,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.aps_transition_schedule(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Direct schedule command access must be restricted to the service role';
  END IF;
END;
$$;

-- Force a failure after the signature and status changes have run.
CREATE FUNCTION public.aps_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action = 'schedule.approved' THEN
    RAISE EXCEPTION 'APS test: audit insert failed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aps_test_fail_audit BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.aps_test_fail_audit();

SET ROLE service_role;
DO $$
DECLARE
  first_version uuid;
  second_version uuid;
  failure_message text;
BEGIN
  SELECT id INTO STRICT first_version FROM public.schedule_versions WHERE version_no = 2;
  SELECT id INTO STRICT second_version FROM public.schedule_versions WHERE version_no = 3;

  IF (SELECT count(*) FROM public.approvals WHERE version_id = first_version) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.schedule_versions WHERE id = first_version
      AND status = 'approved' AND dispatch_status = 'released')
    OR (SELECT count(*) FROM public.audit_log WHERE entity_id = 'v2' AND action = 'schedule.approved') <> 1 THEN
    RAISE EXCEPTION 'Concurrent approval did not leave one signature, release and audit event';
  END IF;

  PERFORM public.aps_transition_schedule(second_version, 'planner@example.test', 'submit');
  BEGIN
    PERFORM public.aps_transition_schedule(second_version, 'signer@example.test', 'approved');
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS failure_message = MESSAGE_TEXT;
  END;
  IF failure_message IS DISTINCT FROM 'APS test: audit insert failed'
    OR EXISTS (SELECT 1 FROM public.approvals WHERE version_id = second_version)
    OR NOT EXISTS (SELECT 1 FROM public.schedule_versions WHERE id = second_version
      AND status = 'pending_approval' AND released_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.schedule_versions WHERE id = first_version AND status = 'approved') THEN
    RAISE EXCEPTION 'Audit failure did not roll back both status changes and the signature';
  END IF;

  PERFORM public.aps_transition_schedule(second_version, 'signer@example.test', 'rejected', 'Test signer', 'Revise the plan');
  IF NOT EXISTS (SELECT 1 FROM public.approvals WHERE version_id = second_version
    AND decision = 'rejected' AND comment = 'Revise the plan')
    OR NOT EXISTS (SELECT 1 FROM public.schedule_versions WHERE id = second_version AND status = 'rejected')
    OR NOT EXISTS (SELECT 1 FROM public.verify_audit_chain() WHERE ok) THEN
    RAISE EXCEPTION 'Rejection or audit chain verification failed';
  END IF;
END;
$$;
RESET ROLE;
SELECT 'PASS: concurrent drafts, competing approvals, service-only commands, audited rollback and rejection' AS evidence;
