# Sociedade Plug In

Pagina inicial de demonstracao em HTML/CSS.

## Estrutura

```text
Sociedade-Plug-in-1/
|- api/
|  `- supabase-config.js
|- assets/
|  |- css/
|  |  `- style.css
|  |- js/
|  |  `- main.js
|  `- img/
`- pages/
   `- index.html
```

## Como abrir

1. Abre o ficheiro `pages/index.html` no navegador.

## Ligar Supabase na Vercel

1. No dashboard da Vercel, abre o projeto e vai a `Settings > Environment Variables`.
2. Cria as variaveis:
   - `SUPABASE_URL` (exemplo: `https://xxxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` (a `anon public key` do Supabase)
3. Faz `Redeploy`.
4. A pagina vai buscar estas variaveis em `/api/supabase-config` e inicializar o cliente automaticamente.
