-- Executa este script no SQL Editor do Supabase.
-- Login com username/password usando hash bcrypt (pgcrypto).
-- Nota: no Supabase, pgcrypto costuma ficar no schema "extensions".

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

revoke all on table public.app_users from anon, authenticated;

create or replace function public.login_with_password(
  p_username text,
  p_password text
)
returns table (
  user_id uuid,
  username text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    id as user_id,
    username
  from public.app_users
  where username = lower(trim(p_username))
    and password_hash = extensions.crypt(p_password, password_hash)
  limit 1;
$$;

revoke all on function public.login_with_password(text, text) from public;
grant execute on function public.login_with_password(text, text) to service_role;

insert into public.app_users (username, password_hash)
values
  ('goncalo', extensions.crypt('Goncalo@123', extensions.gen_salt('bf', 12))),
  ('xico', extensions.crypt('Xico@123', extensions.gen_salt('bf', 12)))
on conflict (username) do nothing;
