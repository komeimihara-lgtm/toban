ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS line_user_id text;
