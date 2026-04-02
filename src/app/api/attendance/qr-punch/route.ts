import { verifyAttendanceQrToken } from "@/lib/attendance-qr-token";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function redirectWith(
  req: Request,
  query: Record<string, string>,
): NextResponse {
  const origin = new URL(req.url).origin;
  const u = new URL("/my/attendance", origin);
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const type = url.searchParams.get("type");
  if (type !== "clock_in" && type !== "clock_out") {
    return redirectWith(req, { error: "type" });
  }

  const payload = verifyAttendanceQrToken(token);
  if (!payload) {
    return redirectWith(req, { error: "token" });
  }
  if (payload.pt !== type) {
    return redirectWith(req, { error: "mismatch" });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbAnon) {
    return redirectWith(req, { error: "config" });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(sbUrl, sbAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== payload.uid) {
    const login = new URL("/login", new URL(req.url).origin);
    login.searchParams.set("next", `${url.pathname}?${url.searchParams}`);
    return NextResponse.redirect(login);
  }

  const { error } = await supabase.from("attendance_punches").insert({
    user_id: user.id,
    punch_type: type,
    source: "qr",
  });

  if (error) {
    return redirectWith(req, { error: "db" });
  }

  return redirectWith(req, { punched: type });
}
