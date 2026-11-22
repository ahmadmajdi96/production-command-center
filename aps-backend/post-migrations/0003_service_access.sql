-- Run against the dedicated APS database after the original Drizzle history.
-- Keep the original authenticated verifier available during coexistence.
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO service_role;

-- The original insert/update/delete triggers do not fire for TRUNCATE.
REVOKE TRUNCATE ON TABLE public.audit_log FROM service_role;
