import { FREEE_HR_SCOPES } from "@/lib/freee-hr";

export async function GET() {
  const clientId = process.env.FREEE_CLIENT_ID;
  const redirectUri = process.env.FREEE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return Response.json(
      { error: "FREEE_CLIENT_ID / FREEE_REDIRECT_URI が未設定です" },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: FREEE_HR_SCOPES,
  });

  return Response.redirect(
    `https://accounts.secure.freee.co.jp/public_api/authorize?${params.toString()}`,
  );
}
