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

## Step 4 — Generate a token that doesn't expire (System User)

The quick "Get User Access Token" button in Graph API Explorer looks convenient, but it hands you a **short-lived token** (hours, not months) unless you separately exchange it for a long-lived one — and even that long-lived version can still die if you ever change your Facebook password. Skip that trap entirely with a **System User** token, which is what Meta actually designed for unattended server integrations like this dashboard: it isn't tied to your personal login at all, and you can set its expiration to **Never**.

1. Go to [business.facebook.com](https://business.facebook.com/) and open (or create — it's free) a **Business Manager** for your business.
2. **Business Settings → Users → System Users → Add**.
3. Name it something recognizable (e.g. "Dashboard Server"), set role to **Admin**, click **Create System User**.
4. Still on that System User, go to **Assigned Assets → Add Assets**.
   - Under **Pages**, select the Facebook Page linked to your Instagram account and give it **Full control**.
   - If your Instagram account also appears as its own asset type, assign it **Full control** too.
5. Click **Generate New Token** on the System User.
   - Select the app you created in Step 2.
   - Check these permissions: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `pages_show_list`, `pages_read_engagement`.
   - Set **Token Expiration** to **Never**.
   - Click **Generate Token**.
6. **Copy the token immediately and save it somewhere safe** — Meta only shows it once. This is your `INSTAGRAM_ACCESS_TOKEN`.

## Step 5 — Get your Page ID and Instagram Business Account ID

Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select your app, paste your System User token into the **Access Token** field, then run:

```
GET /me/accounts
```

Find your Page in the results and copy its `"id"` — that's your `{page-id}` below. Then run:

```
GET /{page-id}?fields=instagram_business_account&access_token={system-user-token}
```

The response contains `"instagram_business_account": { "id": "1789..." }` — that numeric id is your `INSTAGRAM_BUSINESS_ID`.

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
INSTAGRAM_ACCESS_TOKEN=the-system-user-token-from-step-4
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

A System User token with expiration set to **Never** should keep working indefinitely and isn't affected by your personal Facebook password changing. The only things that can still break it:
- Someone removes the System User's access to the Page/Instagram asset in Business Settings, or deletes the System User itself.
- The app's permissions get revoked or the app is deleted from the Business Manager.
- Meta invalidates it for a policy/security reason (rare, and usually comes with an email explaining why).

If **● Instagram Connected** turns into **○ Instagram Offline** unexpectedly, check **Business Settings → Users → System Users** first to confirm the System User and its asset assignment are still intact before regenerating a token via Steps 4–5.
