-- TW AUTO TUNE security hardening SQL
-- Run this in Supabase SQL Editor after confirming table names in your live database.
-- Goal: authenticated staff can use the app; anonymous users cannot directly browse business data.

-- 1) Enable RLS on business-critical tables.
alter table if exists public.user_profiles enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.business_settings enable row level security;
alter table if exists public.workshop_settings enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.vehicles enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.job_items enable row level security;
alter table if exists public.job_inspections enable row level security;
alter table if exists public.job_inspection_items enable row level security;
alter table if exists public.diagnostic_codes enable row level security;
alter table if exists public.invoices enable row level security;
alter table if exists public.invoice_items enable row level security;
alter table if exists public.invoice_payments enable row level security;
alter table if exists public.payments enable row level security;
alter table if exists public.email_logs enable row level security;
alter table if exists public.parts enable row level security;
alter table if exists public.stock_movements enable row level security;
alter table if exists public.suppliers enable row level security;
alter table if exists public.purchase_invoices enable row level security;
alter table if exists public.expenses enable row level security;
alter table if exists public.service_packages enable row level security;
alter table if exists public.service_package_items enable row level security;
alter table if exists public.services enable row level security;
alter table if exists public.inspection_categories enable row level security;
alter table if exists public.inspection_checklist_items enable row level security;

-- 2) Never grant raw table permissions to anon by default.
-- Public invoice viewing should be handled by the server-only service role page, not direct anon table reads.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- 3) Authenticated staff baseline permissions.
-- RLS policies still decide which rows are visible/editable.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 4) Helper: current staff role from user_profiles.
create or replace function public.current_staff_role()
returns text
language sql
security definer
set search_path = public
as $$
  select up.role
  from public.user_profiles up
  where up.id = auth.uid()
    and up.active = true
  limit 1
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.active = true
  )
$$;

create or replace function public.is_owner_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_staff_role() = 'owner'
$$;

-- 5) Staff access policies.
-- These are intentionally broad for active staff because TW AutoTune is currently a single-workshop system.
-- Owner-only restrictions are added for logs/settings/sensitive owner tables.
do $$
begin
  if to_regclass('public.customers') is not null then
    drop policy if exists "active staff manage customers" on public.customers;
    create policy "active staff manage customers" on public.customers for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.vehicles') is not null then
    drop policy if exists "active staff manage vehicles" on public.vehicles;
    create policy "active staff manage vehicles" on public.vehicles for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.jobs') is not null then
    drop policy if exists "active staff manage jobs" on public.jobs;
    create policy "active staff manage jobs" on public.jobs for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.job_items') is not null then
    drop policy if exists "active staff manage job items" on public.job_items;
    create policy "active staff manage job items" on public.job_items for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.job_inspections') is not null then
    drop policy if exists "active staff manage inspections" on public.job_inspections;
    create policy "active staff manage inspections" on public.job_inspections for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.job_inspection_items') is not null then
    drop policy if exists "active staff manage inspection items" on public.job_inspection_items;
    create policy "active staff manage inspection items" on public.job_inspection_items for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.diagnostic_codes') is not null then
    drop policy if exists "active staff manage diagnostic codes" on public.diagnostic_codes;
    create policy "active staff manage diagnostic codes" on public.diagnostic_codes for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.invoices') is not null then
    drop policy if exists "active staff manage invoices" on public.invoices;
    create policy "active staff manage invoices" on public.invoices for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.invoice_items') is not null then
    drop policy if exists "active staff manage invoice items" on public.invoice_items;
    create policy "active staff manage invoice items" on public.invoice_items for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.invoice_payments') is not null then
    drop policy if exists "active staff manage invoice payments" on public.invoice_payments;
    create policy "active staff manage invoice payments" on public.invoice_payments for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.payments') is not null then
    drop policy if exists "active staff manage payments" on public.payments;
    create policy "active staff manage payments" on public.payments for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.services') is not null then
    drop policy if exists "active staff manage services" on public.services;
    create policy "active staff manage services" on public.services for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.service_packages') is not null then
    drop policy if exists "active staff manage service packages" on public.service_packages;
    create policy "active staff manage service packages" on public.service_packages for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.service_package_items') is not null then
    drop policy if exists "active staff manage package items" on public.service_package_items;
    create policy "active staff manage package items" on public.service_package_items for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.inspection_categories') is not null then
    drop policy if exists "active staff manage inspection categories" on public.inspection_categories;
    create policy "active staff manage inspection categories" on public.inspection_categories for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.inspection_checklist_items') is not null then
    drop policy if exists "active staff manage checklist items" on public.inspection_checklist_items;
    create policy "active staff manage checklist items" on public.inspection_checklist_items for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;
end $$;

-- 6) Owner-only tables/policies.
do $$
begin
  if to_regclass('public.email_logs') is not null then
    drop policy if exists "owners manage email logs" on public.email_logs;
    create policy "owners manage email logs" on public.email_logs for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;

  if to_regclass('public.business_settings') is not null then
    drop policy if exists "owners manage business settings" on public.business_settings;
    create policy "owners manage business settings" on public.business_settings for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;

  if to_regclass('public.workshop_settings') is not null then
    drop policy if exists "owners manage workshop settings" on public.workshop_settings;
    create policy "owners manage workshop settings" on public.workshop_settings for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;

  if to_regclass('public.parts') is not null then
    drop policy if exists "active staff manage parts" on public.parts;
    create policy "active staff manage parts" on public.parts for all using (public.is_active_staff()) with check (public.is_active_staff());
  end if;

  if to_regclass('public.stock_movements') is not null then
    drop policy if exists "owners manage stock movements" on public.stock_movements;
    create policy "owners manage stock movements" on public.stock_movements for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;

  if to_regclass('public.suppliers') is not null then
    drop policy if exists "owners manage suppliers" on public.suppliers;
    create policy "owners manage suppliers" on public.suppliers for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;

  if to_regclass('public.purchase_invoices') is not null then
    drop policy if exists "owners manage purchase invoices" on public.purchase_invoices;
    create policy "owners manage purchase invoices" on public.purchase_invoices for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;

  if to_regclass('public.expenses') is not null then
    drop policy if exists "owners manage expenses" on public.expenses;
    create policy "owners manage expenses" on public.expenses for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;
end $$;

-- 7) Staff profile visibility.
do $$
begin
  if to_regclass('public.user_profiles') is not null then
    drop policy if exists "active staff view profiles" on public.user_profiles;
    create policy "active staff view profiles" on public.user_profiles for select using (public.is_active_staff());

    drop policy if exists "owners manage profiles" on public.user_profiles;
    create policy "owners manage profiles" on public.user_profiles for all using (public.is_owner_staff()) with check (public.is_owner_staff());
  end if;
end $$;

-- 8) Verification queries to run after this script.
-- Check anon exposure:
-- select grantee, table_schema, table_name, privilege_type
-- from information_schema.role_table_grants
-- where grantee = 'anon' and table_schema = 'public'
-- order by table_name, privilege_type;
--
-- Check RLS enabled:
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;
--
-- Check policies:
-- select schemaname, tablename, policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
