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
