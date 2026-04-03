"use client";

import { useCallback, useState } from "react";

type VehicleRow = {
  id: string;
  name: string;
  plate_number: string | null;
  branch: string;
  is_active: boolean;
};

const BRANCHES = ["東京本社", "福岡支社", "名古屋支社"] as const;

export function VehicleAdminClient({
  initialVehicles,
}: {
  initialVehicles: VehicleRow[];
}) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // モーダル
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", plate_number: "", branch: BRANCHES[0] as string });
  const [modalError, setModalError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/vehicles");
    const j = (await res.json()) as { vehicles?: VehicleRow[] };
    setVehicles(j.vehicles ?? []);
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", plate_number: "", branch: BRANCHES[0] });
    setModalError(null);
    setModal(true);
  };

  const openEdit = (v: VehicleRow) => {
    setEditingId(v.id);
    setForm({ name: v.name, plate_number: v.plate_number ?? "", branch: v.branch });
    setModalError(null);
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setModalError("車両名は必須です");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const url = editingId ? `/api/vehicles/${editingId}` : "/api/vehicles";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          plate_number: form.plate_number.trim() || null,
          branch: form.branch,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "保存に失敗しました");
      setModal(false);
      await reload();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: VehicleRow) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !v.is_active }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "更新に失敗しました");
      }
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const deleteVehicle = async (id: string) => {
    if (!confirm("この車両を削除しますか？")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "削除に失敗しました");
      }
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{msg}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          車両を追加
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-700 text-sm">
          <thead className="bg-card">
            <tr>
              {["車両名", "ナンバー", "拠点", "状態", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-zinc-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  車両が登録されていません
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.id} className={v.is_active ? "" : "opacity-50"}>
                  <td className="px-3 py-2 font-medium">{v.name}</td>
                  <td className="px-3 py-2 text-zinc-400">{v.plate_number ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{v.branch}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void toggleActive(v)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.is_active
                          ? "bg-emerald-950/50 text-emerald-300 border border-emerald-700"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-600"
                      }`}
                    >
                      {v.is_active ? "有効" : "無効"}
                    </button>
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      className="text-blue-400 underline"
                      onClick={() => openEdit(v)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="text-red-400 underline"
                      onClick={() => void deleteVehicle(v.id)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 追加・編集モーダル */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-card p-5">
            <h3 className="text-lg font-semibold">
              {editingId ? "車両を編集" : "車両を追加"}
            </h3>
            <div className="mt-4 grid gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-zinc-400">車両名</span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-card px-2 py-1.5"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400">ナンバー</span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-card px-2 py-1.5"
                  placeholder="品川 xxx-xx"
                  value={form.plate_number}
                  onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-400">拠点</span>
                <select
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-card px-2 py-1.5"
                  value={form.branch}
                  onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </label>
            </div>

            {modalError && (
              <p className="mt-3 rounded-md bg-red-950/40 px-3 py-2 text-sm text-red-300">{modalError}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm hover:bg-card/80"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
