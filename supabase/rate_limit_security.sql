-- TW AUTO TUNE rate-limit storage
-- Run this in Supabase SQL Editor before relying on app-side rate limits.
-- This table stores hashed rate-limit buckets only. It does not store raw IP addresses.

create table if not exists public.security_rate_limits (
  bucket_key text primary key,
  request_count integer not null default 1,
  window_start timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists security_rate_limits_expires_at_idx
on public.security_rate_limits (expires_at);

alter table public.security_rate_limits enable row level security;

-- App users and anonymous users should never access this table directly.
revoke all on public.security_rate_limits from anon;
revoke all on public.security_rate_limits from authenticated;

-- The service role bypasses RLS and is used only by server-side rate-limit code.

-- Optional cleanup. You can run this manually from time to time.
delete from public.security_rate_limits
where expires_at < now() - interval '1 day';
