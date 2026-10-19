# Our Countdown — love-countdown-ext

A tiny browser extension that keeps **our day** in the toolbar. The badge shows
the days left; the popup shows days / hours / minutes / seconds ticking down,
a progress bar and the milestones still ahead; and on a milestone day
(365 · 200 · 100 · 50 · 30 · 14 · 7 · 3 · 2 · 1 · 0) a little notification
arrives — once, never twice.

Chrome, Edge and Firefox, Manifest V3, no build step, no external requests.

## Install (load unpacked / temporary add-on)

**Chrome or Edge**
1. Copy `manifest.chrome.json` to `manifest.json` in this folder.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick this folder.
5. Pin the heart, open the popup, click **Edit** and choose your day.

**Firefox**
1. Copy `manifest.firefox.json` to `manifest.json` in this folder.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick `manifest.json`.
4. Open the options page and choose your day.

## What it does

- **Badge** — `action.setBadgeText` shows the whole days left (`999+` cap, `✓`
  once the day has passed). Recomputed on install, on startup, every hour and
  whenever the settings change.
- **Popup** — your label, the big day count, a live D/H/M/S clock and the
  milestones ahead.
- **Options** — target date, a name for it, and the milestone-notification
  toggle, with a live badge preview and a test notification button.
- **Notifications** — fire on milestone days only, de-duplicated by day so a
  milestone never nags.

## Storage

- `mena-countdown` — `{ target: "YYYY-MM-DD", label, notify, fired: { "YYYY-MM-DD:days": true } }`

## Permissions

`alarms`, `notifications`, `storage` — nothing else, no host permissions.

## Layout

```
manifest.chrome.json / manifest.firefox.json
src/common/{api.js,data.js,theme.css}
src/background.js
src/popup/{popup.html,popup.css,popup.js}
src/options/{options.html,options.css,options.js}
icons/{icon-16,32,48,128}.png + icon.svg
tools/make-icons.js      # regenerate icons (dependency-free PNG encoder)
test/harness.js          # Node tests with a mocked api.*
```

## Development

Regenerate the icons (no image tools needed):

```sh
node tools/make-icons.js
```

Test the pure logic and the badge/notification path with a mocked `api.*`:

```sh
node --check src/common/data.js
node test/harness.js
```

Made with love, just for you ♥
