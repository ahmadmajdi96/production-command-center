-- Apply at combined application cutover, after the original APS browser client stops using this database.
REVOKE ALL PRIVILEGES ON TABLE
  public.products,
  public.materials,
  public.machines,
  public.shifts,
  public.operators,
  public.maintenance_events,
  public.changeovers,
  public.production_orders,
  public.business_rules,
  public.schedule_versions,
  public.approvals,
  public.audit_log,
  public.integration_sources,
  public.integration_events,
  public.execution_feedback,
  public.app_settings
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.verify_audit_chain() FROM authenticated;
