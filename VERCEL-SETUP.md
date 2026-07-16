# Vercel Deployment Setup (Beginner Friendly)

This deploys the dashboard so it's reachable from any device at a real URL,
and auto-redeploys every time you push to `main`. It needs Supabase set up
first (see `SUPABASE-SETUP.md`) — Vercel's filesystem doesn't persist
between requests, so the local JSON-file fallback can't work there.

## Accounts you need

1. A **GitHub** account (free) — Vercel deploys from a git repo.
2. A **Vercel** account (free tier is enough) — sign up at
   [vercel.com](https://vercel.com/signup), easiest via "Continue with GitHub".
3. **Supabase** and **Cloudinary** accounts — see `SUPABASE-SETUP.md` and
   `INSTAGRAM-SETUP.md` if you haven't already.

## Step 1 — Push this repo to GitHub

This project is already a git repo locally (`git init` was run, first commit
made). You still need to create the GitHub remote and push:

```
gh repo create <your-repo-name> --private --source=. --remote=origin
git push -u origin main
```

(No `gh` CLI? Create an empty repo at [github.com/new](https://github.com/new)
instead, then: `git remote add origin <the-url-github-gives-you>` and
`git push -u origin main`.)

## Step 2 — Import the project into Vercel

1. In the Vercel dashboard: **Add New → Project → Import Git Repository**,
   pick the repo you just pushed.
2. Vercel should auto-detect it as a Node.js project (via `vercel.json` +
   root `package.json` in this repo) — leave the default build settings.
3. **Before clicking Deploy**, add the environment variables below.

## Step 3 — Environment variables to set in Vercel

In the Vercel project's **Settings → Environment Variables**, add each of
these (Production, and Preview if you want preview deploys to work too).
Exact values — copy from `server/.env` where noted, don't invent placeholders:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Copy from `server/.env` |
| `INSTAGRAM_ACCESS_TOKEN` | Copy from `server/.env` |
| `INSTAGRAM_BUSINESS_ID` | Copy from `server/.env` |
| `CLOUDINARY_CLOUD_NAME` | Copy from `server/.env` |
| `CLOUDINARY_UPLOAD_PRESET` | Copy from `server/.env` (see `INSTAGRAM-SETUP.md` Step 6 if not set yet) |
| `SUPABASE_URL` | Copy from `server/.env` (see `SUPABASE-SETUP.md`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Copy from `server/.env` |
| `MONTHLY_CAP_USD` | Copy from `server/.env` (or leave unset — defaults to 15) |
| `CRON_SECRET` | **New** — generate any random string yourself, e.g. run `openssl rand -hex 24` locally and paste the output. This is what authorizes Vercel's own Cron Jobs to call your scheduler endpoint; Vercel automatically sends it as a Bearer token when this variable is set. |

Do **not** set `PORT` — Vercel manages that itself.

## Step 4 — Deploy

Click **Deploy**. First deploy takes 1-2 minutes. You'll get a
`your-project.vercel.app` URL.

**Checkpoint (per your instructions):** before this first production deploy
goes live, confirm with me that the table above matches what's actually set
in your Vercel dashboard — I can't see your Vercel account, so I can't verify
this myself.

## Step 5 — Confirm auto-deploy is wired

After the first manual deploy succeeds, make any small change (e.g. edit
this file), commit, and `git push`. Watch the Vercel dashboard's
**Deployments** tab — a new deployment should start automatically within a
few seconds of the push landing on `main`. That confirms the pipeline is
live, not just scaffolded.

## Scheduling precision on Vercel — read this before relying on it

`vercel.json` in this repo registers one Vercel Cron Job hitting
`/api/cron/run-scheduler` once daily. **Vercel's free Hobby plan only allows
cron jobs to run once per day** — that's fine as a safety net and for the
monthly report, but it means a reel scheduled for "3pm today" might not
actually post until the next day's cron tick.

For real minute-level scheduling precision on Hobby, add a free external
pinger instead (or in addition):

1. Sign up at [cron-job.org](https://cron-job.org/) (free).
2. Create a job hitting `https://your-project.vercel.app/api/cron/run-scheduler`
   every 1–5 minutes, with header `Authorization: Bearer <your CRON_SECRET>`.

If you upgrade to Vercel Pro, you can instead tighten the `schedule` in
`vercel.json` to run every minute and drop the external pinger.

## Large video uploads

Video files upload **directly from the browser to Cloudinary**, never
through this app's Vercel functions — that's deliberate, since Vercel
serverless functions reject large request bodies. If you ever see an upload
fail specifically on the Vercel-hosted URL but not locally, that's the first
thing to check (Cloudinary preset/cloud name env vars set correctly on
Vercel).
