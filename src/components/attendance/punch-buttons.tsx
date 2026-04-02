"use client";

import { punchAttendance } from "@/app/actions/attendance-actions";
import { useTransition } from "react";

export function PunchButtons() {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await punchAttendance("clock_in");
          })
        }
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        出勤
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await punchAttendance("clock_out");
          })
        }
        className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        退勤
      </button>
    </div>
  );
}
