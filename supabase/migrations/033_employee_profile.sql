ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS emergency_name text,
  ADD COLUMN IF NOT EXISTS emergency_relation text;
