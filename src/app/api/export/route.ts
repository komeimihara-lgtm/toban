import { getProfile, getSessionUser, isOwnerOrApprover } from "@/lib/api-auth";
import {
  buildAttendanceWorkbook,
  buildExpenseWorkbook,
  buildIncentiveWorkbook,
  type ExportType,
} from "@/lib/labor-export";
import { NextResponse } from "next/server";
import JSZip from "jszip";

export const maxDuration = 120;

/** Content-Disposition 用（ASCII） */
function fileAttachmentName(type: ExportType, y: number, m: number) {
  const mm = String(m).padStart(2, "0");
  if (type === "attendance") return `lenard_attendance_${y}_${mm}.xlsx`;
  if (type === "incentive") return `lenard_incentive_${y}_${mm}.xlsx`;
  if (type === "expense") return `lenard_expense_${y}_${mm}.xlsx`;
  return `lenard_export_all_${y}_${mm}.zip`;
}

/** ZIP 内の人が読むファイル名 */
function fileLabelJp(type: Exclude<ExportType, "all">, y: number, m: number) {
  const mm = String(m).padStart(2, "0");
  if (type === "attendance") return `lenard_勤怠_${y}年${mm}月.xlsx`;
  if (type === "incentive") return `lenard_インセンティブ_${y}年${mm}月.xlsx`;
  return `lenard_経費_${y}年${mm}月.xlsx`;
}

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 403 });
    }

    if (!isOwnerOrApprover(profile.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const url = new URL(req.url);
    const type = (url.searchParams.get("type") ?? "") as ExportType;
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));

    if (!["attendance", "incentive", "expense", "all"].includes(type)) {
      return NextResponse.json(
        { error: "type は attendance | incentive | expense | all を指定してください" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "year, month（1〜12）が必要です" }, { status: 400 });
    }

    const companyId = profile.company_id;

    const { data: depts } = await supabase.from("departments").select("id, name").eq("company_id", companyId);
    const nameByDept = new Map<string | null, string>();
    for (const d of depts ?? []) {
      const row = d as { id: string; name: string };
      nameByDept.set(row.id, row.name);
    }

    const { data: allNames } = await supabase
      .from("employees")
      .select("auth_user_id, name")
      .eq("company_id", companyId);
    const nameById = new Map<string, string | null>();
    for (const r of allNames ?? []) {
      const row = r as { auth_user_id: string; name: string | null };
      nameById.set(row.auth_user_id, row.name);
    }

    const headers = new Headers();

    if (type === "attendance") {
      const buf = await buildAttendanceWorkbook(supabase, companyId, year, month, nameByDept);
      const name = fileAttachmentName("attendance", year, month);
      headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      headers.set("Content-Disposition", `attachment; filename="${name}"`);
      return new NextResponse(new Uint8Array(buf), { headers });
    }

    if (type === "incentive") {
      const buf = await buildIncentiveWorkbook(supabase, companyId, year, month, nameById, nameByDept);
      const name = fileAttachmentName("incentive", year, month);
      headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      headers.set("Content-Disposition", `attachment; filename="${name}"`);
      return new NextResponse(new Uint8Array(buf), { headers });
    }

    if (type === "expense") {
      const buf = await buildExpenseWorkbook(supabase, companyId, year, month, nameById);
      const name = fileAttachmentName("expense", year, month);
      headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      headers.set("Content-Disposition", `attachment; filename="${name}"`);
      return new NextResponse(new Uint8Array(buf), { headers });
    }

    const zip = new JSZip();
    const a = await buildAttendanceWorkbook(supabase, companyId, year, month, nameByDept);
    const i = await buildIncentiveWorkbook(supabase, companyId, year, month, nameById, nameByDept);
    const e = await buildExpenseWorkbook(supabase, companyId, year, month, nameById);
    zip.file(fileLabelJp("attendance", year, month), a);
    zip.file(fileLabelJp("incentive", year, month), i);
    zip.file(fileLabelJp("expense", year, month), e);
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    const zipName = fileAttachmentName("all", year, month);
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${zipName}"`);
    return new NextResponse(new Uint8Array(zipBuf), { headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
