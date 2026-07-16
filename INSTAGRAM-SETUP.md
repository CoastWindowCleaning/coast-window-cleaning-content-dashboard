# Instagram Setup — Sync Stats + Publish Reels (Beginner Friendly)

This is optional and separate from the AI backend. It lets the dashboard:
- **Sync from Instagram** — pull your real follower count and your last 12 reels' views/likes/comments in automatically, instead of typing them in.
- **Publish Reel** — upload a video straight from the dashboard to your Instagram account as a Reel.

Because this is for **your own account only** (not an app serving other people's accounts), you don't need to go through Meta's multi-week app review process — you just add your own account as a "tester" on your own developer app and you get full access immediately.

This takes about 20–30 minutes the first time, mostly clicking through Meta's developer dashboard.

---

## Step 1 — Convert your Instagram to a Business account

1. In the Instagram app: **Settings → Account type and tools → Switch to professional account** (choose **Business**, not Creator — Creator accounts can't publish via the API).
2. When prompted, **link it to a Facebook Page**. If you don't have one, Instagram will let you create a minimal one for free during this flow — it can just be named after your business.

## Step 2 — Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com/) and log in with the Facebook account that manages your Page.
2. Click **My Apps → Create App**. Choose the **"Other"** use case, then app type **"Business"**.
3. Give it any name (e.g. "Coast Window Cleaning Dashboard").
4. Once created, on the app's dashboard, find **Instagram** in the products list and click **Set up**.

## Step 3 — Add yourself as a tester (this is what skips app review)

1. In your app's dashboard, go to **App roles → Roles**.
2. Confirm your own Facebook account is listed as **Admin** (it usually is automatically, since you created the app).
3. That's it — as the app's admin, you can use any permission on your own linked account without waiting for Meta's review. Review is only required before *other people's* accounts can use your app.

## Step 4 — Generate a long-lived access token

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. In the top right, select your app from the dropdown.
3. Click **"Get Token" → "Get User Access Token"**.
4. In the permissions checklist, select: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `pages_show_list`, `pages_read_engagement`. Click **Generate Access Token** and approve.
5. Change the request from `GET /me` to `GET /me/accounts` and click **Submit**. Find your Page in the results and copy its `"access_token"` value and `"id"`.
6. This Page token from step 5 is what you'll use — page tokens generated this way from a long-lived user token don't expire under normal use. If you ever see authentication errors months from now, come back to this step and generate a fresh one (see "Keeping it working" below).

## Step 5 — Get your Instagram Business Account ID

Still in Graph API Explorer, run:

```
GET /{page-id}?fields=instagram_business_account&access_token={page-access-token}
```

(Replace `{page-id}` and `{page-access-token}` with the values from Step 4.) The response contains `"instagram_business_account": { "id": "1789..." }` — that numeric id is your `INSTAGRAM_BUSINESS_ID`.

## Step 6 — Set up Cloudinary (free) for video hosting

Instagram's API requires your video to already be sitting at a public web address before it'll publish it — it can't accept an upload straight from your computer. Cloudinary's free tier handles this. The dashboard uploads videos **directly from your browser to Cloudinary** (not through this app's server) using an **unsigned upload preset**, so large reel files never have to pass through — and potentially get rejected by — a hosting platform's request-size limit.

1. Sign up free at [cloudinary.com](https://cloudinary.com/users/register/free).
2. On your Cloudinary dashboard home page, copy your **Cloud name**.
3. Go to **Settings (gear icon) → Upload → Upload presets → Add upload preset**.
   - Set **Signing Mode** to **Unsigned**.
   - Give it a name you'll recognize, e.g. `cwc_dashboard_unsigned`.
   - Save. Copy the preset name — that's your `CLOUDINARY_UPLOAD_PRESET`.

(You do **not** need the API Key/Secret for this app anymore — only the cloud name and this unsigned preset name, both of which are safe to expose in the browser.)

## Step 7 — Add everything to `.env`

Open `server/.env` (create it from `server/.env.example` first if you haven't) and fill in:

```
INSTAGRAM_ACCESS_TOKEN=the-page-access-token-from-step-4
INSTAGRAM_BUSINESS_ID=the-numeric-id-from-step-5
CLOUDINARY_CLOUD_NAME=from-step-6
CLOUDINARY_UPLOAD_PRESET=from-step-6
```

Restart the server (`Ctrl+C` then `npm start` in the `server` folder). Open `http://localhost:3001` — you should see **● Instagram Connected (@yourhandle)** next to Settings.

## Using it

- **Growth Tracker → 🔄 Sync from Instagram** — pulls your current follower count in as today's entry.
- **Reel Performance → 🔄 Sync from Instagram** — pulls your last 12 posts' captions, views, likes, and comments in, matching by post URL so it updates existing entries instead of duplicating them.
- **Reel Performance → 📤 Publish Reel** — pick a video file and write a caption, click Publish. This takes 1–3 minutes while Instagram processes the video; leave the window open. Only videos 5–90 seconds, vertical (9:16), qualify to appear in the Reels tab — longer clips will publish but may not show as a Reel.
- **Reel Performance → ✨ Upload & Schedule** — pick a video, Claude drafts a caption/description/hashtags, then either schedule it for a future date/time or post it as a trial right away. See `SUPABASE-SETUP.md` — this needs Supabase configured too, since queued posts are tracked server-side.

## Limits worth knowing

- Instagram caps API-published posts at **100 per rolling 24 hours** — irrelevant at daily-reel volume, just noting it exists.
- View counts ("plays") aren't available via the API for every post, especially very old ones — if a synced reel shows 0 views, that's Instagram's insights API not returning data for that post, not a bug; likes/comments still sync fine.

## Keeping it working

Page access tokens obtained this way are long-lived but not eternal — Meta can invalidate them if you change your Facebook password, remove the app's permissions, or after long inactivity. If **● Instagram Connected** turns into **○ Instagram Offline** unexpectedly, just repeat Steps 4–5 to generate a fresh token and update `.env`.
