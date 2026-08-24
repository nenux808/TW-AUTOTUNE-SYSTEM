-- TW AUTO TUNE public invoice link hardening
-- Run this in Supabase SQL Editor before deploying the matching app code.
-- Adds expiry support for customer-facing invoice links.

alter table if exists public.invoices
add column if not exists public_expires_at timestamptz;

create index if not exists invoices_public_token_enabled_expiry_idx
on public.invoices (public_token, public_enabled, public_expires_at);

-- Backfill existing enabled public invoice links with a 30-day expiry from now.
-- Existing links will keep working during that period, then expire automatically.
update public.invoices
set public_expires_at = now() + interval '30 days'
where public_enabled = true
  and public_token is not null
  and public_expires_at is null;
