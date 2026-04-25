-- ETAPA 3: Despesas (Expenses)
-- Controle de contas da unidade (Água, Luz, Condomínio, IPTU, etc)

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  description text not null, -- Ex: "Conta de Luz - Jan/2026"
  category text not null, -- Ex: 'ELECTRICITY', 'WATER', 'CONDO', 'TAX', 'MAINTENANCE', 'OTHER'
  amount numeric(10,2) not null,
  due_date date not null,
  paid_at timestamptz, -- Se nulo, não foi pago
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS para Expenses
alter table public.expenses enable row level security;

-- Policies: Acesso via unit -> property -> owner
create policy "Users can manage expenses of own units"
  on public.expenses for all
  using (
    exists (
      select 1 from public.units
      join public.properties on public.properties.id = public.units.property_id
      where public.units.id = public.expenses.unit_id
      and public.properties.owner_id = auth.uid()
    )
  );

-- Índices
create index if not exists idx_expenses_unit_id on public.expenses(unit_id);
create index if not exists idx_expenses_due_date on public.expenses(due_date);

-- Trigger de update
create trigger on_expenses_updated
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();
