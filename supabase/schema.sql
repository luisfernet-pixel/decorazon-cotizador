-- DECORAZON · ESQUEMA INICIAL SUPABASE
-- Ejecutar completo en SQL Editor de Supabase

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'staff',
  created_at timestamptz default now()
);

create table if not exists company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  phone_1 text,
  phone_2 text,
  email text,
  address text,
  logo_url text,
  default_tax_rate numeric(10,2) not null default 19,
  default_margin_rate numeric(10,2) not null default 100,
  updated_at timestamptz default now()
);

create table if not exists resource_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists resource_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  responsible text,
  phone text,
  nit text,
  legal_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists resource_catalog (
  id uuid primary key default gen_random_uuid(),
  type_id uuid references resource_types(id) on delete set null,
  category_id uuid references resource_categories(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  name text not null,
  specification text,
  unit text,
  size_or_format text,
  base_cost numeric(12,2) not null default 0,
  currency text not null default 'BOB',
  last_price_update date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  project_name text not null,
  company_name text,
  responsible text,
  quote_date date,
  valid_until date,
  currency text not null default 'BOB',
  payment_terms text,
  delivery_time text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  code text not null,
  name text not null,
  category text,
  description text,
  apply_tax boolean not null default true,
  tax_rate numeric(10,2) not null default 19,
  position integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists project_details (
  id uuid primary key default gen_random_uuid(),
  project_item_id uuid not null references project_items(id) on delete cascade,
  resource_id uuid references resource_catalog(id) on delete set null,
  type text,
  description text not null,
  supplier_name text,
  unit text,
  quantity numeric(12,2) not null default 1,
  unit_cost numeric(12,2) not null default 0,
  margin_rate numeric(10,2) not null default 100,
  specification text,
  notes text,
  position integer not null default 0,
  created_at timestamptz default now()
);

insert into company_settings (company_name, phone_1, phone_2, email, address, default_tax_rate, default_margin_rate)
select 'DecoraZon', '70695395', '65170766', 'decorazon.lp@gmail.com', 'Av. Garcia Lanza No. 700, entre calle 11 y 12', 19, 100
where not exists (select 1 from company_settings);

insert into resource_types (name)
values ('Material'), ('Mano de obra'), ('Servicio'), ('Instalación'), ('Transporte')
on conflict (name) do nothing;

insert into resource_categories (name)
values ('Acrílicos'), ('MDF'), ('Carpintería'), ('Impresión'), ('Letreros'), ('Adhesivos'), ('Iluminación')
on conflict (name) do nothing;

alter table profiles enable row level security;
alter table company_settings enable row level security;
alter table resource_categories enable row level security;
alter table resource_types enable row level security;
alter table suppliers enable row level security;
alter table clients enable row level security;
alter table resource_catalog enable row level security;
alter table projects enable row level security;
alter table project_items enable row level security;
alter table project_details enable row level security;

create policy if not exists "authenticated can read profiles" on profiles for select to authenticated using (true);
create policy if not exists "authenticated can insert own profile" on profiles for insert to authenticated with check (auth.uid() = id);
create policy if not exists "authenticated can update own profile" on profiles for update to authenticated using (auth.uid() = id);

create policy if not exists "authenticated can read company settings" on company_settings for select to authenticated using (true);
create policy if not exists "authenticated can manage company settings" on company_settings for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read categories" on resource_categories for select to authenticated using (true);
create policy if not exists "authenticated can manage categories" on resource_categories for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read resource types" on resource_types for select to authenticated using (true);
create policy if not exists "authenticated can manage resource types" on resource_types for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read suppliers" on suppliers for select to authenticated using (true);
create policy if not exists "authenticated can manage suppliers" on suppliers for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read clients" on clients for select to authenticated using (true);
create policy if not exists "authenticated can manage clients" on clients for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read resources" on resource_catalog for select to authenticated using (true);
create policy if not exists "authenticated can manage resources" on resource_catalog for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read projects" on projects for select to authenticated using (true);
create policy if not exists "authenticated can manage projects" on projects for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read items" on project_items for select to authenticated using (true);
create policy if not exists "authenticated can manage items" on project_items for all to authenticated using (true) with check (true);

create policy if not exists "authenticated can read details" on project_details for select to authenticated using (true);
create policy if not exists "authenticated can manage details" on project_details for all to authenticated using (true) with check (true);
