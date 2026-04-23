# Sociedade Plug In

App simples para gerir uma sociedade de casas de apostas: login, configuracoes, avisos, condicoes, calculadora hedge e folha semanal de rotacoes.

## Estrutura

```text
Sociedade-Plug-in-1/
|- api/
|  |- change-password.js
|  |- login.js
|  |- houses.js
|  |- settings.js
|  `- rotations.js
|- assets/
|  |- css/
|  |  |- style.css
|  |  `- app.css
|  |- js/
|  |  |- main.js
|  |  |- app.js
|  |  |- hedge.js
|  |  `- rotacoes-semanais.js
|  `- icons/
|- pages/
|  |- index.html
|  |- app.html
|  |- configuracoes.html
|  |- avisos-hoje.html
|  |- proximos-alertas.html
|  |- rotacoes-semanais.html
|  |- condicoes.html
|  `- calculadora-hedge.html
|- supabase/
|  `- sql/
|     |- 01_auth_setup.sql
|     |- 02_houses_setup.sql
|     |- 03_fix_bet_houses_permissions.sql
|     |- 04_change_user_password.sql
|     |- 05_fix_crypt_extensions_compat.sql
|     |- 06_add_bonus_link_to_bet_houses.sql
|     |- 07_add_house_values_to_bet_houses.sql
|     |- 08_app_settings_important_notes.sql
|     `- 09_weekly_rotations.sql
`- vercel.json
```

## Funcionalidades

- Login com `username` e `password`
- Passwords com hash bcrypt (pgcrypto)
- Configuracoes com 3 menus:
  - gestao de casas (adicao, edicao, remocao)
  - link de bonus opcional por casa
  - valor de deposito e valor de levantamento por casa
  - observacoes importantes editaveis e guardadas na base de dados
  - redefinicao de senha (senha atual + nova senha)
- Avisos por casa:
  - dia anterior ao deposito (verificar se esta tudo correto)
  - no dia do bonus/deposito (nao esquecer de depositar)
- Pagina de condicoes com as tabelas/regras da sociedade
  - lucro por casa calculado como `levantamento - deposito`
- Calculadora hedge com tabela dinamica por range de odds
- Rotacoes semanais por utilizador:
  - cada user ve apenas a sua folha
  - estatisticas da sociedade (soma de todas as rotacoes) lado a lado para `Global` e `Semana atual`
  - em cada secao: `Lucro sociedade`, `Prejuizo com protecoes` e `Lucro - Prejuizo`
  - tabela semanal com casas no topo e dias (segunda a domingo) na esquerda
  - cada celula mostra `check` se ja houve aposta nessa casa/dia, senao mostra `X`
  - no dia de bonus da casa, mostra `bonus` a azul em vez de `check/X`
  - ao passar o rato no `check`, aparecem detalhes da(s) rotacao(oes) desse dia/casa
  - botao `Nova rotacao` com preenchimento de casa 1 e casa 2
  - botao `Bonus Pagou` para registar diretamente o lucro individual (sem calculos automáticos)
  - botao discreto `Apagar protecoes` com filtro por dia/casa para remover registos
  - por casa: valor apostado, odd e descricao do que foi apostado
  - registo final apenas com lucro/prejuizo da rotacao (sem estados green/red/pending)

## Configurar Supabase

1. Abrir `SQL Editor` no Supabase.
2. Executar `supabase/sql/01_auth_setup.sql`.
3. Executar `supabase/sql/02_houses_setup.sql`.
4. Executar `supabase/sql/04_change_user_password.sql`.
5. Se aparecer erro `crypt(text, text) does not exist`, executar `supabase/sql/05_fix_crypt_extensions_compat.sql`.
6. Executar `supabase/sql/06_add_bonus_link_to_bet_houses.sql` para adicionar o campo opcional `bonus_link`.
7. Executar `supabase/sql/07_add_house_values_to_bet_houses.sql` para adicionar os valores de deposito e levantamento por casa.
8. Executar `supabase/sql/08_app_settings_important_notes.sql` para criar as observacoes importantes editaveis.
9. Executar `supabase/sql/09_weekly_rotations.sql` para criar a tabela de registos semanais de rotacao.

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
- `/rotacoes-semanais`
- `/condicoes`
- `/calculadora-hedge`

Rotas API:
- `POST /api/login`
- `GET|POST|PUT|DELETE /api/houses`
- `POST /api/change-password`
- `GET|PUT /api/settings`
- `GET|POST|DELETE /api/rotations`

## Notas de Avisos

- Os avisos da app aparecem no painel automaticamente.
- As notificacoes do browser precisam de permissao do utilizador (botao `Ativar Avisos`).
- Em browser normal, as notificacoes sao disparadas quando a app esta aberta.

