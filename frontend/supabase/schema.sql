-- Script Completo para InquilinoTop MVP - Etapa 1
-- Inclui: Profiles, Properties, Units, Triggers e RLS

-- Habilitar extensão para UUIDs se necessário (geralmente já vem habilitada)
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Tabela PROFILES (Extensão pública da tabela auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  updated_at timestamptz,
  created_at timestamptz default now()
);

-- RLS para Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone" 
  on public.profiles for select using (true);

create policy "Users can insert their own profile" 
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile" 
  on public.profiles for update using (auth.uid() = id);

-- Trigger para criar profile automaticamente ao criar usuário no Auth
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger se existir para evitar duplicação no setup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 2. Tabela PROPERTIES (Imóveis)
-- -----------------------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('RESIDENTIAL', 'SINGLE')),
  name text not null,
  address_line text,
  city text,
  state text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS para Properties
alter table public.properties enable row level security;

-- Policies (garante acesso apenas ao dono)
drop policy if exists "Users can view own properties" on public.properties;
create policy "Users can view own properties" 
  on public.properties for select using (auth.uid() = owner_id);

drop policy if exists "Users can insert own properties" on public.properties;
create policy "Users can insert own properties" 
  on public.properties for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update own properties" on public.properties;
create policy "Users can update own properties" 
  on public.properties for update using (auth.uid() = owner_id);

drop policy if exists "Users can delete own properties" on public.properties;
create policy "Users can delete own properties" 
  on public.properties for delete using (auth.uid() = owner_id);


-- -----------------------------------------------------------------------------
-- 3. Tabela UNITS (Unidades)
-- -----------------------------------------------------------------------------
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  floor text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS para Units
alter table public.units enable row level security;

-- Policies (garante acesso se a propriedade pertencer ao usuário)
drop policy if exists "Users can view units of own properties" on public.units;
create policy "Users can view units of own properties"
  on public.units for select
  using (
    exists (
      select 1 from public.properties
      where public.properties.id = public.units.property_id
      and public.properties.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can insert units to own properties" on public.units;
create policy "Users can insert units to own properties"
  on public.units for insert
  with check (
    exists (
      select 1 from public.properties
      where public.properties.id = public.units.property_id
      and public.properties.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can update units of own properties" on public.units;
create policy "Users can update units of own properties"
  on public.units for update
  using (
    exists (
      select 1 from public.properties
      where public.properties.id = public.units.property_id
      and public.properties.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can delete units of own properties" on public.units;
create policy "Users can delete units of own properties"
  on public.units for delete
  using (
    exists (
      select 1 from public.properties
      where public.properties.id = public.units.property_id
      and public.properties.owner_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 4. Utilitários (Índices e Triggers de Update)
-- -----------------------------------------------------------------------------

-- Índices para performance
create index if not exists idx_properties_owner_id on public.properties(owner_id);
create index if not exists idx_units_property_id on public.units(property_id);

-- Função para atualizar updated_at automaticamente
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers de updated_at
drop trigger if exists on_properties_updated on public.properties;
create trigger on_properties_updated
  before update on public.properties
  for each row execute procedure public.handle_updated_at();

drop trigger if exists on_units_updated on public.units;
create trigger on_units_updated
  before update on public.units
  for each row execute procedure public.handle_updated_at();

drop trigger if exists on_profiles_updated on public.profiles;
create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
