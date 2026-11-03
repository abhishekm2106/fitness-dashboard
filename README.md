# Master Dashboard

A personal fitness dashboard that pulls your training data into one database and one page.
It syncs **Hevy** (workouts, exercises, sets, exercise templates and body measurements), shows it all on one dashboard
with an animated avatar, and sits behind sign-in with an **email code**, **Google** or **Apple**.

## Run it

```bash
npm install
cp .env.example .env.local   # HEVY_MOCK=1 is on by default
npm run dev
```

Open http://localhost:3000, sign in (see below), and press **Sync now**. With `HEVY_MOCK=1` you get about four months of realistic sample workouts, so everything works before you have a Hevy key.

## Connect your real Hevy account

1. Hevy Pro is required. Get your key at https://hevy.com/settings?developer.
2. In `.env.local` set `HEVY_API_KEY=<your key>` and remove `HEVY_MOCK=1` (or set it to `0`).
3. Delete `./.data` to drop the sample data, then press **Sync now** (or run `npm run sync`).

The first sync downloads your whole history. After that, each sync only asks Hevy for changes since the last one
(`/v1/workouts/events`), so edits and deletions in the app show up here too.

## Sign-in

Every page and API route needs a signed-in user, except `/login` and the sign-in flow itself. Sessions are signed
cookies (Auth.js, JWT strategy); the database keeps users, their linked Google/Apple logins and pending email codes.

1. Generate the session secret and put it in `.env.local` as `AUTH_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. List who may sign in: `ALLOWED_EMAILS=you@gmail.com,you@icloud.com`. Locally an empty list lets anyone in;
   in production an empty list lets nobody in.
3. Set up any of the methods below. Google's button stays disabled until its two variables are set; Apple's is hidden behind a flag.

### Email code

Enter your email, get a 6-digit code (and a one-tap link in the same email), type it in. Codes only go to
addresses on the allowlist, expire after 10 minutes, are replaced by a newer code, and stop working after
5 wrong guesses. Only a hash of each code is stored.

- **Locally** it works with no setup: the code is printed in the terminal running `npm run dev`.
- **To send real emails**, create a free [Resend](https://resend.com) account and an API key, and set `AUTH_RESEND_KEY`.
  Without your own domain, Resend can only send to the email you signed up with, which is fine for a private dashboard.
  To send from your own address, verify your domain in Resend and set `AUTH_EMAIL_FROM`, e.g. `Master Dashboard <login@yourdomain.com>`.
- In production, email sign-in is offered only once `AUTH_RESEND_KEY` is set.

### Google

1. In the Google Cloud console, open **APIs & Services → Credentials → Create credentials → OAuth client ID**
   (configure the consent screen first if asked; "External" with yourself as a test user is enough).
2. Application type **Web application**. Authorized redirect URIs:
   `http://localhost:3000/api/auth/callback/google` and `https://<your-domain>/api/auth/callback/google`.
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

### Apple

Needs a paid Apple Developer account. Apple only redirects to HTTPS domains, so Sign in with Apple can't
be tested on `localhost`; try it on your deployed URL (or an HTTPS tunnel).

The button is behind a feature flag and stays hidden until `ENABLE_APPLE_SIGNIN=true`. Turn it on once the
steps below are done.

1. **Certificates, Identifiers & Profiles → Identifiers**: create an **App ID** with *Sign in with Apple* enabled.
2. Create a **Services ID** (this is `AUTH_APPLE_ID`, e.g. `com.yourname.fitness.web`), enable *Sign in with Apple*,
   and configure it with your domain and the return URL `https://<your-domain>/api/auth/callback/apple`.
3. **Keys**: create a key with *Sign in with Apple* enabled and download the `.p8` file (you can only download it once).
4. Set `APPLE_TEAM_ID` (top right of the developer portal), `APPLE_KEY_ID` (the key's ID) and `AUTH_APPLE_ID`, then run
   `npm run apple-secret -- path/to/AuthKey_XXXXXXXXXX.p8` and set the output as `AUTH_APPLE_SECRET`.
   It's valid for 6 months; regenerate it before then.

If you choose **Hide My Email** when signing in with Apple, Apple gives the app a `@privaterelay.appleid.com`
address. Add that address to `ALLOWED_EMAILS`, or share your real email instead.

## Connect Apple Health

Apple Health has no web API, so your iPhone sends the data, using the **Health Auto Export** app (automations need its premium unlock).

1. In the dashboard, open **Settings → Data sources → Apple Health** and press **Connect**. Copy the endpoint and the
   `Authorization: Bearer mdah_…` header; the token is shown once (use **New token** to replace it).
2. In Health Auto Export, add a **REST API** automation with that URL and header. Data Type **Health Metrics**,
   Export Format **JSON**, **Summarize Data** on, Time Grouping **Days**, Date Range **Previous 7 Days**, **Batch Requests** on,
   Sync Frequency **1 hour**. Pick sleep, HRV, resting heart rate, steps, active energy, weight, body fat, dietary energy,
   protein, carbohydrates and total fat. Use **Manual Upload** once for older history.
3. The phone must reach the dashboard over HTTPS, so this works on the deployed site (or through a tunnel), not on `localhost`.

Each delivery replaces the stored value for every day it contains, so resending the same days never double-counts.
Once a metric arrives, the dashboard shows it instead of sample data: sleep and HRV in Recovery, steps, smart-scale
weigh-ins (merged with Hevy's) and nutrition from apps that write to Health, like MyFitnessPal or Cronometer.
The Settings card shows the last delivery, which metrics arrived, any names it didn't recognise, and the last error.
**Disconnect** revokes the token and deletes the imported data.

## Database

- No `DATABASE_URL`: an embedded Postgres (PGlite) stored in `./.data`. Zero setup, ideal for local work.
- `DATABASE_URL` set: any Postgres. For Supabase use **Project Settings → Database → Connection string → Transaction pooler** (port 6543).

Migrations live in `./drizzle` and run automatically on first connection. After editing `src/db/schema.ts`, run `npm run db:generate`.

## Deploying (Vercel + Neon)

1. In Vercel, **Add New → Project**, import this repo and keep `main` as the production branch. Every merge to `main` deploys.
2. **Storage → Create Database → Neon** (free plan, region `iad1` next to Vercel's functions), connect it to the project
   with the prefix `DATABASE`, so Vercel sets `DATABASE_URL`. Tables are created on the first request.
3. **Settings → Environment Variables** (Production): `AUTH_SECRET`, `CRON_SECRET` (generate each with the command above),
   `ALLOWED_EMAILS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `HEVY_API_KEY` (or `HEVY_MOCK=1`). Add `AUTH_RESEND_KEY`
   to turn on email codes, and any Apple variables. Variables apply from the next deploy.
4. Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth client's redirect URIs.

Any other Postgres works too; for Supabase, use the transaction pooler connection string as `DATABASE_URL`.
`vercel.json` schedules a daily sync at 05:00 UTC (Vercel's Hobby plan allows one cron run per day).
`/api/sync` accepts the cron secret, a signed-in session (the **Sync now** button), or `SYNC_SECRET` as the `x-sync-secret` header for scripts.

## Layout

| Path | What it does |
|---|---|
| `src/lib/hevy/client.ts` | Hevy API client: auth header, pagination, retries on 429/5xx |
| `src/lib/hevy/mock.ts` | Stand-in for the Hevy API, same paths and JSON shapes |
| `src/lib/sync/hevy.ts` | Full backfill on first run, incremental change feed afterwards |
| `src/lib/metrics.ts` | Weekly totals, main-lift e1RM trends, PRs, avatar inputs |
| `src/auth.config.ts` | Sign-in settings the middleware can use: Google, Apple, the allowlist, Apple's cross-site cookies |
| `src/auth.ts` | Adds email codes and database storage on top of `auth.config.ts` |
| `src/lib/auth/adapter.ts` | Stores users, linked logins and email codes, with the wrong-guess limit |
| `src/lib/auth/email.ts` | Makes the 6-digit code and sends it through Resend |
| `src/middleware.ts` | Sends signed-out visitors to `/login`; API routes answer 401 |
| `src/app/login` | The sign-in page and the code-entry page (`/login/verify`) |
| `src/app/api/ingest/apple-health` | Receives Health Auto Export deliveries, authorised by a per-user token |
| `src/lib/apple-health` | Parses deliveries into daily values and stores them |
| `src/app/api/sync` | Runs a sync (Vercel Cron uses GET, the page uses POST) |
| `src/app/api/dashboard` | Everything the dashboard needs, as JSON |
| `scripts/sync.ts` | `npm run sync` from the command line |
| `scripts/apple-secret.ts` | `npm run apple-secret` makes Apple's client secret from your `.p8` key |
