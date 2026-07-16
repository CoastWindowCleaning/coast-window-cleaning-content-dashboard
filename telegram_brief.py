"""
Sends the daily Morning Brief (from data.json, exported by the dashboard) to a
Telegram chat via the free Telegram Bot API.

Requires:
    pip install requests

Environment variables (see TELEGRAM-SETUP.md for how to get these):
    TELEGRAM_BOT_TOKEN  - the token @BotFather gave you
    TELEGRAM_CHAT_ID    - your personal chat id

Usage:
    TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy python3 telegram_brief.py
"""

import json
import os
import sys
from datetime import datetime

import requests

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")


def fail(message):
    print("ERROR: " + message, file=sys.stderr)
    sys.exit(1)


def load_data():
    if not os.path.exists(DATA_FILE):
        fail(
            "Could not find data.json in this folder ({}).\n"
            "Open the dashboard (index.html), click Settings, then 'Export data.json', "
            "and save it into this same folder.".format(DATA_FILE)
        )
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        fail("data.json exists but could not be read/parsed: {}".format(e))


def get_env(name):
    value = os.environ.get(name)
    if not value:
        fail(
            "Environment variable {} is not set.\n"
            "See TELEGRAM-SETUP.md for how to create a bot and find this value, "
            "then set it before running this script.".format(name)
        )
    return value


def sorted_reels(reels):
    return sorted(reels, key=lambda r: r.get("date", ""))


def today_idea_text(data):
    backlog = data.get("ideasBacklog", [])
    unused = [i for i in backlog if not i.get("used")]
    if unused:
        return unused[0].get("text", "")
    if backlog:
        return "All backlog ideas are marked used — add new ones in the dashboard's Ideas Agent."
    return "No ideas in the backlog yet — run the Ideas Agent and add results to the backlog."


def hook_script_text(data):
    notes = (data.get("agents", {}).get("hook", {}) or {}).get("notes", "").strip()
    if not notes:
        return "No hook/script saved yet — run the Hook & Script Agent and paste its output into the dashboard."
    return notes[:500] + ("…" if len(notes) > 500 else "")


def latest_reel_text(data):
    reels = data.get("reels", [])
    if not reels:
        return "No reels logged yet."
    r = sorted_reels(reels)[-1]
    return '"{}" — {:,} views, {:,} likes, {:,} comments ({})'.format(
        r.get("caption", ""),
        int(r.get("views", 0) or 0),
        int(r.get("likes", 0) or 0),
        int(r.get("comments", 0) or 0),
        r.get("date", ""),
    )


def analyst_insight_text(data):
    notes = (data.get("agents", {}).get("analyst", {}) or {}).get("notes", "").strip()
    if not notes:
        return "No analyst notes yet — run the Analyst Agent and paste its output into the dashboard."
    for line in notes.splitlines():
        line = line.strip()
        if line:
            return line
    return notes[:200]


def build_brief_text(data):
    business_name = data.get("settings", {}).get("businessName", "Coast Window Cleaning")
    date_str = datetime.now().strftime("%A, %b %d %Y")

    return (
        "☀️ MORNING BRIEF — {business}\n"
        "📅 {date}\n\n"
        "💡 TODAY'S IDEA\n{idea}\n\n"
        "🎬 HOOK & SCRIPT\n{hook}\n\n"
        "📊 LATEST REEL\n{latest}\n\n"
        "🔍 ANALYST INSIGHT\n{insight}\n\n"
        "Let's get one posted today. 🪟✨"
    ).format(
        business=business_name,
        date=date_str,
        idea=today_idea_text(data),
        hook=hook_script_text(data),
        latest=latest_reel_text(data),
        insight=analyst_insight_text(data),
    )


def send_telegram_message(token, chat_id, text):
    url = "https://api.telegram.org/bot{}/sendMessage".format(token)
    try:
        resp = requests.post(url, data={"chat_id": chat_id, "text": text}, timeout=15)
    except requests.RequestException as e:
        fail("Could not reach the Telegram API — check your internet connection.\nDetails: {}".format(e))

    if resp.status_code != 200:
        fail(
            "Telegram API returned an error (status {}).\n"
            "Response: {}\n"
            "Double check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are correct.".format(
                resp.status_code, resp.text
            )
        )


def main():
    token = get_env("TELEGRAM_BOT_TOKEN")
    chat_id = get_env("TELEGRAM_CHAT_ID")
    data = load_data()
    brief = build_brief_text(data)
    send_telegram_message(token, chat_id, brief)
    print("Morning brief sent to Telegram successfully.")


if __name__ == "__main__":
    main()
