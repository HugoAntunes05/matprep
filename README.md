# MatPrep — Supabase + Railway

## Passos obrigatórios no Supabase

### A) Login e link (CLI)

```bash
npx supabase login
npx supabase link --project-ref rnxyxernvliyxpwldjee
# pede a password da base (Dashboard → Project Settings → Database)
npx supabase db push
```

**Ou** no Dashboard → **SQL Editor**: cola e corre o ficheiro  
`supabase/migrations/20260719000100_matprep_schema.sql`

### B) Auth anónima

Dashboard → **Authentication** → **Providers** → ativa **Anonymous**.

### C) Seed do conteúdo

1. Dashboard → **Settings → API** → copia a **service_role** (secreta).
2. No `.env`:

```env
SUPABASE_URL=https://rnxyxernvliyxpwldjee.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_hLCpmcyokTzZZy1FmWiF4A_ReNOGxEq
SUPABASE_SERVICE_ROLE_KEY=cola_aqui_a_service_role
```

3. Corre:

```bash
npm install
npm run seed
```

## Railway

1. New Project → Deploy from GitHub (ou `railway up`).
2. Variáveis:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://rnxyxernvliyxpwldjee.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_hLCpmcyokTzZZy1FmWiF4A_ReNOGxEq` |

3. **Não** coloques `SERVICE_ROLE` nem a password Postgres no Railway (só no seed local).
4. Start command: `npm start` · Healthcheck: `/health`

## Local

```bash
npm install
npm start
# http://localhost:3000
```

A app lê `temas`, `questoes`, `abertas`, `materiais` no Supabase; se a BD estiver vazia, usa `dados.js`. O progresso grava em `localStorage` e sincroniza na tabela `progresso` (utilizador anónimo).

## Backoffice

URL: `/admin` (ou `/backoffice`)

Password: variável `ADMIN_PASSWORD` (default local: `tibas132`)

Requisitos no servidor:
- `SUPABASE_SERVICE_ROLE_KEY`
- migration `20260719000200_atividade_backoffice.sql` aplicada (`npx supabase db push` ou SQL Editor)

O backoffice mostra, por aluno:
- minutos de estudo e de vídeo
- lições abertas/concluídas e tempo em cada uma
- vídeos (segundos, %, plays)
- perguntas vistas/respondidas/certas/erradas
- linha temporal de eventos (navegação, materiais, exames, etc.)

## Connection string Postgres (só admin)

```
postgresql://postgres:[YOUR-PASSWORD]@db.rnxyxernvliyxpwldjee.supabase.co:5432/postgres
```

Substitui `[YOUR-PASSWORD]` pela password real do projeto. Não commits esta string.
