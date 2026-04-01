"use server";

import { createClient } from "@/lib/supabase/server";
import {
  isIncentiveEligible,
  type ProfileRow,
} from "@/types/incentive";
import { revalidatePath } from "next/cache";

function currentYearMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export type SubmitIncentiveSalesResult =
  | { ok: true }
  | { ok: false; message: string };

export async function submitIncentiveSales(
  salesAmountYen: number,
  yearMonth?: string,
): Promise<SubmitIncentiveSalesResult> {
  const ym = yearMonth ?? currentYearMonth();

  if (!Number.isFinite(salesAmountYen) || salesAmountYen < 0) {
    return { ok: false, message: "売上金額が不正です。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { ok: false, message: "ログインが必要です。" };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, is_sales_target, is_service_target, role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return { ok: false, message: "プロフィールが見つかりません。" };
  }

  const p = profile as Pick<
    ProfileRow,
    "id" | "is_sales_target" | "is_service_target" | "role"
  >;
  if (!isIncentiveEligible(p)) {
    return { ok: false, message: "インセンティブ対象外です。" };
  }

  const { data: rateRow, error: rateErr } = await supabase
    .from("incentive_rates")
    .select("rate, formula_type")
    .eq("user_id", user.id)
    .eq("year_month", ym)
    .maybeSingle();

  if (rateErr) {
    return { ok: false, message: "率の取得に失敗しました。" };
  }
  if (!rateRow) {
    return { ok: false, message: "今月のインセンティブ率が未設定です。" };
  }

  const rate = Number(rateRow.rate);
  if (!Number.isFinite(rate)) {
    return { ok: false, message: "率の値が不正です。" };
  }

  const { data: existing, error: exErr } = await supabase
    .from("incentive_submissions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("year_month", ym)
    .maybeSingle();

  if (exErr) {
    return { ok: false, message: "既存申請の確認に失敗しました。" };
  }

  if (existing) {
    const st = (existing as { status: string }).status;
    if (st === "submitted" || st === "approved") {
      return { ok: false, message: "提出済みのため変更できません。" };
    }
  }

  const payload = {
    user_id: user.id,
    year_month: ym,
    sales_amount: salesAmountYen,
    rate_snapshot: rate,
    status: "submitted" as const,
    submitted_at: new Date().toISOString(),
  };

  if (existing) {
    const { error: upErr } = await supabase
      .from("incentive_submissions")
      .update(payload)
      .eq("id", (existing as { id: string }).id);

    if (upErr) {
      return { ok: false, message: "更新に失敗しました。" };
    }
  } else {
    const { error: insErr } = await supabase
      .from("incentive_submissions")
      .insert(payload);

    if (insErr) {
      return { ok: false, message: "登録に失敗しました。" };
    }
  }

  revalidatePath("/my/incentive");
  revalidatePath("/incentives");
  return { ok: true };
}
