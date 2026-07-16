# AI Agent Setup — Live "Run with AI" Buttons (Beginner Friendly)

This is optional. The dashboard works fine without it — you can always click
**Copy prompt** and paste it into any AI chat app by hand. This guide sets up
a small local server so the **Run with AI** button in each agent's modal
calls Claude directly, auto-filling your real ideas backlog and reel stats
into the prompt so you don't have to.

This costs real money in AI tokens (not much — see the cost section below),
so it's a separate opt-in step, not part of the free base dashboard.

---

## Step 1 — Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com/) and create an account.
2. Add billing / buy credits (there's no free tier for API usage — a few dollars is plenty to start; see cost estimate below).
3. Create an API key. It looks like `sk-ant-api03-...`. Copy it somewhere safe — you can't view it again after creation, only regenerate a new one.

## Step 2 — Install Node.js (one time only)

If you don't already have it, download and install Node.js from [nodejs.org](https://nodejs.org/) (the "LTS" version). This is what runs the local server.

## Step 3 — Configure the server

1. Open Terminal and go to the `server` folder inside this project:

   ```bash
   cd "/path/to/Content Dashboard/server"
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Open `.env` in any text editor and paste your real key in:

   ```
   ANTHROPIC_API_KEY=sk-ant-api03-your-real-key-here
   ```

   You can also adjust `MONTHLY_CAP_USD` here (default $15) — this is just a soft warning shown in the dashboard, not a hard limit enforced by Anthropic.

## Step 4 — Install dependencies and start the server

Still inside the `server` folder:

```bash
npm install
npm start
```

You should see:

```
Content Dashboard AI backend running at http://localhost:3001
```

## Step 5 — Use the dashboard through the server

Instead of double-clicking `index.html`, open this URL in your browser:

```
http://localhost:3001
```

(The server serves the exact same dashboard — it just also gives it access to the `/api/run-agent` endpoint.) You'll see an **● AI Connected** badge next to Settings in the top right once it's working.

Now, inside any agent's modal, click **▶ Run with AI** instead of copying the prompt manually. For:
- **Ideas Agent** and **DM Manager Agent** — runs immediately, no input needed.
- **Hook & Script Agent** — fill in the "Idea to script" box first (pre-filled from your backlog if you have one).
- **Planner Agent** and **Analyst Agent** — these automatically pull in your real ideas backlog and last 12 reels' stats, so there's nothing to paste.

The response is saved into the notes box automatically, exactly as if you'd pasted it yourself.

## What this actually costs

Ideas/Planner/DM replies run on the cheaper Haiku model (~$1 per million input tokens, ~$5 per million output tokens). Hook & Script and Analyst — the two agents where writing quality matters most — run on Sonnet (~$2 per million input, ~$10 per million output, introductory pricing through Aug 31 2026). A single call is typically a fraction of a cent to a few cents. Daily use across all 5 agents realistically lands around **$3–15/month**. The dashboard tracks your running total in **Settings → AI Usage** and warns you (without blocking) once you pass your cap.

## Keeping your key safe

- Never share your `.env` file or paste your key into a chat, email, or screenshot.
- `.env` is already excluded from version control via `server/.gitignore` — don't remove that.
- If you think your key leaked, regenerate it immediately at [console.anthropic.com](https://console.anthropic.com/).

## Turning it off

Just close the terminal window running `npm start`, or stop it with `Ctrl+C`. Go back to opening `index.html` directly by double-click — everything (reels, agent notes, competitors, growth tracker) keeps working exactly as before, just without the Run with AI button being able to reach the API.
