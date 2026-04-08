-- Executa este script se a tabela bet_houses ja existir e ainda nao tiver os valores.

alter table public.bet_houses
  add column if not exists deposit_amount numeric(12,2);

alter table public.bet_houses
  add column if not exists withdrawal_amount numeric(12,2);

update public.bet_houses
set
  deposit_amount = coalesce(deposit_amount, 0),
  withdrawal_amount = coalesce(withdrawal_amount, 0);

alter table public.bet_houses
  alter column deposit_amount set default 0,
  alter column withdrawal_amount set default 0,
  alter column deposit_amount set not null,
  alter column withdrawal_amount set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bet_houses_deposit_amount_non_negative_chk'
      and conrelid = 'public.bet_houses'::regclass
  ) then
    alter table public.bet_houses
      add constraint bet_houses_deposit_amount_non_negative_chk
      check (deposit_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bet_houses_withdrawal_amount_non_negative_chk'
      and conrelid = 'public.bet_houses'::regclass
  ) then
    alter table public.bet_houses
      add constraint bet_houses_withdrawal_amount_non_negative_chk
      check (withdrawal_amount >= 0);
  end if;
end $$;
