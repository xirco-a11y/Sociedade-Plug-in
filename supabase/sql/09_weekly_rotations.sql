-- Executa este script para criar/atualizar a folha semanal de rotacoes.
-- Inclui dois tipos de registo:
-- 1) rotation (protecao normal entre casa 1 e casa 2)
-- 2) bonus_payout (registo direto do lucro individual de bonus)

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.weekly_rotations (
  id uuid primary key default gen_random_uuid(),
  username text not null check (username in ('goncalo', 'xico')),
  entry_type text not null default 'rotation',
  rotation_date date not null,
  house_a_id uuid not null references public.bet_houses(id) on delete restrict,
  house_b_id uuid references public.bet_houses(id) on delete restrict,
  amount_house_a numeric(12,2) not null default 0 check (amount_house_a >= 0),
  amount_house_b numeric(12,2) not null default 0 check (amount_house_b >= 0),
  house_a_bet text,
  house_a_odd numeric(8,2),
  house_b_bet text,
  house_b_odd numeric(8,2),
  profit_loss numeric(12,2) not null default 0,
  bet_label text,
  match_label text,
  odd numeric(8,2) check (odd is null or odd >= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_rotations_entry_type_chk
    check (entry_type in ('rotation', 'bonus_payout')),
  constraint weekly_rotations_house_diff_chk
    check (house_b_id is null or house_b_id <> house_a_id),
  constraint weekly_rotations_house_b_required_chk
    check (
      (entry_type = 'rotation' and house_b_id is not null)
      or (entry_type = 'bonus_payout' and house_b_id is null)
    )
);

alter table public.weekly_rotations
  add column if not exists entry_type text;

alter table public.weekly_rotations
  add column if not exists house_a_bet text;

alter table public.weekly_rotations
  add column if not exists house_a_odd numeric(8,2);

alter table public.weekly_rotations
  add column if not exists house_b_bet text;

alter table public.weekly_rotations
  add column if not exists house_b_odd numeric(8,2);

update public.weekly_rotations
set entry_type = case
  when lower(btrim(coalesce(entry_type, ''))) = 'bonus_payout' then 'bonus_payout'
  when house_b_id is null then 'bonus_payout'
  else 'rotation'
end;

update public.weekly_rotations
set house_a_bet = coalesce(
  nullif(btrim(house_a_bet), ''),
  nullif(btrim(bet_label), ''),
  case
    when entry_type = 'bonus_payout' then 'bonus pagou'
    else 'sem descricao'
  end
)
where house_a_bet is null or btrim(house_a_bet) = '';

update public.weekly_rotations
set house_b_bet = coalesce(nullif(btrim(house_b_bet), ''), nullif(btrim(match_label), ''), 'sem descricao')
where entry_type = 'rotation'
  and (house_b_bet is null or btrim(house_b_bet) = '');

update public.weekly_rotations
set house_a_odd = coalesce(house_a_odd, odd, 1.00)
where house_a_odd is null;

update public.weekly_rotations
set house_b_odd = coalesce(house_b_odd, 1.00)
where entry_type = 'rotation'
  and house_b_odd is null;

update public.weekly_rotations
set house_a_odd = 1.00
where house_a_odd < 1;

update public.weekly_rotations
set house_b_odd = 1.00
where entry_type = 'rotation'
  and house_b_odd < 1;

update public.weekly_rotations
set house_b_id = null,
    amount_house_a = 0,
    amount_house_b = 0,
    house_a_bet = coalesce(nullif(btrim(house_a_bet), ''), 'bonus pagou'),
    house_a_odd = coalesce(case when house_a_odd >= 1 then house_a_odd else null end, 1.00),
    house_b_bet = null,
    house_b_odd = null,
    bet_label = coalesce(nullif(btrim(bet_label), ''), 'bonus pagou'),
    match_label = null,
    odd = null
where entry_type = 'bonus_payout';

alter table public.weekly_rotations
  alter column house_b_id drop not null,
  alter column house_b_bet drop not null,
  alter column house_b_odd drop not null;

alter table public.weekly_rotations
  alter column entry_type set default 'rotation',
  alter column house_a_bet set default 'sem descricao',
  alter column house_a_odd set default 1.00,
  alter column house_b_bet drop default,
  alter column house_b_odd drop default;

alter table public.weekly_rotations
  alter column entry_type set not null,
  alter column house_a_bet set not null,
  alter column house_a_odd set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'weekly_rotations_entry_type_chk'
      and conrelid = 'public.weekly_rotations'::regclass
  ) then
    alter table public.weekly_rotations
      drop constraint weekly_rotations_entry_type_chk;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'weekly_rotations_house_diff_chk'
      and conrelid = 'public.weekly_rotations'::regclass
  ) then
    alter table public.weekly_rotations
      drop constraint weekly_rotations_house_diff_chk;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'weekly_rotations_house_b_required_chk'
      and conrelid = 'public.weekly_rotations'::regclass
  ) then
    alter table public.weekly_rotations
      drop constraint weekly_rotations_house_b_required_chk;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'weekly_rotations_house_b_fields_chk'
      and conrelid = 'public.weekly_rotations'::regclass
  ) then
    alter table public.weekly_rotations
      drop constraint weekly_rotations_house_b_fields_chk;
  end if;

  alter table public.weekly_rotations
    add constraint weekly_rotations_entry_type_chk
    check (entry_type in ('rotation', 'bonus_payout'));

  alter table public.weekly_rotations
    add constraint weekly_rotations_house_diff_chk
    check (house_b_id is null or house_b_id <> house_a_id);

  alter table public.weekly_rotations
    add constraint weekly_rotations_house_b_required_chk
    check (
      (entry_type = 'rotation' and house_b_id is not null)
      or (entry_type = 'bonus_payout' and house_b_id is null)
    );

  alter table public.weekly_rotations
    add constraint weekly_rotations_house_b_fields_chk
    check (
      (entry_type = 'bonus_payout' and house_b_bet is null and house_b_odd is null)
      or (
        entry_type = 'rotation'
        and house_b_bet is not null
        and btrim(house_b_bet) <> ''
        and house_b_odd is not null
      )
    );
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'weekly_rotations_house_a_odd_chk'
      and conrelid = 'public.weekly_rotations'::regclass
  ) then
    alter table public.weekly_rotations
      drop constraint weekly_rotations_house_a_odd_chk;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'weekly_rotations_house_b_odd_chk'
      and conrelid = 'public.weekly_rotations'::regclass
  ) then
    alter table public.weekly_rotations
      drop constraint weekly_rotations_house_b_odd_chk;
  end if;

  alter table public.weekly_rotations
    add constraint weekly_rotations_house_a_odd_chk
    check (house_a_odd >= 1);

  alter table public.weekly_rotations
    add constraint weekly_rotations_house_b_odd_chk
    check (house_b_odd is null or house_b_odd >= 1);
end $$;

create index if not exists weekly_rotations_user_date_idx
  on public.weekly_rotations (username, rotation_date desc);

create index if not exists weekly_rotations_house_a_date_idx
  on public.weekly_rotations (house_a_id, rotation_date desc);

create index if not exists weekly_rotations_house_b_date_idx
  on public.weekly_rotations (house_b_id, rotation_date desc);

alter table public.weekly_rotations enable row level security;

revoke all on table public.weekly_rotations from anon, authenticated;
grant select, insert, update, delete on table public.weekly_rotations to service_role;
