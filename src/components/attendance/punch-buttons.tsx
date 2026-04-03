"use client";

import { punchAttendance } from "@/app/actions/attendance-actions";
import { useTransition } from "react";
import { LargePunchActionTiles } from "./large-punch-tiles";

export function PunchButtons() {
  const [pending, start] = useTransition();

  return (
    <LargePunchActionTiles
      pending={pending}
      onClockIn={() =>
        start(async () => {
          await punchAttendance("clock_in");
        })
      }
      onClockOut={() =>
        start(async () => {
          await punchAttendance("clock_out");
        })
      }
    />
  );
}
