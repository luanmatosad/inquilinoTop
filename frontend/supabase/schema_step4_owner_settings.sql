-- Tabela de preferências do proprietário
create table if not exists public.owner_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade unique,
  notify_payment_overdue boolean default true,
  notify_lease_expiring boolean default true,
  notify_lease_expiring_days integer default 30,
  notify_new_message boolean default true,
  notify_maintenance_request boolean default true,
  notify_payment_received boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS para Owner Settings
alter table public.owner_settings enable row level security;

create policy "Users can view own settings" 
  on public.owner_settings for select using (auth.uid() = owner_id);

create policy "Users can insert own settings" 
  on public.owner_settings for insert with check (auth.uid() = owner_id);

create policy "Users can update own settings" 
  on public.owner_settings for update using (auth.uid() = owner_id);

-- Índice
create index if not exists idx_owner_settings_owner_id on public.owner_settings(owner_id);

-- Trigger de updated_at
create trigger on_owner_settings_updated
  before update on public.owner_settings
  for each row execute procedure public.handle_updated_at();