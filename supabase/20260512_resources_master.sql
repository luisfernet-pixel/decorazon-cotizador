-- Recursos maestros DecoraZon
-- Ejecutar en Supabase SQL Editor. Mantiene resource_catalog como compatibilidad temporal.

create extension if not exists pgcrypto;

alter table resource_categories
  add column if not exists parent_id uuid references resource_categories(id) on delete set null,
  add column if not exists kind text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz default now();

alter table suppliers
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz default now();

create table if not exists resource_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references resource_categories(id) on delete set null,
  kind text not null check (kind in ('Material', 'Servicio', 'Mano de obra', 'Instalacion', 'Transporte')),
  name text not null,
  description text,
  base_unit text not null default 'unidad',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists resource_attributes (
  id uuid primary key default gen_random_uuid(),
  resource_template_id uuid not null references resource_templates(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (resource_template_id, name)
);

create table if not exists resource_attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references resource_attributes(id) on delete cascade,
  value text not null,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (attribute_id, value)
);

create table if not exists resource_variants (
  id uuid primary key default gen_random_uuid(),
  resource_template_id uuid not null references resource_templates(id) on delete cascade,
  name text not null,
  sku text,
  unit text not null,
  attributes_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (length(trim(unit)) > 0)
);

create table if not exists supplier_prices (
  id uuid primary key default gen_random_uuid(),
  resource_variant_id uuid not null references resource_variants(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  cost numeric(12,2) not null check (cost >= 0),
  currency text not null default 'BOB' check (currency = 'BOB'),
  includes_tax boolean not null default false,
  is_preferred boolean not null default false,
  effective_from date not null default current_date,
  last_checked_at date,
  notes text,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (resource_variant_id, supplier_id, effective_from)
);

create unique index if not exists supplier_prices_one_preferred_per_variant
  on supplier_prices(resource_variant_id)
  where is_preferred and active;

create table if not exists supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  supplier_price_id uuid references supplier_prices(id) on delete set null,
  resource_variant_id uuid references resource_variants(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  old_cost numeric(12,2),
  new_cost numeric(12,2),
  currency text not null default 'BOB' check (currency = 'BOB'),
  old_includes_tax boolean,
  new_includes_tax boolean,
  changed_at timestamptz default now(),
  notes text
);

create or replace function log_supplier_price_change()
returns trigger
language plpgsql
as $$
begin
  if old.cost is distinct from new.cost or old.includes_tax is distinct from new.includes_tax then
    insert into supplier_price_history (
      supplier_price_id,
      resource_variant_id,
      supplier_id,
      old_cost,
      new_cost,
      currency,
      old_includes_tax,
      new_includes_tax,
      notes
    )
    values (
      old.id,
      old.resource_variant_id,
      old.supplier_id,
      old.cost,
      new.cost,
      new.currency,
      old.includes_tax,
      new.includes_tax,
      new.notes
    );
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists supplier_price_history_trigger on supplier_prices;
create trigger supplier_price_history_trigger
before update on supplier_prices
for each row
execute function log_supplier_price_change();

alter table resource_templates enable row level security;
alter table resource_attributes enable row level security;
alter table resource_attribute_values enable row level security;
alter table resource_variants enable row level security;
alter table supplier_prices enable row level security;
alter table supplier_price_history enable row level security;

create policy if not exists "authenticated can manage resource templates" on resource_templates for all to authenticated using (true) with check (true);
create policy if not exists "authenticated can manage resource attributes" on resource_attributes for all to authenticated using (true) with check (true);
create policy if not exists "authenticated can manage resource attribute values" on resource_attribute_values for all to authenticated using (true) with check (true);
create policy if not exists "authenticated can manage resource variants" on resource_variants for all to authenticated using (true) with check (true);
create policy if not exists "authenticated can manage supplier prices" on supplier_prices for all to authenticated using (true) with check (true);
create policy if not exists "authenticated can read supplier price history" on supplier_price_history for select to authenticated using (true);

insert into resource_categories (name, kind, sort_order, active)
values ('Materiales', 'Material', 10, true), ('Servicios', 'Servicio', 20, true)
on conflict (name) do nothing;

insert into resource_categories (name, kind, parent_id, sort_order, active)
select seed.name, seed.kind, parent.id, seed.sort_order, true
from (values
  ('Maderas', 'Material', 'Materiales', 10),
  ('Acrilicos', 'Material', 'Materiales', 20),
  ('Policarbonato', 'Material', 'Materiales', 30),
  ('Corte CNC', 'Servicio', 'Servicios', 10),
  ('Mano de obra', 'Mano de obra', 'Servicios', 20),
  ('Instalacion', 'Instalacion', 'Servicios', 30),
  ('Transporte', 'Transporte', 'Servicios', 40)
) as seed(name, kind, parent_name, sort_order)
join resource_categories parent on parent.name = seed.parent_name
on conflict (name) do nothing;

insert into suppliers (name, active)
values
  ('MADCenter', true),
  ('Cimal', true),
  ('Synergy', true),
  ('Acricolor', true),
  ('Gato', true),
  ('Jaime', true),
  ('Ramiro', true),
  ('Americo', true),
  ('DecoraZon CNC', true),
  ('Taxi', true),
  ('Camion Gato', true)
on conflict do nothing;

-- Migracion suave desde resource_catalog: no borra ni altera cotizaciones antiguas.
insert into resource_templates (id, category_id, kind, name, description, base_unit, active, created_at, updated_at)
select
  rc.id,
  cat.id,
  coalesce(nullif(rc.notes::jsonb ->> 'type', ''), 'Material'),
  rc.name,
  rc.specification,
  coalesce(nullif(rc.unit, ''), 'unidad'),
  coalesce(rc.is_active, true),
  rc.created_at,
  coalesce(rc.updated_at, now())
from resource_catalog rc
left join resource_categories cat on cat.name = coalesce(nullif(rc.notes::jsonb ->> 'subcategory', ''), nullif(rc.notes::jsonb ->> 'category', ''))
where rc.notes is not null
on conflict (id) do nothing;

insert into resource_variants (resource_template_id, name, unit, attributes_json, active, created_at, updated_at)
select
  rt.id,
  concat(rt.name, ' General'),
  rt.base_unit,
  jsonb_build_object(
    'Color', nullif(rc.specification, ''),
    'Espesor', nullif(rc.notes::jsonb ->> 'thickness', ''),
    'Tamano', nullif(rc.notes::jsonb ->> 'size', '')
  ),
  coalesce(rc.is_active, true),
  rc.created_at,
  coalesce(rc.updated_at, now())
from resource_templates rt
join resource_catalog rc on rc.id = rt.id
where not exists (
  select 1 from resource_variants rv where rv.resource_template_id = rt.id
);

insert into supplier_prices (resource_variant_id, supplier_id, cost, currency, includes_tax, is_preferred, effective_from, last_checked_at, active, created_at, updated_at)
select
  rv.id,
  s.id,
  greatest(coalesce(rc.base_cost, 0), 0),
  'BOB',
  false,
  true,
  coalesce(rc.last_price_update, current_date),
  rc.last_price_update,
  coalesce(rc.is_active, true),
  rc.created_at,
  coalesce(rc.updated_at, now())
from resource_variants rv
join resource_templates rt on rt.id = rv.resource_template_id
join resource_catalog rc on rc.id = rt.id
join suppliers s on s.name = coalesce(nullif(rc.notes::jsonb ->> 'supplier', ''), 'DecoraZon CNC')
where not exists (
  select 1 from supplier_prices sp where sp.resource_variant_id = rv.id and sp.supplier_id = s.id
);
