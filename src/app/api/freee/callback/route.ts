import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeAuthorizationCode } from "@/lib/freee-hr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return Response.redirect(
      `/my/payslip?freee_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return Response.redirect("/my/payslip?freee_error=no_code");
  }

  const companyId = process.env.FREEE_COMPANY_ID?.trim();
  if (!companyId) {
    return Response.redirect("/my/payslip?freee_error=no_company_env");
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const admin = createAdminClient();
    const { error } = await admin.from("freee_tokens").upsert(
      {
        freee_company_id: companyId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "freee_company_id" },
    );

    if (error) {
      console.error("[freee callback]", error);
      return Response.redirect("/my/payslip?freee_error=save_failed");
    }
  } catch (e) {
    console.error("[freee callback]", e);
    const msg = e instanceof Error ? e.message : "token_failed";
    return Response.redirect(
      `/my/payslip?freee_error=${encodeURIComponent(msg)}`,
    );
  }

  return Response.redirect("/my/payslip?freee=connected");
}
