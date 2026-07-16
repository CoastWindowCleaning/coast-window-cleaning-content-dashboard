# Coast Window Cleaning — Content Dashboard

A local content dashboard for running an Instagram Reels content engine for a
window cleaning business, plus a growth tracker toward your follower goals.
The dashboard itself is free and runs entirely in your browser. An optional
local AI backend lets the 5 agents run live against the Claude API (this part
costs a small amount in API tokens — see `AI-AGENT-SETUP.md`).

## What each file is

- **`index.html`** — The dashboard itself. Double-click it to open it in your browser, or (recommended) run it through the backend server below. Data is saved to your browser's local storage AND synced to the server, which mirrors it to Supabase when configured (see `SUPABASE-SETUP.md`) so it persists across devices and redeploys.
- **`server/`** — Backend (Node.js/Express) that connects the dashboard's agents to the real Claude API, connects to Instagram for stats sync + publishing, uploads/schedules reels, generates monthly reports, and runs the scheduler cron. See `AI-AGENT-SETUP.md`, `INSTAGRAM-SETUP.md`, `SUPABASE-SETUP.md`.
- **`AI-AGENT-SETUP.md`** — Step-by-step, beginner-friendly instructions for setting up the Claude API key and running the live AI backend.
- **`INSTAGRAM-SETUP.md`** — Step-by-step, beginner-friendly instructions for connecting your Instagram Business account so the dashboard can sync your real stats, publish reels directly, and upload videos for the AI caption/schedule flow.
- **`SUPABASE-SETUP.md`** — Step-by-step instructions for setting up Supabase, which makes data persist across devices/redeploys and powers reel scheduling.
- **`VERCEL-SETUP.md`** — Step-by-step instructions for deploying this dashboard to Vercel with auto-deploy on push to `main`.
- **`telegram_brief.py`** — Optional. A Python script that sends your Morning Brief to your phone via Telegram, for free. See `TELEGRAM-SETUP.md`.
- **`TELEGRAM-SETUP.md`** — Step-by-step, beginner-friendly instructions for setting up the Telegram bot and scheduling the daily brief.
- **`README.md`** — This file.

## How to open the dashboard

1. Find `index.html` in this folder.
2. Double-click it. It opens in your default web browser.
3. That's it — no install, no login, no internet required (except the one-time load of the Chart.js library for the bar chart; if you're offline, the chart gracefully falls back to a table).

The first time you open it, you'll see 12 sample reels and 3 placeholder competitors already filled in so the dashboard doesn't look empty. Click **Clear sample data** (in the Reel Performance section) whenever you're ready to start entering your real numbers.

Before you start posting for real, open **Settings** (top right) and update:
- Your business name
- Your real Instagram handle (replace `@CHANGE_ME`)
- Your posting goal

## The weekly 2-minute data entry routine

Every week (or whenever you post a new reel), do this:

1. Open `index.html` (or `http://localhost:3001` if you've set up the backend).
2. If you've connected Instagram (see `INSTAGRAM-SETUP.md`), click **🔄 Sync from Instagram** in Reel Performance and Growth Tracker — this pulls in your real stats automatically. Otherwise, click **+ Add reel** and fill in: date, caption, views, likes, comments, and the reel's URL. Takes about 15 seconds per reel.
3. Glance at the **Analytics** cards at the top — total views, average, best reel, trend, and posting streak update automatically.
4. If you're tracking a competitor's post, open the **Competitor Tracker** section, click **+ Add top post**, and paste in the URL/views (use the **Copy extraction prompt** button to get an AI to pull out their hook/script/idea for you).

That's the whole routine — 2 minutes, no spreadsheets.

## How the agent workflow loop works

Each of the 5 agents gives you an expertly-written **master prompt**. You have two ways to run it:

- **Copy prompt** → paste into any AI chat app you already use (Claude, ChatGPT, etc.), paste the answer back into the notes box. Always works, no setup.
- **▶ Run with AI** → calls Claude directly and fills the notes box for you automatically. Requires the optional local backend — see `AI-AGENT-SETUP.md`. For Planner and Analyst, this also auto-fills your real ideas backlog / last 12 reels' stats into the prompt, so there's nothing to paste.

The loop:

1. **Ideas Agent** → Generates 10 reel ideas. Add your favorites to the **Ideas Backlog** (inside the Ideas Agent modal).
2. **Hook & Script Agent** → Pick one idea from your backlog, get 3 hooks, a full script, a caption, and hashtags.
3. **Post** → Film the reel, then either click **📤 Publish Reel** to post it straight from the dashboard (needs `INSTAGRAM-SETUP.md`), or post it yourself in the Instagram app using the script.
4. **Enter stats** → Click **🔄 Sync from Instagram** to pull in real views/likes/comments automatically, or add the reel manually in **Reel Performance**.
5. **Analyst Agent** → Once you've got 12 reels logged, run this agent. It tells you what's working and 3 concrete changes.
6. **Repeat** → Use the Analyst's insights to inform your next batch of Ideas. Check **Planner Agent** weekly to lay out your next 7 days, and **DM Manager Agent** any time you need reply templates for common DMs.
7. **Track your follower growth** → Click **🔄 Sync from Instagram** in the Growth Tracker to log today's real follower count automatically (or **+ Log Follower Count** to enter it by hand). It tracks your trajectory against both your stretch goal and a realistic secondary goal, and tells you the daily pace needed to hit each.

A note on the 200k-by-year-end goal: that's a genuine moonshot for a local
service account starting at 500 followers — organic content alone rarely
produces that kind of multiple in months, not years. The realistic goal
alongside it exists so you're always tracking against a number that reflects
actual trajectory, not just the stretch target.

Use **Generate Morning Brief** any morning to get a one-glance summary of
today's idea, your saved hook/script, your latest reel's performance, and your
last Analyst insight — with a one-click "Copy as text" for sending to yourself
on Telegram or WhatsApp (or set up `telegram_brief.py` to do it automatically).

## Upload a video and let AI draft the caption

In **Reel Performance → ✨ Upload & Schedule**, drop in a video file. Claude
drafts a caption, description, and hashtag set from the filename (and a
frame grab, when available) using the same brand-voice rules as the Hook &
Script Agent. Review/edit the draft, then either:
- **Schedule** it for a specific future date/time (a background job checks
  for due posts and publishes them automatically), or
- **Post as Trial Now** to publish immediately.

Both routes actually publish to Instagram for real — always review the
caption before confirming. Track queued/publishing/posted/failed status in
the **Content Queue** panel further down the Reels page. Needs Instagram +
Cloudinary + Supabase configured — see `INSTAGRAM-SETUP.md` and
`SUPABASE-SETUP.md`.

## Monthly top/bottom reels report

The **Overview** page auto-generates a report on the 1st of each month (once
at least 3 reels are logged for the prior month) identifying your top 3 and
bottom 3 reels by business outcome (or engagement rate, if no
inquiries/jobs are logged) and summarizing what each group has in common.
Past months stay accessible via the dropdown. Click **Generate Report** any
time to run it on demand.

## Competitor tab

Beyond adding competitors and logging their top posts, the **Competitors**
page also tracks: posting cadence (from dated logged posts), a follower
growth sparkline per competitor (log counts periodically with **+ Log
followers**), a **Common Traits** panel tallying content types across all
logged competitor posts, and an **Ask Analyst About Competitors** button
that generates ideas grounded in both your own performance and what's
proven to work for tracked competitors.

## Backing up your data

Your data lives in your browser's local storage, and (once `SUPABASE-SETUP.md`
is done) is also mirrored to Supabase, so it's no longer tied to one browser
on one computer. As an extra manual backup, or to move data another way:

- **Settings → Export data.json** downloads everything.
- **Settings → Import data.json** restores it (on this or any other computer/browser).

Do this periodically, especially before clearing browser data or switching computers.
