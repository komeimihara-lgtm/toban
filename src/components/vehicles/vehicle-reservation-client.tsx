"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Vehicle = { id: string; name: string; plate_number: string | null; branch: string };
type Reservation = {
  id: string;
  vehicle_id: string;
  employee_id: string;
  employee_name: string;
  employee_auth_user_id: string | null;
  start_at: string;
  end_at: string;
  purpose: string | null;
};

const BRANCHES = ["東京本社", "福岡支社", "名古屋支社"] as const;

// 6:00〜22:00 の30分刻み
const HOURS_START = 6;
const HOURS_END = 22;
const SLOTS: string[] = [];
for (let h = HOURS_START; h < HOURS_END; h++) {
  SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toJstDateStr(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function slotIndex(isoStr: string): number {
  const d = new Date(isoStr);
  const h = Number(d.toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }));
  const m = Number(d.toLocaleString("en-US", { timeZone: "Asia/Tokyo", minute: "numeric" }));
  return (h - HOURS_START) * 2 + (m >= 30 ? 1 : 0);
}

export function VehicleReservationClient({
  userId,
  vehicles,
}: {
  userId: string;
  vehicles: Vehicle[];
}) {
  const [branch, setBranch] = useState<string>(BRANCHES[0]);
  const [date, setDate] = useState(() => toJstDateStr(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // モーダル
  const [modal, setModal] = useState<{
    vehicleId: string;
    vehicleName: string;
    startSlot: number;
  } | null>(null);
  const [modalStart, setModalStart] = useState("");
  const [modalEnd, setModalEnd] = useState("");
  const [modalPurpose, setModalPurpose] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const branchVehicles = useMemo(
    () => vehicles.filter((v) => v.branch === branch),
    [vehicles, branch],
  );

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicle-reservations?date=${date}`);
      const j = (await res.json()) as { reservations?: Reservation[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "読み込み失敗");
      setReservations(j.reservations ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  const goDay = (delta: number) => {
    const d = new Date(date + "T00:00:00+09:00");
    d.setDate(d.getDate() + delta);
    setDate(toJstDateStr(d));
  };

  const openModal = (vehicleId: string, vehicleName: string, slotIdx: number) => {
    const startH = HOURS_START + Math.floor(slotIdx / 2);
    const startM = slotIdx % 2 === 0 ? "00" : "30";
    const endSlot = slotIdx + 2; // デフォルト1時間
    const endH = HOURS_START + Math.floor(endSlot / 2);
    const endM = endSlot % 2 === 0 ? "00" : "30";
    setModal({ vehicleId, vehicleName, startSlot: slotIdx });
    setModalStart(`${pad2(startH)}:${startM}`);
    setModalEnd(`${pad2(endH)}:${endM}`);
    setModalPurpose("");
    setModalError(null);
  };

  const submitReservation = async () => {
    if (!modal) return;
    setSaving(true);
    setModalError(null);
    try {
      const startIso = `${date}T${modalStart}:00+09:00`;
      const endIso = `${date}T${modalEnd}:00+09:00`;
      const res = await fetch("/api/vehicle-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: modal.vehicleId,
          start_at: startIso,
          end_at: endIso,
          purpose: modalPurpose || null,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "予約に失敗しました");
      setModal(null);
      await loadReservations();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const deleteReservation = async (id: string) => {
    if (!confirm("この予約を取り消しますか？")) return;
    try {
      const res = await fetch(`/api/vehicle-reservations/${id}`, { method: "DELETE" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "削除に失敗しました");
      await loadReservations();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    }
  };

  // 予約ブロック位置計算
  const getReservationStyle = (r: Reservation) => {
    const si = Math.max(0, slotIndex(r.start_at));
    const ei = Math.min(SLOTS.length, slotIndex(r.end_at));
    const span = Math.max(1, ei - si);
    return { gridColumnStart: si + 2, gridColumnEnd: si + 2 + span }; // +2 for vehicle name col
  };

  const dateLabel = new Date(date + "T00:00:00+09:00").toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

  const isToday = date === toJstDateStr(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">社用車予約</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goDay(-1)} className="rounded-lg border border-zinc-700 p-1.5 hover:bg-card/80">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-medium tabular-nums">
            {dateLabel}
          </span>
          <button type="button" onClick={() => goDay(1)} className="rounded-lg border border-zinc-700 p-1.5 hover:bg-card/80">
            <ChevronRight className="size-4" />
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(toJstDateStr(new Date()))}
              className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-card/80"
            >
              今日
            </button>
          )}
        </div>
      </div>

      {/* 拠点タブ */}
      <div className="flex gap-1 border-b border-zinc-700">
        {BRANCHES.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBranch(b)}
            className={
              branch === b
                ? "border-b-2 border-blue-500 px-3 py-2 text-sm font-medium text-blue-400"
                : "border-b-2 border-transparent px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            }
          >
            {b}
          </button>
        ))}
      </div>

      {msg && (
        <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{msg}</p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中…</p>
      ) : branchVehicles.length === 0 ? (
        <p className="text-sm text-zinc-500">この拠点に登録された車両がありません</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700">
          <div
            className="min-w-[900px]"
            style={{
              display: "grid",
              gridTemplateColumns: `120px repeat(${SLOTS.length}, minmax(40px, 1fr))`,
            }}
          >
            {/* ヘッダー */}
            <div className="sticky left-0 z-10 bg-card border-b border-r border-zinc-700 px-2 py-2 text-xs font-medium text-zinc-400">
              車両
            </div>
            {SLOTS.map((s, i) => (
              <div
                key={s}
                className={`border-b border-zinc-700 px-1 py-2 text-center text-[10px] text-zinc-500 ${i % 2 === 0 ? "border-l border-zinc-700" : "border-l border-zinc-800"}`}
              >
                {i % 2 === 0 ? s : ""}
              </div>
            ))}

            {/* 車両行 */}
            {branchVehicles.map((v) => {
              const vReservations = reservations.filter((r) => r.vehicle_id === v.id);
              return (
                <div key={v.id} className="contents">
                  <div className="sticky left-0 z-10 bg-card border-b border-r border-zinc-700 px-2 py-3 text-xs">
                    <p className="font-medium text-zinc-200">{v.name}</p>
                    {v.plate_number && (
                      <p className="text-[10px] text-zinc-500">{v.plate_number}</p>
                    )}
                  </div>
                  {SLOTS.map((_, si) => {
                    // このスロットに予約があるか
                    const reservation = vReservations.find((r) => {
                      const rsi = Math.max(0, slotIndex(r.start_at));
                      const rei = Math.min(SLOTS.length, slotIndex(r.end_at));
                      return si >= rsi && si < rei;
                    });
                    const isStart = reservation
                      ? Math.max(0, slotIndex(reservation.start_at)) === si
                      : false;

                    if (reservation && !isStart) {
                      // 予約の途中スロット — 空divで埋める
                      return (
                        <div
                          key={si}
                          className="border-b border-zinc-800"
                        />
                      );
                    }

                    if (reservation && isStart) {
                      const style = getReservationStyle(reservation);
                      const span = style.gridColumnEnd - style.gridColumnStart;
                      const isMine = reservation.employee_auth_user_id === userId;
                      return (
                        <div
                          key={si}
                          className="relative border-b border-zinc-800 px-1 py-1"
                          style={{ gridColumn: `span ${span}` }}
                        >
                          <div
                            className={`flex h-full items-center gap-1 rounded-md px-2 py-1 text-[11px] leading-tight ${
                              isMine
                                ? "bg-blue-600/30 text-blue-200 border border-blue-500/40"
                                : "bg-zinc-700/50 text-zinc-300 border border-zinc-600/40"
                            }`}
                          >
                            <span className="min-w-0 truncate">
                              {reservation.employee_name}
                              {reservation.purpose ? ` · ${reservation.purpose}` : ""}
                            </span>
                            {isMine && (
                              <button
                                type="button"
                                onClick={() => void deleteReservation(reservation.id)}
                                className="ml-auto shrink-0 rounded p-0.5 hover:bg-red-600/40"
                                title="予約を取消"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // 空きスロット
                    return (
                      <div
                        key={si}
                        className={`cursor-pointer border-b border-zinc-800 hover:bg-blue-900/20 ${si % 2 === 0 ? "border-l border-zinc-700" : "border-l border-zinc-800"}`}
                        onClick={() => openModal(v.id, v.name, si)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 予約モーダル */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-card p-5">
            <h3 className="text-lg font-semibold">予約</h3>
            <p className="mt-1 text-sm text-zinc-400">{modal.vehicleName} · {dateLabel}</p>

            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-zinc-400">開始時刻</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-card px-2 py-1.5"
                  value={modalStart}
                  onChange={(e) => setModalStart(e.target.value)}
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400">終了時刻</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-card px-2 py-1.5"
                  value={modalEnd}
                  onChange={(e) => setModalEnd(e.target.value)}
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value={`${pad2(HOURS_END)}:00`}>{pad2(HOURS_END)}:00</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400">用途</span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-card px-2 py-1.5"
                  placeholder="例：顧客訪問"
                  value={modalPurpose}
                  onChange={(e) => setModalPurpose(e.target.value)}
                />
              </label>
            </div>

            {modalError && (
              <p className="mt-3 rounded-md bg-red-950/40 px-3 py-2 text-sm text-red-300">{modalError}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm hover:bg-card/80"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitReservation()}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "予約中…" : "予約する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
