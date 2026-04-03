-- 040: 社用車予約に行き先カラム追加
ALTER TABLE public.vehicle_reservations
  ADD COLUMN IF NOT EXISTS destination text;
