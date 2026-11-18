-- Job date for recording historical workshop jobs.
-- Run once in the TW-AUTOTUNE Supabase SQL Editor before using the new date picker.
-- Preserve created_at as the real audit timestamp; do not backdate creation history.

alter table public.jobs
  add column if not exists job_date date;

-- Existing records retain their original creation day as their job date.
update public.jobs
set job_date = (created_at at time zone 'Australia/Melbourne')::date
where job_date is null;

alter table public.jobs
  alter column job_date set default (timezone('Australia/Melbourne', now()))::date;

alter table public.jobs
  alter column job_date set not null;

create index if not exists jobs_job_date_idx
  on public.jobs (job_date desc);
