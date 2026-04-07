# Sociedade Plug In

App simples para gerir uma sociedade de casas de apostas: login, configuracoes, avisos e pagina de condicoes.

## Estrutura

```text
Sociedade-Plug-in-1/
|- api/
|  |- change-password.js
|  |- login.js
|  `- houses.js
|- assets/
|  |- css/
|  |  |- style.css
|  |  `- app.css
|  |- js/
|  |  |- main.js
|  |  `- app.js
|  `- img/
|- pages/
|  |- index.html
|  |- app.html
|  |- configuracoes.html
|  |- avisos-hoje.html
|  `- proximos-alertas.html
|  `- condicoes.html
|- supabase/
|  `- sql/
|     |- 01_auth_setup.sql
|     |- 02_houses_setup.sql
|     |- 03_fix_bet_houses_permissions.sql
|     |- 04_change_user_password.sql
|     `- 05_fix_crypt_extensions_compat.sql
`- vercel.json
```

## Funcionalidades

- Login com `username` e `password`
- Passwords com hash bcrypt (pgcrypto)
- Configuracoes com 2 menus:
  - gestao de casas (adicao, edicao, remocao)
  - redefinicao de senha (senha atual + nova senha)
- Avisos por casa:
  - dia anterior ao deposito (verificar se esta tudo correto)
  - no dia do bonus/deposito (nao esquecer de depositar)
- Pagina de condicoes com as tabelas/regras da sociedade

## Configurar Supabase

1. Abrir `SQL Editor` no Supabase.
2. Executar `supabase/sql/01_auth_setup.sql`.
3. Executar `supabase/sql/02_houses_setup.sql`.
4. Executar `supabase/sql/04_change_user_password.sql`.
5. Se aparecer erro `crypt(text, text) does not exist`, executar `supabase/sql/05_fix_crypt_extensions_compat.sql`.

Utilizadores iniciais:
- `goncalo` / `Goncalo@123`
- `xico` / `Xico@123`

## Configurar Vercel

1. Em `Settings > Environment Variables`, criar:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Fazer `Redeploy`.

Rotas principais:
- `/` login
- `/app` painel da sociedade
- `/configuracoes`
- `/avisos-hoje`
- `/proximos-alertas`
- `/condicoes` pagina de condicoes

## Notas de Avisos

- Os avisos da app aparecem no painel automaticamente.
- As notificacoes do browser precisam de permissao do utilizador (botao `Ativar Avisos`).
- Em browser normal, as notificacoes sao disparadas quando a app esta aberta.
