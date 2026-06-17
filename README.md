# Stationary ERP

A React 19 + Vite 7 + Tailwind 4 ERP for stationery retail (sales, purchases, inventory, returns, and accounts). Supabase is the only backend — the app talks directly to Postgres via `@supabase/supabase-js`; there is no separate API server. Deployed as a static SPA.

## Development

```bash
npm install
npm run dev   # Vite dev server on :5173
npm run lint  # ESLint
npm run test  # Vitest run-once
```

Copy `.env.example` to `.env` and fill in your Supabase credentials.

## Deployment

The app is a static SPA (Vite build → `dist/`). Supabase is the only backend, so there is no server to deploy — just the static bundle plus a single-page-app rewrite.

### Environment variables

Set these in your host's environment (and in a local `.env` for development — see `.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase anon/public key (client auth) |
| `VITE_SUPABASE_SERVICE_KEY` | no | Service-role key — only for `./scripts/backup.sh` to bypass RLS. **Never expose this to the client build.** |

Because these are baked into the bundle at build time, a value change requires a rebuild/redeploy.

### Build

```bash
npm install
npm run build   # outputs to dist/
npm run preview # optional: serve the production build locally
```

### Netlify

`netlify.toml` already configures the SPA fallback. Set:
- Build command: `npm run build`
- Publish directory: `dist`
- Add the `VITE_*` env vars under Site settings → Environment.

### Vercel

`vercel.json` already configures the SPA rewrite. Vercel auto-detects the Vite preset (build `npm run build`, output `dist`). Add the `VITE_*` env vars under Project → Settings → Environment Variables.

### Two-store setup

Each store is a separate deployment backed by its own Supabase database. The code is identical — branding (favicon, title, logo) is data-driven from the `store_settings` table, not hardcoded. To stand up a new store, create a fresh Supabase project, run the migrations in `supabase/migrations/`, and deploy with that project's URL and anon key.

### Database migrations

Migrations are **not** run by any deploy step. Apply SQL files in `supabase/migrations/NNN_*.sql` manually via the Supabase SQL editor, in order, before (or alongside) the matching app release.
