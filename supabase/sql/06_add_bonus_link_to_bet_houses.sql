-- Executa este script se a tabela bet_houses ja existir e ainda nao tiver bonus_link.

alter table public.bet_houses
  add column if not exists bonus_link text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bet_houses_bonus_link_http_chk'
      and conrelid = 'public.bet_houses'::regclass
  ) then
    alter table public.bet_houses
      add constraint bet_houses_bonus_link_http_chk
      check (bonus_link is null or bonus_link ~* '^https?://');
  end if;
end $$;
