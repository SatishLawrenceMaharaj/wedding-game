# Wedding Games App

A separate Node.js wedding mini-games application where guests enter a username, answer questions, and compete on a live leaderboard to see who knows the couple best.

This version uses **only your application code**. There is no Upstash, no marketplace app, no external database, and no native SQLite dependency.

## Stack

- Next.js App Router with React and TypeScript
- One internal API route: `/api/game`
- Local JSON persistence when running locally or in Docker
- Temporary in-memory scoring when deployed to Vercel
- Docker-ready production build using Next.js standalone output
- Runs on port `3097`

## Important Vercel note

Vercel does not provide durable writable storage inside the app runtime. To avoid marketplace storage, this app uses server memory on Vercel.

That means:

- The app should deploy without marketplace integrations.
- Guests can join and play.
- The leaderboard works while the Vercel function stays warm.
- Scores may reset after a redeploy, cold start, scaling event, or function restart.

For a small wedding game this may be acceptable. For guaranteed permanent scoring across all phones, some shared storage is required by any web app host.

## Features

- Guest username entry
- Multiple mini-games:
  - Couple Quiz
  - He Said, She Said
  - Love Timeline
  - Closest Guess Wins
- One answer per player per question
- Automatic score tracking
- Live leaderboard refresh
- Host screen at `/host`
- Host reset with optional PIN
- No external database required

## Edit couple details and questions

Update the seed games in:

```txt
src/lib/game-data.ts
```

Change the questions, options, correct answers, bride name, groom name, and explanations before the wedding.

You can also set names using environment variables:

```txt
BRIDE_NAME="Tyla"
GROOM_NAME="Satish"
COUPLE_DISPLAY_NAME="Tyla & Satish"
HOST_PIN="2468"
```

## Run locally

For Windows, use Node 22 LTS or Node 24. This version does not use native SQLite packages, so it should not require Visual Studio Build Tools.

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3097
```

Host leaderboard:

```txt
http://localhost:3097/host
```

Health check:

```txt
http://localhost:3097/api/game?action=health
```

## Run with Docker

```bash
docker compose up -d --build
```

Open:

```txt
http://localhost:3097
```

Stop:

```bash
docker compose down
```

Stop and delete all saved local scores:

```bash
docker compose down -v
```

## Deploying on Vercel without marketplace apps

1. Upload/deploy this project to Vercel.
2. Do not add Upstash, Redis, KV, Postgres, or any storage integration.
3. Set optional environment variables only if needed:

```txt
BRIDE_NAME
GROOM_NAME
COUPLE_DISPLAY_NAME
HOST_PIN
```

4. Redeploy.
5. Test:

```txt
https://your-site.vercel.app/api/game?action=health
```

Expected Vercel response:

```json
{
  "ok": true,
  "service": "wedding-games-app",
  "storage": "vercel-server-memory"
}
```
