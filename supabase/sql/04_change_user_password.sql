-- Executar no SQL Editor do Supabase.
-- Permite alterar senha validando a senha atual.
-- Nota: no Supabase, pgcrypto costuma ficar no schema "extensions".

create extension if not exists pgcrypto with schema extensions;

create or replace function public.change_user_password(
  p_username text,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
begin
  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'A nova senha deve ter pelo menos 8 caracteres.';
  end if;

  select id
  into v_user_id
  from public.app_users
  where username = lower(trim(p_username))
    and password_hash = extensions.crypt(p_current_password, password_hash)
  limit 1;

  if v_user_id is null then
    return false;
  end if;

  update public.app_users
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12))
  where id = v_user_id;

  return true;
end;
$$;

revoke all on function public.change_user_password(text, text, text) from public;
grant execute on function public.change_user_password(text, text, text) to service_role;
