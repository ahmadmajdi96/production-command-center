<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## PMS rules
- PMS contains the complete Planning and Workforce sections of MES Command Center, including their product, order, user and skill detail pages; copy MES source rather than rewriting to preserve its features and behavior.
- PMS has no backend of its own: it talks to the MES Lovable Cloud backend via publishable URL/key in `src/integrations/supabase/mes-backend.ts`. Never add migrations here; schema changes belong in the MES project.
- Links to MES-only records render via `MesRef` (plain text) because those pages don't exist in PMS.
- Privileged MES clients read the server-only `MES_SERVICE_ROLE_KEY` secret first, with the managed service-role variable as fallback, because PMS shares MES credentials without provisioning its own backend.

## Unified APS boundaries
- Preserve the Production Command Center shell, styling, existing Planning and Workforce routes, and shared MES authorization. New APS routes use those components and sit under /aps.
- The existing MES identity is the shared sign-in. Grant APS access separately through the Command Access Hub using a confirmed MES email. A grant for either workspace does not grant the other.
- Keep APS database reads and writes in server functions using the explicit APS connection. Verify the relevant Hub resource before each operation. The browser never receives the APS service credential or queries its tables directly.
- Keep the APS migration history under aps-backend for the dedicated planning database. Follow its documented cutover order. Never apply APS SQL to the shared MES database.
- MES retains ownership of operational orders and Workforce records. APS owns planning inputs received through its integration contracts, schedule drafts and versions, approval signatures, and its audit trail.
