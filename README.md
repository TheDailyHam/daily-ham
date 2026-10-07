# The Daily Ham — Standalone (self-hostable)

A standalone port of **The Daily Ham** NHL odds/projections app ("Fresh Cuts Daily"),
rewritten to run on plain Node 20+ with **zero Muse-platform dependencies**.
Deploy it on Render, Railway, Fly.io, or any VPS and it becomes a public web app:
Ice Board, Matchup calculator (first-goal %, winner prediction, period/total/script
probabilities), Players, Hot Streaks, League, premium sportsbook board with
DraftKings-vs-best comparisons, parlay builder, and a Settings screen for the
SportsGameOdds key.

## How it works

- `server/` — Express API. `POST /api/actions` dispatches `{action, args}` to the
  12 ported action handlers (same business logic, zod schemas, and response shapes
  as the original). Serves the built React client statically and exposes
  `GET /api/health`.
- `client/` — React 19 + TanStack Query + Recharts + Tailwind 4 app, built with Vite.
- SQLite via `better-sqlite3` + drizzle-orm at `./data/app.db`; the 7 drizzle
  migrations in `./drizzle` run automatically on server boot.
- Daily refresh: `scripts/refresh.js` calls the same `refreshDaily` +
  `refreshAllSportsbooks` actions the UI uses. Run it from cron (see below).

## Quick start (local)

```bash
npm install
npm run build        # builds server (tsc) then client (vite)
cp .env.example .env # then set SPORTSGAMEODDS_KEY in .env
npm start            # serves API + client on http://localhost:3000
```

Open http://localhost:3000. Health check: `curl localhost:3000/api/health`.

For client development with hot reload:

```bash
npm run dev -w client   # vite on :5173, proxies /api -> localhost:3000
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port (hosts like Render/Railway/Fly inject their own) |
| `SPORTSGAMEODDS_KEY` | — | Your SportsGameOdds API key. **Takes precedence** over a key saved via Settings |
| `DB_PATH` | `./data/app.db` | SQLite file (keep on a persistent volume in Docker) |
| `MIGRATIONS_DIR` | `./drizzle` | Migration SQL folder |
| `CLIENT_DIR` | `./client/dist` | Built client folder the server serves |
| `APP_URL` | `http://localhost:3000` | Base URL used by `scripts/refresh.js` |

No key? The app still works: the free NHL data river (rosters, schedules,
standings, game logs, hot streaks, matchup calculator) needs no key. The premium
odds board honestly reports itself as unavailable until a key is configured —
nothing is faked.

## Deploy guides

### Render

1. Push this repo to GitHub. In Render: **New → Web Service**, point at the repo.
2. Render detects the `Dockerfile` automatically. Set env vars:
   `SPORTSGAMEODDS_KEY=<your key>`. Leave `PORT` unset (Render injects it).
3. Add a **persistent disk** mounted at `/app/data` so the SQLite DB survives deploys.
4. **Cron**: Render → **New → Cron Job**, same repo, schedule `0 9 * * *`
   (9:00 UTC ≈ 5:00 AM ET), command:
   `APP_URL=https://<your-service>.onrender.com node scripts/refresh.js`
   (needs `npm install` in the job's build command; or use the curl alternative below).

### Railway (paid — trial credit only as of 2026, no ongoing free tier)

1. **New Project → Deploy from GitHub**. Railway builds the `Dockerfile`.
2. Variables tab: add `SPORTSGAMEODDS_KEY`. Add a **Volume** mounted at `/app/data`.
3. Railway has no native cron: run the refresh from any always-on machine with:
   `APP_URL=https://<your-app>.up.railway.app node scripts/refresh.js`,
   or add the curl line below to your own crontab.

### Fly.io (paid — new accounts get only a short trial as of 2026, then ~$2–5/mo)

```bash
fly launch            # accept the Dockerfile build; do NOT create a Postgres DB
fly volumes create ham_data --size 1   # persistent SQLite storage
```
`fly.toml` needs:
```toml
[mounts]
  source = "ham_data"
  destination = "/app/data"
[env]
  DB_PATH = "/app/data/app.db"
```
Then `fly secrets set SPORTSGAMEODDS_KEY=<your key>` and `fly deploy`.
Scheduled refresh: `fly machine` cron is easiest via an external cron hitting the
curl endpoint below, or run `node scripts/refresh.js` on any machine with cron.

### Plain VPS (Ubuntu, Docker)

```bash
git clone <your-repo> daily-ham && cd daily-ham
cp .env.example .env   # set SPORTSGAMEODDS_KEY and APP_URL=https://ham.example.com
docker compose up -d --build
```

Daily refresh via system cron (`crontab -e`):

```cron
15 9 * * * cd /path/to/daily-ham && APP_URL=http://localhost:3000 node scripts/refresh.js >> /var/log/daily-ham-refresh.log 2>&1
```

Curl alternative (no node needed on the cron host — hits the public URL):

```cron
15 9 * * * curl -s -X POST https://ham.example.com/api/actions -H 'Content-Type: application/json' -d '{"action":"refreshDaily","args":{}}' >/dev/null
15 9 * * * sleep 120 && curl -s -X POST https://ham.example.com/api/actions -H 'Content-Type: application/json' -d '{"action":"refreshAllSportsbooks","args":{}}' >/dev/null
```

Point a domain at it: create an `A` record for `ham.example.com` → your server IP,
then put Caddy or nginx in front for TLS. With Caddy it's one line:

```
ham.example.com {
  reverse_proxy localhost:3000
}
```

## What you must supply at deploy time

- A hosting account. Honest 2026 free-tier picture: **Render's free web-service tier** is the only genuinely-free ongoing option with a simple dashboard (750 hrs/month; sleeps after ~15 min idle; no persistent disk on free — see caveats in the Render section). Railway is trial-credit only now, and Fly.io gives new accounts only a short trial before ~$2–5/mo. A ~$5/mo VPS (e.g. Hetzner) is the cheapest always-on alternative.
- Your **SportsGameOdds API key** as `SPORTSGAMEODDS_KEY` (or paste it later in the
  app's Settings screen — it's validated live and stored server-side).
- A domain name only if you want a custom URL (optional on Render/Railway/Fly,
  which give you one).

## Notes & honesty rules (carried over from the original)

- Missing books/markets render as unavailable ("—"), never simulated.
- The matchup calculator's percentages are transparent model estimates from
  official NHL play-by-play, labeled as such — not sportsbook prices.
- `scripts/refresh.js` treats a sportsbook-leg failure as non-fatal: the free-data
  refresh always lands first, so the app never goes dark because of provider quota.
