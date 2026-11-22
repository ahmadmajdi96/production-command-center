import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The Hub matches access by email, so require current proof of email ownership. */
export const requireApsIdentity = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.auth.getUser();
    const user = data.user;
    const email = user?.email?.trim().toLowerCase();
    const claimedEmail = context.claims.email?.trim().toLowerCase();
    if (
      error ||
      !user ||
      user.id !== context.userId ||
      !user.email_confirmed_at ||
      !email ||
      email !== claimedEmail
    ) {
      throw new Error("Use a confirmed MES email to access advanced planning.");
    }
    return next({ context: { apsEmail: email, apsUserId: user.id } });
  });
