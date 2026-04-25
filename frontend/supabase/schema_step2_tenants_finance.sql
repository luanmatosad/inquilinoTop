-- ETAPA 2: Inquilinos, Contratos e Financeiro

-- -----------------------------------------------------------------------------
-- 4. Tabela TENANTS (Inquilinos)
-- -----------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade, -- Quem cadastrou (o locador)
  name text not null,
  email text,
  phone text,
  document text, -- CPF ou RG
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS para Tenants
alter table public.tenants enable row level security;

create policy "Users can view own tenants" 
  on public.tenants for select using (auth.uid() = owner_id);

create policy "Users can insert own tenants" 
  on public.tenants for insert with check (auth.uid() = owner_id);

create policy "Users can update own tenants" 
  on public.tenants for update using (auth.uid() = owner_id);

create policy "Users can delete own tenants" 
  on public.tenants for delete using (auth.uid() = owner_id);


-- -----------------------------------------------------------------------------
-- 5. Tabela LEASES (Contratos de Aluguel)
-- Vincula uma Unidade a um Inquilino por um período
-- -----------------------------------------------------------------------------
create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  start_date date not null,
  end_date date, -- Pode ser nulo se for contrato indeterminado
  rent_amount numeric(10,2) not null, -- Valor do aluguel
  payment_day integer not null check (payment_day between 1 and 31), -- Dia de vencimento
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ENDED', 'CANCELED')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS para Leases
alter table public.leases enable row level security;

-- Policies complexas: O usuário pode ver leases se a unidade pertence a uma propriedade dele
create policy "Users can manage leases of own units"
  on public.leases for all
  using (
    exists (
      select 1 from public.units
      join public.properties on public.properties.id = public.units.property_id
      where public.units.id = public.leases.unit_id
      and public.properties.owner_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 6. Tabela PAYMENTS (Financeiro/Pagamentos)
-- Registra cobranças geradas a partir do contrato
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  description text not null, -- Ex: "Aluguel Janeiro/2026"
  amount numeric(10,2) not null,
  due_date date not null,
  paid_at timestamptz, -- Se nulo, não foi pago
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'LATE', 'CANCELED')),
  type text not null default 'RENT' check (type in ('RENT', 'DEPOSIT', 'EXPENSE', 'OTHER')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS para Payments
alter table public.payments enable row level security;

-- Policies: Acesso via lease -> unit -> property -> owner
create policy "Users can manage payments of own leases"
  on public.payments for all
  using (
    exists (
      select 1 from public.leases
      join public.units on public.units.id = public.leases.unit_id
      join public.properties on public.properties.id = public.units.property_id
      where public.leases.id = public.payments.lease_id
      and public.properties.owner_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- Índices e Triggers
-- -----------------------------------------------------------------------------

create index if not exists idx_tenants_owner_id on public.tenants(owner_id);
create index if not exists idx_leases_unit_id on public.leases(unit_id);
create index if not exists idx_leases_tenant_id on public.leases(tenant_id);
create index if not exists idx_payments_lease_id on public.payments(lease_id);
create index if not exists idx_payments_due_date on public.payments(due_date);

-- Triggers de updated_at
create trigger on_tenants_updated
  before update on public.tenants
  for each row execute procedure public.handle_updated_at();

create trigger on_leases_updated
  before update on public.leases
  for each row execute procedure public.handle_updated_at();

create trigger on_payments_updated
  before update on public.payments
  for each row execute procedure public.handle_updated_at();
