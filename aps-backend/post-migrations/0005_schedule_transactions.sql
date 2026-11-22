-- Historical duplicates need reconciliation before this constraint is installed.
CREATE UNIQUE INDEX aps_schedule_version_number ON public.schedule_versions (version_no);

CREATE FUNCTION public.aps_create_schedule_draft(actor_email text, draft jsonb)
RETURNS TABLE (id uuid, version_no integer)
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  created public.schedule_versions%ROWTYPE;
  latest public.schedule_versions%ROWTYPE;
  approved_parent uuid;
  draft_kind text := CASE WHEN draft->>'trigger' = 'new_plan' THEN 'generated' ELSE 'rescheduled' END;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(4242002);
  SELECT * INTO latest FROM public.schedule_versions AS v ORDER BY v.version_no DESC LIMIT 1;
  SELECT v.id INTO approved_parent FROM public.schedule_versions AS v
    WHERE v.status = 'approved' ORDER BY v.version_no DESC LIMIT 1;

  INSERT INTO public.schedule_versions (
    version_no, parent_id, kind, trigger, reason, created_by, horizon_start,
    items, conflicts, metrics, rules_applied, feasibility, input_snapshot
  ) VALUES (
    coalesce(latest.version_no, 0) + 1, coalesce(approved_parent, latest.id), draft_kind,
    draft->>'trigger', draft->>'reason', actor_email, (draft->>'horizon_start')::timestamptz,
    draft->'items', draft->'conflicts', draft->'metrics', draft->'rules_applied',
    draft->'feasibility', draft->'input_snapshot'
  ) RETURNING * INTO created;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, after_value, reason)
  VALUES (actor_email, CASE WHEN draft_kind = 'generated' THEN 'schedule.created' ELSE 'schedule.rescheduled' END,
    'schedule_version', 'v' || created.version_no,
    (created.metrics - 'sequence') || jsonb_build_object('conflicts', jsonb_array_length(created.conflicts)),
    created.reason);
  RETURN QUERY SELECT created.id, created.version_no;
END;
$$;

CREATE FUNCTION public.aps_transition_schedule(
  target_id uuid, actor_email text, decision text, signer_name text DEFAULT NULL, comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  target public.schedule_versions%ROWTYPE;
  next_status text;
  audit_action text;
  meaning text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(4242002);
  SELECT * INTO target FROM public.schedule_versions WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This schedule version no longer exists.';
  END IF;

  IF decision = 'submit' THEN
    IF target.status NOT IN ('draft', 'rejected') THEN
      RAISE EXCEPTION 'Only draft or rejected versions can be submitted.';
    END IF;
    next_status := 'pending_approval';
    audit_action := 'schedule.submitted';
  ELSIF decision IN ('approved', 'rejected') THEN
    IF target.status <> 'pending_approval' THEN
      RAISE EXCEPTION 'This version is not awaiting approval.';
    END IF;
    IF decision = 'rejected' AND length(coalesce(btrim(comment), '')) < 3 THEN
      RAISE EXCEPTION 'A rejection reason is required.';
    END IF;
    IF decision = 'approved' AND EXISTS (
      SELECT 1 FROM public.schedule_versions WHERE status = 'approved' AND version_no > target.version_no
    ) THEN
      RAISE EXCEPTION 'A newer schedule is already released. Generate a new draft to replace it.';
    END IF;
    next_status := decision;
    audit_action := 'schedule.' || decision;
    meaning := CASE WHEN decision = 'approved' THEN 'I approve this production schedule for execution'
      ELSE 'I reject this production schedule' END;
    INSERT INTO public.approvals (version_id, decision, signer_email, signer_name, meaning, comment)
    VALUES (target_id, decision, actor_email, signer_name, meaning, comment);
  ELSE
    RAISE EXCEPTION 'Unknown schedule transition.';
  END IF;

  IF next_status = 'approved' THEN
    UPDATE public.schedule_versions SET status = 'superseded', dispatch_status = 'superseded'
    WHERE status = 'approved';
    UPDATE public.schedule_versions
    SET status = next_status, approved_at = now(), dispatch_status = 'released', released_at = now()
    WHERE id = target_id;
  ELSE
    UPDATE public.schedule_versions SET status = next_status WHERE id = target_id;
  END IF;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, before_value, after_value, reason)
  VALUES (actor_email, audit_action, 'schedule_version', 'v' || target.version_no,
    jsonb_build_object('status', target.status),
    jsonb_strip_nulls(jsonb_build_object('status', next_status, 'signature', meaning)), comment);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aps_create_schedule_draft(text, jsonb),
  public.aps_transition_schedule(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aps_create_schedule_draft(text, jsonb),
  public.aps_transition_schedule(uuid, text, text, text, text) TO service_role;
