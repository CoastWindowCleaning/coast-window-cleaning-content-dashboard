# Telegram Morning Brief — Setup Guide (Beginner Friendly)

This is optional. The dashboard (`index.html`) works completely on its own —
this just lets you get your Morning Brief sent to your phone automatically
every morning via Telegram, for free.

It takes about 10 minutes the first time. You only do this setup once.

---

## Step 1 — Create a free Telegram bot with @BotFather

1. Open Telegram (app or web.telegram.org).
2. Search for the user **@BotFather** (it has a blue checkmark — it's the official bot for making bots).
3. Start a chat with it and send: `/newbot`
4. It will ask for a **name** for your bot (anything, e.g. "Coast Window Cleaning Brief").
5. It will then ask for a **username** for your bot — must end in `bot`, e.g. `CloseWindowBriefBot`.
6. BotFather will reply with a message containing your **bot token** — a long string like:
   `123456789:AAExampleTokenDoNotShareThisWithAnyone`
7. Copy that token somewhere safe. This is your `TELEGRAM_BOT_TOKEN`. Never share it publicly — anyone with it can control your bot.

## Step 2 — Get your Chat ID

Telegram needs to know *where* to send the message — that's your Chat ID.

1. In Telegram, search for the bot you just created (by the username you gave it) and open a chat with it.
2. Send it any message, e.g. "hello" (this is required — the bot can't message you until you've messaged it first).
3. On your computer, open this URL in a web browser (replace `<TOKEN>` with your real bot token from Step 1):

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

4. You'll see a page of JSON text. Look for a section like:

   ```json
   "chat": { "id": 987654321, "first_name": "Your Name", ... }
   ```

5. That number (`987654321` in this example) is your **Chat ID**. Copy it — this is your `TELEGRAM_CHAT_ID`.

   If you don't see anything, make sure you actually sent the bot a message first (Step 2.2), then reload the `getUpdates` URL.

## Step 3 — Install the one Python dependency

Open Terminal and run:

```bash
pip3 install requests
```

## Step 4 — Export your dashboard data

1. Open `index.html` (double-click it).
2. Click **Settings** → **Export data.json**.
3. Save the downloaded `data.json` file into the **same folder** as `telegram_brief.py`.

You'll want to re-export this each time you update the dashboard with new ideas, scripts, or stats, so the brief stays current.

## Step 5 — Run it manually once to test

In Terminal, `cd` into the folder that contains `telegram_brief.py` and `data.json`, then run:

```bash
TELEGRAM_BOT_TOKEN="paste-your-token-here" TELEGRAM_CHAT_ID="paste-your-chat-id-here" python3 telegram_brief.py
```

If everything is set up correctly, you'll see:

```
Morning brief sent to Telegram successfully.
```

...and a message will appear in your Telegram chat with the bot. If something's missing, the script will print a clear error telling you exactly what to fix.

## Step 6 — Schedule it every morning at 7:00 AM (Mac)

To have this run automatically every day without opening Terminal, use `cron`.

1. Open Terminal and run:

   ```bash
   crontab -e
   ```

2. This opens an editor (likely `vim` or `nano`). Add this single line (edit the paths and values for your setup), then save and exit:

   ```
   0 7 * * * cd "/full/path/to/this/folder" && TELEGRAM_BOT_TOKEN="your-token" TELEGRAM_CHAT_ID="your-chat-id" /usr/bin/python3 telegram_brief.py >> telegram_brief.log 2>&1
   ```

   - `0 7 * * *` means "at 7:00 AM, every day."
   - Replace `/full/path/to/this/folder` with the actual folder path (run `pwd` in that folder to get it).
   - Output/errors get logged to `telegram_brief.log` in that same folder, so you can check it if a message doesn't arrive.

3. If you're using `vim` and have never used it: press `i` to start typing, paste the line, then press `Esc`, type `:wq`, and press `Enter` to save and quit.

4. To confirm it saved, run:

   ```bash
   crontab -l
   ```

   You should see your line listed.

**Note:** Your Mac needs to be powered on (can be asleep, cron will still typically run on wake, but for guaranteed delivery keep it plugged in and not fully shut down) at 7:00 AM for this to fire. Remember to re-export `data.json` from the dashboard regularly so the brief reflects your latest ideas and stats.
