-- Nenux Workshop Manager multi-workshop foundation
-- Run this after taking a Supabase backup.
-- This prepares the current single-workshop app to become a multi-workshop SaaS platform.
-- It does NOT delete existing data.

create extension if not exists pgcrypto;

-- 1) Main workshop tenant table.
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  abn text,
  phone text,
  email text,
  address_line_1 text,
  address_line_2 text,
  logo_url text,
  bank_name text,
  bank_account_name text,
  bank_bsb text,
  bank_account_number text,
  invoice_footer_note text,
  subscription_status text not null default 'manual_active',
  subscription_plan text not null default 'starter',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) User membership table. One user can belong to one or more workshops later.
create table if not exists public.workshop_members (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'mechanic', 'front_desk')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workshop_id, user_id)
);

-- 3) Insert current workshop as the first tenant.
insert into public.workshops (
  name,
  slug,
  subscription_status,
  subscription_plan
)
values (
  'TW AUTO TUNE',
  'tw-auto-tune',
  'manual_active',
  'starter'
)
on conflict (slug) do nothing;

-- 4) Add workshop_id to important business tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_settings',
    'workshop_settings',
    'customers',
    'vehicles',
    'jobs',
    'job_items',
    'job_inspections',
    'job_inspection_items',
    'diagnostic_codes',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'payments',
    'email_logs',
    'parts',
    'stock_movements',
    'suppliers',
    'purchase_invoices',
    'shop_expenses',
    'expenses',
    'service_packages',
    'service_package_items',
    'services',
    'inspection_categories',
    'inspection_checklist_items'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I add column if not exists workshop_id uuid references public.workshops(id)', table_name);
    end if;
  end loop;
end $$;

-- 5) Backfill all existing data to TW AUTO TUNE tenant.
do $$
declare
  tw_workshop_id uuid;
  table_name text;
begin
  select id into tw_workshop_id
  from public.workshops
  where slug = 'tw-auto-tune'
  limit 1;

  if tw_workshop_id is null then
    raise exception 'TW AUTO TUNE workshop was not created.';
  end if;

  foreach table_name in array array[
    'business_settings',
    'workshop_settings',
    'customers',
    'vehicles',
    'jobs',
    'job_items',
    'job_inspections',
    'job_inspection_items',
    'diagnostic_codes',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'payments',
    'email_logs',
    'parts',
    'stock_movements',
    'suppliers',
    'purchase_invoices',
    'shop_expenses',
    'expenses',
    'service_packages',
    'service_package_items',
    'services',
    'inspection_categories',
    'inspection_checklist_items'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('update public.%I set workshop_id = $1 where workshop_id is null', table_name)
      using tw_workshop_id;
    end if;
  end loop;
end $$;

-- 6) Add current active users as TW AUTO TUNE members from user_profiles.
insert into public.workshop_members (workshop_id, user_id, role, active)
select
  w.id,
  up.id,
  case when up.role in ('owner', 'mechanic', 'front_desk') then up.role else 'front_desk' end,
  coalesce(up.active, true)
from public.user_profiles up
cross join public.workshops w
where w.slug = 'tw-auto-tune'
on conflict (workshop_id, user_id) do update
set role = excluded.role,
    active = excluded.active;

-- 7) Helper functions for RLS.
create or replace function public.current_workshop_ids()
returns uuid[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(wm.workshop_id), array[]::uuid[])
  from public.workshop_members wm
  where wm.user_id = auth.uid()
    and wm.active = true
$$;

create or replace function public.current_primary_workshop_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select wm.workshop_id
  from public.workshop_members wm
  where wm.user_id = auth.uid()
    and wm.active = true
  order by wm.created_at asc
  limit 1
$$;

create or replace function public.is_member_of_workshop(target_workshop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workshop_members wm
    where wm.user_id = auth.uid()
      and wm.workshop_id = target_workshop_id
      and wm.active = true
  )
$$;

-- 8) RLS for workshop tenant tables.
alter table public.workshops enable row level security;
alter table public.workshop_members enable row level security;

drop policy if exists "members can view their workshops" on public.workshops;
create policy "members can view their workshops"
on public.workshops
for select
using (public.is_member_of_workshop(id));

drop policy if exists "owners can update their workshops" on public.workshops;
create policy "owners can update their workshops"
on public.workshops
for update
using (
  exists (
    select 1
    from public.workshop_members wm
    where wm.workshop_id = workshops.id
      and wm.user_id = auth.uid()
      and wm.active = true
      and wm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.workshop_members wm
    where wm.workshop_id = workshops.id
      and wm.user_id = auth.uid()
      and wm.active = true
      and wm.role = 'owner'
  )
);

drop policy if exists "members can view memberships in their workshops" on public.workshop_members;
create policy "members can view memberships in their workshops"
on public.workshop_members
for select
using (public.is_member_of_workshop(workshop_id));

-- 9) Tenant isolation policies for business tables.
-- This creates/refreshes generic policies for tables that now have workshop_id.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_settings',
    'workshop_settings',
    'customers',
    'vehicles',
    'jobs',
    'job_items',
    'job_inspections',
    'job_inspection_items',
    'diagnostic_codes',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'payments',
    'email_logs',
    'parts',
    'stock_movements',
    'suppliers',
    'purchase_invoices',
    'shop_expenses',
    'expenses',
    'service_packages',
    'service_package_items',
    'services',
    'inspection_categories',
    'inspection_checklist_items'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists "tenant members manage %I" on public.%I', table_name, table_name);
      execute format(
        'create policy "tenant members manage %I" on public.%I for all using (public.is_member_of_workshop(workshop_id)) with check (public.is_member_of_workshop(workshop_id))',
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- 10) Quick verification.
select 'workshops' as table_name, count(*) as rows from public.workshops
union all
select 'workshop_members', count(*) from public.workshop_members;
