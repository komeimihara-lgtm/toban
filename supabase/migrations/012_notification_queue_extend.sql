-- 通知キュー: channel / status / 件名（メール用）

alter table public.notification_queue
  add column if not exists channel text not null default 'line';

alter table public.notification_queue
  add column if not exists status text not null default 'pending';

alter table public.notification_queue
  add column if not exists subject text;

alter table public.notification_queue drop constraint if exists notification_queue_channel_check;
alter table public.notification_queue
  add constraint notification_queue_channel_check
  check (channel in ('line', 'email'));

alter table public.notification_queue drop constraint if exists notification_queue_status_check;
alter table public.notification_queue
  add constraint notification_queue_status_check
  check (status in ('pending', 'sent', 'failed'));

update public.notification_queue
set status = 'sent'
where sent_at is not null and status = 'pending';

create index if not exists notification_queue_pending_idx
  on public.notification_queue (status, created_at)
  where status = 'pending';
