"use client";

import { useCallback, useEffect, useState } from "react";

type CorrectionRow = {
  id: string;
  target_date: string;
  original_clock_in: string | null;
  original_clock_out: string | null;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

function formatTs(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const f = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = f.formatToParts(d);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${h.padStart(2, "0")}:${m}`;
  } catch {
    return "";
  }
}

export function AttendanceCorrectionClient() {
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" });
    return f.format(d);
  });
  const [origIn, setOrigIn] = useState<string | null>(null);
  const [origOut, setOrigOut] = useState<string | null>(null);
  const [reqIn, setReqIn] = useState("");
  const [reqOut, setReqOut] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<CorrectionRow[]>([]);
  const [pending, setPending] = useState<CorrectionRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const loadDay = useCallback(async () => {
    setLoadingDay(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/attendance/day-punches?date=${encodeURIComponent(targetDate)}`,
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "取得に失敗しました");
      setOrigIn(j.original_clock_in ?? null);
      setOrigOut(j.original_clock_out ?? null);
      setReqIn(toTimeInput(j.original_clock_in));
      setReqOut(toTimeInput(j.original_clock_out));
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "エラー",
      });
    } finally {
      setLoadingDay(false);
    }
  }, [targetDate]);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/corrections");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "一覧の取得に失敗しました");
      setItems(j.items ?? []);
      setIsAdmin(Boolean(j.is_admin));
      setPending(j.is_admin ? (j.pending_admin ?? []) : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_date: targetDate,
          reason,
          requested_clock_in: reqIn.trim() || null,
          requested_clock_out: reqOut.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "申請に失敗しました");
      setMessage({ type: "ok", text: "申請を受け付けました。" });
      setReason("");
      await loadList();
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "エラー",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    let rejection: string | undefined;
    if (action === "reject") {
      const r = window.prompt("差戻し理由（必須）");
      if (r == null) return;
      const t = r.trim();
      if (!t) {
        window.alert("理由を入力してください");
        return;
      }
      rejection = t;
    }
    setActionId(id);
    try {
      const res = await fetch(`/api/attendance/corrections/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reject"
            ? { action: "reject", reason: rejection }
            : { action: "approve" },
        ),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "処理に失敗しました");
      await loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "エラー");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-10">
      {message && (
        <p
          role={message.type === "ok" ? "status" : "alert"}
          className={
            message.type === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          }
        >
          {message.text}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">
          新規申請
        </h2>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            対象日
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
            disabled={submitting}
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              元の打刻（読み取り専用）
            </p>
            <p className="mt-2 text-sm text-zinc-800">
              出勤:{" "}
              {loadingDay ? "…" : formatTs(origIn)}
            </p>
            <p className="mt-1 text-sm text-zinc-800">
              退勤:{" "}
              {loadingDay ? "…" : formatTs(origOut)}
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              修正後の打刻
            </p>
            <div>
              <label className="text-xs text-[#6B7280]">
                出勤
              </label>
              <input
                type="time"
                value={reqIn}
                onChange={(e) => setReqIn(e.target.value)}
                disabled={submitting}
                className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B7280]">
                退勤
              </label>
              <input
                type="time"
                value={reqOut}
                onChange={(e) => setReqOut(e.target.value)}
                disabled={submitting}
                className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            修正理由（必須）
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={4}
            disabled={submitting}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
            placeholder="例: 電車遅延のため出勤打刻が遅れた"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#FF6B2B] px-6 py-2.5 font-medium text-white shadow-md hover:bg-[#FF8C00] disabled:opacity-50"
        >
          {submitting ? "送信中…" : "申請する"}
        </button>
      </form>

      {isAdmin && pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#1A1A1A]">
            承認待ち（管理者）
          </h2>
          <ul className="space-y-3">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm text-zinc-800">
                  <p className="font-medium">{p.target_date}</p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    理由: {p.reason}
                  </p>
                  <p className="mt-1 text-xs">
                    出勤 {formatTs(p.original_clock_in)} →{" "}
                    {formatTs(p.requested_clock_in)} / 退勤{" "}
                    {formatTs(p.original_clock_out)} →{" "}
                    {formatTs(p.requested_clock_out)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={() => void decide(p.id, "approve")}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    承認
                  </button>
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={() => void decide(p.id, "reject")}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
                  >
                    差戻し
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#1A1A1A]">
          自分の申請履歴
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">申請はまだありません。</p>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.target_date}</span>
                  <span
                    className={
                      row.status === "approved"
                        ? "text-emerald-600"
                        : row.status === "rejected"
                          ? "text-red-600"
                          : "text-amber-600"
                    }
                  >
                    {row.status === "pending"
                      ? "承認待ち"
                      : row.status === "approved"
                        ? "承認済"
                        : "差戻し"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  申請 {new Date(row.created_at).toLocaleString("ja-JP")}
                </p>
                {row.status === "rejected" && row.rejection_reason && (
                  <p className="mt-1 text-xs text-red-600">
                    理由: {row.rejection_reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
