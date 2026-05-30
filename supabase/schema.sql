-- TW AUTO TUNE Management System Base Schema

create extension if not exists "uuid-ossp";

-- Staff profiles linked to Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'mechanic',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Business settings
create table if not exists public.business_settings (
  id uuid primary key default uuid_generate_v4(),
  business_name text not null default 'TW AUTO TUNE',
  abn text,
  phone text default '0403 965 946',
  email text,
  address text default 'Unit 2/119 Box St, Dandenong South',
  default_labour_rate numeric(10,2) not null default 100.00,
  gst_registered boolean not null default true,
  gst_rate numeric(5,2) not null default 10.00,
  invoice_prefix text not null default 'INV',
  job_prefix text not null default 'JOB',
  quote_prefix text not null default 'QTE',
  payment_terms text default 'Payment due on completion.',
  warranty_terms text default 'Parts warranty applies as per supplier terms. Labour warranty applies as per workshop policy.',
  created_at timestamptz not null default now()
);

insert into public.business_settings (business_name)
select 'TW AUTO TUNE'
where not exists (select 1 from public.business_settings);

-- Customers
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text not null,
  email text,
  address text,
  customer_type text not null default 'individual',
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- Vehicles
create table if not exists public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  registration text not null,
  make text,
  model text,
  year integer,
  vin text,
  engine_number text,
  odometer integer,
  fuel_type text,
  transmission text,
  colour text,
  vehicle_type text default 'standard',
  notes text,
  created_at timestamptz not null default now()
);

-- Services
create table if not exists public.services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  description text,
  default_price numeric(10,2) default 0,
  estimated_minutes integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Packages / service bundles
create table if not exists public.service_packages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  description text,
  base_price numeric(10,2) not null default 0,
  price_note text default '+ GST',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_package_items (
  id uuid primary key default uuid_generate_v4(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  item_name text not null,
  description text,
  sort_order integer default 0
);

-- Jobs / repair orders
create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  job_number bigserial unique,
  customer_id uuid not null references public.customers(id),
  vehicle_id uuid not null references public.vehicles(id),
  assigned_mechanic uuid references public.profiles(id),
  status text not null default 'new',
  odometer integer,
  customer_complaint text,
  initial_notes text,
  diagnosis_summary text,
  work_completed text,
  recommendations text,
  safety_status text default 'not_checked',
  estimated_total numeric(10,2) default 0,
  final_total numeric(10,2) default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Job line items before invoice
create table if not exists public.job_items (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_type text not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) generated always as (quantity * unit_price) stored,
  taxable boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

-- Inspection categories
create table if not exists public.inspection_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  sort_order integer default 0,
  active boolean not null default true
);

-- Checklist template items
create table if not exists public.inspection_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.inspection_categories(id) on delete cascade,
  item_name text not null,
  input_type text not null default 'status',
  measurement_unit text,
  vehicle_type text default 'all',
  default_customer_visible boolean not null default true,
  sort_order integer default 0,
  active boolean not null default true
);

-- Job inspection record
create table if not exists public.job_inspections (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  mechanic_id uuid references public.profiles(id),
  overall_status text default 'not_checked',
  odometer integer,
  customer_visible_notes text,
  internal_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Filled inspection items
create table if not exists public.job_inspection_items (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references public.job_inspections(id) on delete cascade,
  checklist_item_id uuid references public.inspection_checklist_items(id),
  category_name text not null,
  item_name text not null,
  status text not null default 'not_checked',
  measurement_value text,
  measurement_unit text,
  mechanic_note text,
  recommendation text,
  repaired_during_job boolean not null default false,
  show_on_invoice boolean not null default true,
  quote_required boolean not null default false,
  created_at timestamptz not null default now()
);

-- Diagnostic codes
create table if not exists public.diagnostic_codes (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  code text not null,
  system text,
  description text,
  status text default 'active',
  severity text default 'medium',
  mechanic_note text,
  recommendation text,
  cleared_after_service boolean not null default false,
  show_on_invoice boolean not null default true,
  created_at timestamptz not null default now()
);

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number bigserial unique,
  job_id uuid references public.jobs(id),
  customer_id uuid not null references public.customers(id),
  vehicle_id uuid not null references public.vehicles(id),
  status text not null default 'draft',
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  gst_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  balance_due numeric(10,2) not null default 0,
  notes text,
  internal_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Invoice line items
create table if not exists public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type text not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  tax_rate numeric(5,2) not null default 10,
  line_total numeric(10,2) generated always as (quantity * unit_price) stored,
  included_in_package boolean not null default false,
  sort_order integer default 0
);

-- Payments
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  amount numeric(10,2) not null,
  payment_method text not null,
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id)
);

-- Customer approval records
create table if not exists public.job_approvals (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  approval_method text not null,
  approved_amount numeric(10,2),
  approval_note text,
  approved_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id)
);

-- Activity logs
create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id),
  action text not null,
  table_name text,
  record_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

-- Seed inspection categories
insert into public.inspection_categories (name, description, sort_order)
values
('Brakes', 'Brake pads, rotors, fluid, handbrake and brake performance', 1),
('Tyres & Wheels', 'Tyres, tread depth, pressure, wheel nuts and wheel condition', 2),
('Steering & Suspension', 'Steering, shocks, struts, bushes, ball joints and wheel bearings', 3),
('Engine Bay', 'Engine leaks, belts, filters, hoses, cooling system and mounts', 4),
('Fluids', 'Engine oil, coolant, brake fluid, transmission fluid and washer fluid', 5),
('Battery & Charging', 'Battery health, voltage, terminals, alternator and starter', 6),
('Lights & Electrical', 'Headlights, brake lights, indicators, horn and warning lights', 7),
('Wipers & Windscreen', 'Wipers, washer jets, windscreen, mirrors and exterior safety items', 8),
('Exhaust', 'Exhaust leaks, mounts, muffler, smoke and excessive noise', 9),
('Transmission / Drivetrain', 'Transmission, clutch, CV joints, driveshaft and differential', 10),
('4X4 System', 'Transfer case, differentials, grease points and off-road components', 11)
on conflict do nothing;

-- Seed services
insert into public.services (name, category, description, default_price, estimated_minutes)
values
('General Labour', 'Labour', 'Standard mechanic labour charge per hour', 100, 60),
('Oil and Filter Change', 'Service', 'Engine oil and oil filter replacement', 0, 45),
('Brake Inspection', 'Brakes', 'Brake system inspection', 0, 30),
('Engine Diagnostics', 'Diagnostics', 'Diagnostic scan and fault finding', 100, 60),
('Battery Test', 'Electrical', 'Battery health and charging system test', 0, 15)
on conflict do nothing;

-- Seed packages
insert into public.service_packages (name, category, description, base_price, price_note)
values
('4X4 Service', '4X4', 'Built for tough conditions. Includes oil/filter, fluid checks, grease points and safety checks.', 239, '+ GST'),
('Student Car Service', 'Student', 'Budget-friendly student service package.', 120, '+ GST'),
('Premium Car Service Deal', 'Premium', 'Premium service deal including logbook service, oil/filter and battery report.', 159, '+ GST')
on conflict do nothing;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.services enable row level security;
alter table public.service_packages enable row level security;
alter table public.service_package_items enable row level security;
alter table public.jobs enable row level security;
alter table public.job_items enable row level security;
alter table public.inspection_categories enable row level security;
alter table public.inspection_checklist_items enable row level security;
alter table public.job_inspections enable row level security;
alter table public.job_inspection_items enable row level security;
alter table public.diagnostic_codes enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.job_approvals enable row level security;
alter table public.activity_logs enable row level security;

-- Simple authenticated access policies for MVP
create policy "Authenticated users can manage profiles" on public.profiles
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage business settings" on public.business_settings
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage customers" on public.customers
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage vehicles" on public.vehicles
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage services" on public.services
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage packages" on public.service_packages
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage package items" on public.service_package_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage jobs" on public.jobs
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage job items" on public.job_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage inspection categories" on public.inspection_categories
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage checklist items" on public.inspection_checklist_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage job inspections" on public.job_inspections
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage job inspection items" on public.job_inspection_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage diagnostic codes" on public.diagnostic_codes
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage invoices" on public.invoices
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage invoice items" on public.invoice_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage payments" on public.payments
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage approvals" on public.job_approvals
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage activity logs" on public.activity_logs
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
