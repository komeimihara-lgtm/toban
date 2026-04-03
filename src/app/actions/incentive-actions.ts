"use server";

import { createClient } from "@/lib/supabase/server";
import {
  computeNetProfitExTax,
  isIncentiveEligible,
  type IncentiveDealRole,
  type ProfileRow,
} from "@/types/incentive";
import { revalidatePath } from "next/cache";

function currentYearMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

const ALLOWED_DEAL_ROLES: IncentiveDealRole[] = ["appo", "closer"];

export type SubmitIncentiveSalesResult =
  | { ok: true }
  | { ok: false; message: string };

export type IncentiveSubmitPayload = {
  sellingPriceTaxIn: number;
  actualCost: number;
  serviceCostDeduction: number;
  dealRole: IncentiveDealRole;
  yearMonth?: string;
  productId?: string | null;
};

export async function saveIncentiveDraft(
  payload: IncentiveSubmitPayload,
): Promise<SubmitIncentiveSalesResult> {
  const {
    sellingPriceTaxIn,
    actualCost,
    serviceCostDeduction,
    dealRole,
    yearMonth: ymArg,
    productId,
  } = payload;
  const ym = ymArg ?? currentYearMonth();

  if (!ALLOWED_DEAL_ROLES.includes(dealRole)) {
    return { ok: false, message: "役割の値が不正です。" };
  }

  if (
    !Number.isFinite(sellingPriceTaxIn) ||
    !Number.isFinite(actualCost) ||
    !Number.isFinite(serviceCostDeduction) ||
    sellingPriceTaxIn < 0 ||
    actualCost < 0 ||
    serviceCostDeduction < 0
  ) {
    return { ok: false, message: "金額の入力が不正です。" };
  }

  const netProfit = computeNetProfitExTax(
    sellingPriceTaxIn,
    actualCost,
    serviceCostDeduction,
  );
  if (!Number.isFinite(netProfit)) {
    return { ok: false, message: "純利益の計算に失敗しました。" };
  }
  const payoutBase = Math.max(0, netProfit);

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { ok: false, message: "ログインが必要です。" };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("employees")
    .select("id, is_sales_target, is_service_target, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

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

  const { data: rateRow } = await supabase
    .from("incentive_rates")
    .select("rate")
    .eq("user_id", user.id)
    .eq("year_month", ym)
    .maybeSingle();

  const rateSnap = rateRow ? Number(rateRow.rate) : null;

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
      return { ok: false, message: "提出済みのため下書き保存できません。" };
    }
  }

  const row = {
    user_id: user.id,
    year_month: ym,
    sales_amount: payoutBase,
    net_profit_ex_tax: netProfit,
    selling_price_tax_in: sellingPriceTaxIn,
    actual_cost: actualCost,
    service_cost_deduction: serviceCostDeduction,
    deal_role: dealRole,
    rate_snapshot: rateSnap,
    product_id: productId ?? null,
    status: "draft" as const,
    submitted_at: null as string | null,
  };

  if (existing) {
    const { error: upErr } = await supabase
      .from("incentive_submissions")
      .update(row)
      .eq("id", (existing as { id: string }).id);
    if (upErr) return { ok: false, message: "下書きの更新に失敗しました。" };
  } else {
    const { error: insErr } = await supabase.from("incentive_submissions").insert(row);
    if (insErr) return { ok: false, message: "下書きの保存に失敗しました。" };
  }

  revalidatePath("/my/incentive");
  revalidatePath("/incentives");
  return { ok: true };
}

export async function submitIncentiveSales(
  payload: IncentiveSubmitPayload,
): Promise<SubmitIncentiveSalesResult> {
  const {
    sellingPriceTaxIn,
    actualCost,
    serviceCostDeduction,
    dealRole,
    yearMonth: ymArg,
    productId,
  } = payload;
  const ym = ymArg ?? currentYearMonth();

  if (!ALLOWED_DEAL_ROLES.includes(dealRole)) {
    return { ok: false, message: "役割の値が不正です。" };
  }

  if (
    !Number.isFinite(sellingPriceTaxIn) ||
    !Number.isFinite(actualCost) ||
    !Number.isFinite(serviceCostDeduction) ||
    sellingPriceTaxIn < 0 ||
    actualCost < 0 ||
    serviceCostDeduction < 0
  ) {
    return { ok: false, message: "金額の入力が不正です。" };
  }

  const netProfit = computeNetProfitExTax(
    sellingPriceTaxIn,
    actualCost,
    serviceCostDeduction,
  );
  if (!Number.isFinite(netProfit)) {
    return { ok: false, message: "純利益の計算に失敗しました。" };
  }
  const payoutBase = Math.max(0, netProfit);

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { ok: false, message: "ログインが必要です。" };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("employees")
    .select("id, is_sales_target, is_service_target, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

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

  const payloadRow = {
    user_id: user.id,
    year_month: ym,
    sales_amount: payoutBase,
    net_profit_ex_tax: netProfit,
    selling_price_tax_in: sellingPriceTaxIn,
    actual_cost: actualCost,
    service_cost_deduction: serviceCostDeduction,
    deal_role: dealRole,
    product_id: productId ?? null,
    rate_snapshot: rate,
    status: "submitted" as const,
    submitted_at: new Date().toISOString(),
  };

  if (existing) {
    const { error: upErr } = await supabase
      .from("incentive_submissions")
      .update(payloadRow)
      .eq("id", (existing as { id: string }).id);

    if (upErr) {
      return { ok: false, message: "更新に失敗しました。" };
    }
  } else {
    const { error: insErr } = await supabase
      .from("incentive_submissions")
      .insert(payloadRow);

    if (insErr) {
      return { ok: false, message: "登録に失敗しました。" };
    }
  }

  revalidatePath("/my/incentive");
  revalidatePath("/incentives");
  return { ok: true };
}

/** マイページ用: 月間売上 × 率のみ（本人データのみ更新） */
export type SimpleIncentivePayload = {
  yearMonth: string;
  salesAmount: number;
};

export async function saveSimpleIncentiveDraft(
  payload: SimpleIncentivePayload,
): Promise<SubmitIncentiveSalesResult> {
  const { yearMonth, salesAmount } = payload;

  if (!Number.isFinite(salesAmount) || salesAmount < 0) {
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
    .from("employees")
    .select("id, is_sales_target, is_service_target")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return { ok: false, message: "プロフィールが見つかりません。" };
  }

  if (!isIncentiveEligible(profile as ProfileRow)) {
    return { ok: false, message: "インセンティブ対象外です。" };
  }

  const { data: rateRow } = await supabase
    .from("incentive_rates")
    .select("rate")
    .eq("user_id", user.id)
    .eq("year_month", yearMonth)
    .maybeSingle();

  if (!rateRow) {
    return { ok: false, message: "今月のインセンティブ率が未設定です。" };
  }

  const rateSnap = Number(rateRow.rate);
  if (!Number.isFinite(rateSnap)) {
    return { ok: false, message: "率の値が不正です。" };
  }

  const { data: existing, error: exErr } = await supabase
    .from("incentive_submissions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("year_month", yearMonth)
    .maybeSingle();

  if (exErr) {
    return { ok: false, message: "既存申請の確認に失敗しました。" };
  }

  if (existing) {
    const st = (existing as { status: string }).status;
    if (st === "submitted" || st === "approved") {
      return { ok: false, message: "提出済みのため下書き保存できません。" };
    }
  }

  const row = {
    user_id: user.id,
    year_month: yearMonth,
    sales_amount: salesAmount,
    rate_snapshot: rateSnap,
    status: "draft" as const,
    submitted_at: null as string | null,
    deal_role: null as string | null,
    product_id: null as string | null,
    selling_price_tax_in: null as number | null,
    actual_cost: null as number | null,
    service_cost_deduction: 0,
    net_profit_ex_tax: null as number | null,
  };

  if (existing) {
    const { error: upErr } = await supabase
      .from("incentive_submissions")
      .update(row)
      .eq("id", (existing as { id: string }).id);
    if (upErr) return { ok: false, message: "下書きの更新に失敗しました。" };
  } else {
    const { error: insErr } = await supabase.from("incentive_submissions").insert(row);
    if (insErr) return { ok: false, message: "下書きの保存に失敗しました。" };
  }

  revalidatePath("/my/incentive");
  revalidatePath("/incentives");
  return { ok: true };
}

export async function submitSimpleIncentive(
  payload: SimpleIncentivePayload,
): Promise<SubmitIncentiveSalesResult> {
  const { yearMonth, salesAmount } = payload;

  if (!Number.isFinite(salesAmount) || salesAmount < 0) {
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
    .from("employees")
    .select("id, is_sales_target, is_service_target")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return { ok: false, message: "プロフィールが見つかりません。" };
  }

  if (!isIncentiveEligible(profile as ProfileRow)) {
    return { ok: false, message: "インセンティブ対象外です。" };
  }

  const { data: rateRow, error: rateErr } = await supabase
    .from("incentive_rates")
    .select("rate")
    .eq("user_id", user.id)
    .eq("year_month", yearMonth)
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
    .eq("year_month", yearMonth)
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

  const payloadRow = {
    user_id: user.id,
    year_month: yearMonth,
    sales_amount: salesAmount,
    rate_snapshot: rate,
    deal_role: null as string | null,
    product_id: null as string | null,
    selling_price_tax_in: null as number | null,
    actual_cost: null as number | null,
    service_cost_deduction: 0,
    net_profit_ex_tax: null as number | null,
    status: "submitted" as const,
    submitted_at: new Date().toISOString(),
  };

  if (existing) {
    const { error: upErr } = await supabase
      .from("incentive_submissions")
      .update(payloadRow)
      .eq("id", (existing as { id: string }).id);
    if (upErr) return { ok: false, message: "更新に失敗しました。" };
  } else {
    const { error: insErr } = await supabase.from("incentive_submissions").insert(payloadRow);
    if (insErr) return { ok: false, message: "登録に失敗しました。" };
  }

  revalidatePath("/my/incentive");
  revalidatePath("/incentives");
  return { ok: true };
}
