-- Correcoes de permissoes para o role service_role na tabela bet_houses.
-- Executar no SQL Editor do Supabase, se houver erro de permissao.

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.bet_houses to service_role;
