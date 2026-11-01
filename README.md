# Master Dashboard

A personal fitness dashboard that pulls your training data into one database and one page.
Phase 1 (this branch) syncs **Hevy**: workouts, exercises, sets, exercise templates and body measurements.
Phase 2 brings over the full dashboard UI and the animated avatar.

## Run it

```bash
npm install
cp .env.example .env.local   # HEVY_MOCK=1 is on by default
npm run dev
```

Open http://localhost:3000 and press **Sync now**. With `HEVY_MOCK=1` you get about four months of realistic sample workouts, so everything works before you have a Hevy key.

## Connect your real Hevy account

1. Hevy Pro is required. Get your key at https://hevy.com/settings?developer.
2. In `.env.local` set `HEVY_API_KEY=<your key>` and remove `HEVY_MOCK=1` (or set it to `0`).
3. Delete `./.data` to drop the sample data, then press **Sync now** (or run `npm run sync`).

The first sync downloads your whole history. After that, each sync only asks Hevy for changes since the last one
(`/v1/workouts/events`), so edits and deletions in the app show up here too.

## Database

- No `DATABASE_URL`: an embedded Postgres (PGlite) stored in `./.data`. Zero setup, ideal for local work.
- `DATABASE_URL` set: any Postgres. For Supabase use **Project Settings → Database → Connection string → Transaction pooler** (port 6543).

Migrations live in `./drizzle` and run automatically on first connection. After editing `src/db/schema.ts`, run `npm run db:generate`.

## Deploying (Vercel + Supabase)

Set `HEVY_API_KEY`, `DATABASE_URL`, `SYNC_SECRET` and `CRON_SECRET` in Vercel. `vercel.json` schedules a daily sync at 05:00 UTC
(Vercel's Hobby plan allows one cron run per day). In production, `POST /api/sync` requires the `x-sync-secret` header.

## Layout

| Path | What it does |
|---|---|
| `src/lib/hevy/client.ts` | Hevy API client: auth header, pagination, retries on 429/5xx |
| `src/lib/hevy/mock.ts` | Stand-in for the Hevy API, same paths and JSON shapes |
| `src/lib/sync/hevy.ts` | Full backfill on first run, incremental change feed afterwards |
| `src/lib/metrics.ts` | Weekly totals, main-lift e1RM trends, PRs, avatar inputs |
| `src/app/api/sync` | Runs a sync (Vercel Cron uses GET, the page uses POST) |
| `src/app/api/dashboard` | Everything the dashboard needs, as JSON |
| `scripts/sync.ts` | `npm run sync` from the command line |
