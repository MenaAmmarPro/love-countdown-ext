"use strict";

/*
 * love-countdown-ext — Node harness (dependency-free).
 *
 *   node test/harness.js
 *
 * Mocks the WebExtension `api.*` surface, loads src/common/api.js,
 * src/common/data.js and src/background.js inside a vm sandbox, then exercises
 * the day maths, the badge text, the milestone logic and the background
 * badge-painting path.
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* ---------- mock WebExtension API ---------- */

const storageData = {};
const badgeLog = [];
const notifications = [];

function listener() {
  return { addListener() {} };
}

const api = {
  storage: {
    local: {
      get(keys) {
        return new Promise((resolve) => {
          const out = {};
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) if (k in storageData) out[k] = storageData[k];
          resolve(out);
        });
      },
      set(obj) {
        Object.assign(storageData, obj);
        return Promise.resolve();
      }
    },
    onChanged: listener()
  },
  action: {
    setBadgeText(details) { badgeLog.push(details.text); },
    setBadgeBackgroundColor() {}
  },
  alarms: {
    get(_name, cb) { cb(null); },
    create() {},
    onAlarm: listener()
  },
  notifications: {
    create(note) { notifications.push(note); return Promise.resolve("id"); }
  },
  runtime: {
    onInstalled: listener(),
    onStartup: listener(),
    onMessage: listener()
  }
};

const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise };
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.chrome = api;
vm.createContext(sandbox);

for (const rel of ["src/common/api.js", "src/common/data.js", "src/background.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), sandbox, { filename: rel });
}

const C = sandbox.MenaCountdown;
const B = sandbox.MenaBackground;

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL: " + msg); failed += 1; }
  else console.log("ok - " + msg);
}
function eq(a, b, msg) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) { console.error("FAIL: " + msg + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); failed += 1; }
  else console.log("ok - " + msg);
}

(async function run() {
  /* ---- modules ---- */
  assert(!!C, "MenaCountdown is exposed");
  assert(!!B, "MenaBackground is exposed");
  assert(C.STORE_KEY === "mena-countdown", "storage key is mena-countdown");

  /* ---- day maths ---- */
  eq(C.dayKey(new Date(2026, 0, 5)), "2026-01-05", "dayKey pads month and day");
  eq(C.toDay("2026-01-05").getMonth(), 0, "toDay parses the month");
  eq(C.toDay("nonsense"), null, "toDay rejects junk");
  assert(C.isValidDay("2026-12-31"), "isValidDay accepts a real day");
  assert(!C.isValidDay(""), "isValidDay rejects an empty string");
  eq(C.daysBetween("2026-01-30", "2026-02-02"), 3, "daysBetween crosses a month boundary");
  eq(C.daysBetween("2026-01-01", "2026-01-01"), 0, "daysBetween same day is zero");
  eq(C.daysBetween("bad", "2026-01-01"), null, "daysBetween null on junk input");
  eq(C.daysUntil("2026-01-12", new Date(2026, 0, 5)), 7, "daysUntil counts forward days");
  eq(C.daysUntil("2026-01-01", new Date(2026, 0, 5)), -4, "daysUntil is negative past the day");
  eq(C.daysUntil("", new Date(2026, 0, 5)), null, "daysUntil null without a target");
  eq(C.nextMidnight(new Date(2026, 0, 5, 22, 30)).getDate(), 6, "nextMidnight rolls to tomorrow");

  /* ---- badge text ---- */
  eq(C.badgeText(7), "7", "badgeText shows a normal count");
  eq(C.badgeText(0), "0", "badgeText shows zero on the day");
  eq(C.badgeText(-3), "\u2713", "badgeText shows a tick after the day");
  eq(C.badgeText(1500), "999+", "badgeText caps large counts");
  eq(C.badgeText(null), "", "badgeText is empty with no target");

  /* ---- milestones ---- */
  assert(C.isMilestone(7), "isMilestone accepts 7");
  assert(C.isMilestone(0), "isMilestone accepts 0");
  assert(!C.isMilestone(5), "isMilestone rejects a non-milestone");
  assert(!C.isMilestone(-1), "isMilestone rejects negative days");
  eq(C.milestoneText(0), "Today is the day \u2665", "milestoneText for day zero");
  eq(C.milestoneText(1, "our day"), "One more sleep to our day \u2665", "milestoneText for one day with a label");
  eq(C.milestoneText(30, "our day"), "30 days to our day \u2665", "milestoneText for a milestone with a label");
  eq(C.upcomingMilestones(9), [7, 3, 2, 1, 0], "upcomingMilestones lists what is left");
  eq(C.upcomingMilestones(-2), [], "upcomingMilestones is empty once passed");

  /* ---- countdown split ---- */
  const ms = ((2 * 86400) + (3 * 3600) + (4 * 60) + 5) * 1000;
  eq(C.splitRemaining(ms), { d: 2, h: 3, m: 4, s: 5, done: false }, "splitRemaining breaks down a remainder");
  eq(C.splitRemaining(-50).done, true, "splitRemaining flags a finished countdown");
  eq(C.padRemaining(C.splitRemaining(ms)), { d: "2", h: "03", m: "04", s: "05", done: false }, "padRemaining zero-pads");
  eq(C.progress("2026-01-01", "2026-01-11", new Date(2026, 0, 6)), 0.5, "progress is a clamped fraction");
  eq(C.progress("2026-01-01", "2026-01-11", new Date(2026, 0, 1)), 0, "progress at the very start");
  eq(C.progress("2026-01-01", "2026-01-11", new Date(2026, 0, 11)), 1, "progress at the end");
  eq(C.progress("2026-01-01", "2026-01-11", new Date(2025, 11, 28)), 0, "progress clamped below zero");
  eq(C.progress("2026-01-01", "2026-01-11", new Date(2026, 0, 20)), 1, "progress clamped above one");

  /* ---- config + notifications ---- */
  eq(C.normalizeConfig(null).target, "", "normalizeConfig tolerates null");
  const cfg = C.normalizeConfig({ target: "2026-02-14", label: "Valentine's", notify: true, fired: { "x:7": true } });
  eq(cfg.target, "2026-02-14", "normalizeConfig keeps a valid target");
  eq(cfg.label, "Valentine's", "normalizeConfig keeps the label");
  assert(cfg.fired["x:7"], "normalizeConfig keeps fired flags");
  eq(C.normalizeConfig({ target: "junk" }).target, "", "normalizeConfig drops a bad target");
  eq(C.normalizeConfig({ target: "2026-02-14", startedAt: "2026-01-01" }).startedAt, "2026-01-01", "normalizeConfig keeps the start day");
  eq(C.normalizeConfig({ target: "2026-02-14", startedAt: "junk" }).startedAt, "", "normalizeConfig drops a bad start day");

  assert(C.shouldNotify({ notify: true, target: "2026-01-15", fired: {} }, new Date(2026, 0, 5)) === false,
    "shouldNotify is false on a non-milestone day");
  const mcfg = { notify: true, target: "2026-01-12", label: "our day", fired: {} };
  eq(C.daysUntil(mcfg.target, new Date(2026, 0, 5)), 7, "the milestone day is 7 days out");
  assert(C.shouldNotify(mcfg, new Date(2026, 0, 5)) === true, "shouldNotify true exactly on the milestone day");
  C.markFired(mcfg, 7, new Date(2026, 0, 5));
  assert(C.shouldNotify(mcfg, new Date(2026, 0, 5)) === false, "shouldNotify false once a milestone has fired");
  assert(C.shouldNotify({ notify: false, target: "2026-01-12", fired: {} }, new Date(2026, 0, 5)) === false,
    "shouldNotify respects the notify toggle");

  /* ---- background: badge computation ---- */
  eq(B.computeBadge({ target: "2026-01-12" }, new Date(2026, 0, 5)), "7", "computeBadge paints the day count");
  eq(B.computeBadge({ target: "" }, new Date(2026, 0, 5)), "", "computeBadge paints nothing without a target");
  eq(B.computeBadge({ target: "2026-01-01" }, new Date(2026, 0, 5)), "\u2713", "computeBadge paints a tick once passed");

  /* ---- background: refresh() integration with mocked api ---- */

  // A normal (non-milestone) day: the badge updates and nothing pops.
  storageData[C.STORE_KEY] = { target: "2026-01-14", label: "our day", notify: true, fired: {} };
  badgeLog.length = 0;
  notifications.length = 0;
  await B.refresh(new Date(2026, 0, 5));
  eq(badgeLog[badgeLog.length - 1], "9", "refresh() paints the badge through api.action");
  eq(notifications.length, 0, "no notification on a normal day");

  // A milestone day fires one notification, then never again that day.
  storageData[C.STORE_KEY] = { target: "2026-01-12", label: "our day", notify: true, fired: {} };
  badgeLog.length = 0;
  notifications.length = 0;
  await B.refresh(new Date(2026, 0, 5));
  eq(badgeLog[badgeLog.length - 1], "7", "refresh() updates the badge on a milestone day");
  eq(notifications.length, 1, "refresh() fires one milestone notification");
  eq(notifications[0].title, "Our countdown \u2665", "the notification is titled for us");
  assert(notifications[0].message.indexOf("7 days") === 0, "the notification announces the milestone");

  notifications.length = 0;
  await B.refresh(new Date(2026, 0, 5));
  eq(notifications.length, 0, "the milestone does not fire twice");

  console.log("");
  if (failed) {
    console.error(failed + " assertion(s) failed");
    process.exitCode = 1;
  } else {
    console.log("All assertions passed ♥");
  }
})();
