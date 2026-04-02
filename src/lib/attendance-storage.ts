/**
 * 勤怠の保存・計算用ユーティリティ（自動休憩控除・労基法準拠の目安）
 * 実労働時間 = 退勤−出勤の経過分 − calcBreakTime(経過分)
 */

export function calcBreakTime(workMinutes: number): number {
  if (workMinutes <= 360) return 0;
  if (workMinutes <= 480) return 45;
  return 60;
}

/** 自動休憩控除後の実労働時間（分） */
export function netWorkMinutesAfterAutoBreak(grossWorkMinutes: number): number {
  return Math.max(0, grossWorkMinutes - calcBreakTime(grossWorkMinutes));
}
