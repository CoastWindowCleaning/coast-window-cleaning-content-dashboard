# Supabase Setup — Persistent Data + Scheduling (Beginner Friendly)

This is what makes the dashboard's data (reels, competitors, settings,
monthly reports) survive across devices and across redeploys, instead of
living only in one browser's local storage. It's also required for the
**Upload & Schedule** feature — scheduled/trial reels are tracked in a
Supabase table so a background job can check on them even when no browser is
open.

Without this, the app still works locally with a JSON file
(`server/data-store.json`) — but that file does not exist on Vercel (its
filesystem is not persistent between requests), so **Supabase is required**
once you deploy.

Takes about 10 minutes.

## Step 1 — Create a Supabase project

1. Sign up free at [supabase.com](https://supabase.com/dashboard/sign-up).
2. Click **New Project**. Pick any name/region, set a database password (you
   won't need to remember it — this app doesn't connect with it directly).
3. Wait ~2 minutes for the project to finish provisioning.

## Step 2 — Run the schema

1. In your new project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `server/supabase-schema.sql` in this repo, copy its full contents,
   paste into the SQL Editor, and click **Run**.
3. You should see two new tables under **Table Editor**: `dashboard_state`
   and `scheduled_reels`.

## Step 3 — Get your API credentials

1. Go to **Project Settings (gear icon) → API**.
2. Copy the **Project URL** — that's `SUPABASE_URL`.
3. Under **Project API keys**, copy the **`service_role`** key (not the
   `anon`/`public` one) — that's `SUPABASE_SERVICE_ROLE_KEY`.

The `service_role` key bypasses Row Level Security and has full read/write
access to your project — treat it like a password. It only ever lives in
`server/.env` (local) or your Vercel project's environment variables
(deployed), **never** in `index.html` or any code that reaches the browser.

## Step 4 — Add to `.env`

Open `server/.env` and add:

```
SUPABASE_URL=the-project-url-from-step-3
SUPABASE_SERVICE_ROLE_KEY=the-service-role-key-from-step-3
```

Restart the server. On startup, if you already had reels/competitors logged
in `server/data-store.json`, the server automatically copies that data into
Supabase the first time it connects (one-time, only if the Supabase table is
still empty) — you won't lose anything.

## Step 5 — Verify

```
curl http://localhost:3001/api/health
```

Should show `"supabaseConfigured": true`. Reload the dashboard in your
browser — everything should look the same (now backed by Supabase instead of
the local file).

## What's stored where

- **`dashboard_state`** — one row, one JSON blob: settings, reels, agent
  chat history, ideas backlog, competitors, usage, follower history, monthly
  reports. This is the direct replacement for `server/data-store.json`.
- **`scheduled_reels`** — one row per queued/trial reel from the Upload &
  Schedule flow, with its status (`queued` → `publishing` → `posted`/`failed`).
  Kept as a real table (not inside the JSON blob) so the scheduler can
  efficiently query "what's due right now" without loading everything else.
