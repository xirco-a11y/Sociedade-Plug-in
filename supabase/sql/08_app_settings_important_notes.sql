-- Executa este script para criar configuracoes globais da app.
-- Inclui a chave de observacoes importantes usada na pagina de Condicoes.

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from anon, authenticated;
grant select, insert, update, delete on table public.app_settings to service_role;

insert into public.app_settings (setting_key, setting_value)
values (
  'important_notes',
  '{
    "items": [
      "A todos os levantamentos, falta retirar o valor das taxas.",
      "Contra apostas feitas numa casa PT ou na betonblack quando for numa das outras 3 casas.",
      "Usar carteira digital para depositos e levantamentos.",
      "Minimizar as transferencias entre nos.",
      "Nao apostar no mesmo evento durante um rollover.",
      "Apostas em totais e handicaps nao estao elegiveis exceto na betonblack.",
      "Garantir que a ultima transacao nao foi um levantamento."
    ]
  }'::jsonb
)
on conflict (setting_key) do nothing;
