-- Executa este script depois do 01_auth_setup.sql
-- Tabela de casas com configuracoes de deposito/bonus e avisos.

create table if not exists public.bet_houses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  owner_name text not null check (owner_name in ('goncalo', 'xico', 'ambos')),
  deposit_weekday int not null check (deposit_weekday between 1 and 7),
  deposit_deadline text not null default '23:59',
  bonus_weekday int not null check (bonus_weekday between 1 and 7),
  bonus_label text,
  reminder_enabled boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.bet_houses enable row level security;

revoke all on table public.bet_houses from anon, authenticated;
grant select, insert, update, delete on table public.bet_houses to service_role;

insert into public.bet_houses (
  name,
  owner_name,
  deposit_weekday,
  deposit_deadline,
  bonus_weekday,
  bonus_label,
  reminder_enabled,
  notes
)
values
  ('betonblack', 'ambos', 5, '23:59', 5, 'sexta ate as 23h59', true, 'cada um na sua casa'),
  ('winwin', 'goncalo', 4, '23:59', 4, 'quinta ate as 23h59', true, null),
  ('22bet', 'xico', 5, '23:59', 5, 'sexta ate as 23h59', true, null),
  ('betlabel', 'goncalo', 6, '23:59', 6, 'sabado ate as 23h59', true, null),
  ('solverde', 'ambos', 3, '23:00', 4, 'quinta', true, 'exemplo de casa extra'),
  ('esc-online', 'xico', 2, '22:30', 3, 'quarta', true, 'exemplo de casa extra'),
  ('luckia', 'goncalo', 1, '21:00', 2, 'terca', true, 'exemplo de casa extra')
on conflict (name) do nothing;
