# Sociedade Plug In

Pagina inicial de demonstracao com login (`username` + `password`) ligado ao Supabase.

## Estrutura

```text
Sociedade-Plug-in-1/
|- api/
|  `- login.js
|- assets/
|  |- css/
|  |  `- style.css
|  |- js/
|  |  `- main.js
|  `- img/
|- pages/
|  `- index.html
`- supabase/
   `- sql/
      `- 01_auth_setup.sql
```

## Como abrir

1. Abre o ficheiro `pages/index.html` no navegador.

## Configurar Supabase

1. No Supabase, abre o `SQL Editor`.
2. Executa o script `supabase/sql/01_auth_setup.sql`.
3. Isso cria a tabela `public.app_users`, a funcao `login_with_password` e 2 utilizadores:
   - `admin` / `Admin@123`
   - `demo` / `Demo@123`

## Configurar Vercel

1. No dashboard da Vercel, abre o projeto e vai a `Settings > Environment Variables`.
2. Cria as variaveis:
   - `SUPABASE_URL` (exemplo: `https://xxxxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` (Service Role Key do Supabase)
3. Faz `Redeploy`.
4. O frontend envia login para `/api/login`, e o backend valida no Supabase.

## Nota de seguranca

- As passwords ficam guardadas com hash bcrypt via `pgcrypto` (`crypt(..., gen_salt('bf', 12))`).
- Troca as passwords de exemplo antes de usar em producao.
