-- 休憩打刻と GPS メタデータ（Web 打刻用）

alter table public.attendance_punches drop constraint if exists attendance_punches_punch_type_check;
alter table public.attendance_punches
  add constraint attendance_punches_punch_type_check
  check (punch_type in ('clock_in', 'clock_out', 'break_start', 'break_end'));

alter table public.attendance_punches
  add column if not exists latitude double precision;
alter table public.attendance_punches
  add column if not exists longitude double precision;
alter table public.attendance_punches
  add column if not exists location_accuracy_m double precision;

comment on column public.attendance_punches.latitude is '打刻時の緯度（Geolocation、任意）';
comment on column public.attendance_punches.longitude is '打刻時の経度（Geolocation、任意）';
