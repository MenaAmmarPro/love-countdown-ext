"use strict";

/*
 * love-countdown-ext — shared, dependency-free logic.
 *
 * Loaded as a plain script by the service worker, the popup and the options
 * page (on Firefox it is the first entry in background.scripts). Exposes
 * `MenaCountdown` on the global object so the Node harness can test every pure
 * function without a browser.
 *
 * "Target" is a calendar day given as {@code "YYYY-MM-DD"}; a countdown to it
 * means a countdown to local midnight of that day.
 */

(function (root) {
  var DAY_MS = 86400000;

  var MILESTONES = [365, 200, 100, 50, 30, 14, 7, 3, 2, 1, 0];

  var DEFAULT_CONFIG = {
    target: "",
    label: "our day",
    notify: true,
    fired: {}
  };

  var STORE_KEY = "mena-countdown";

  function pad2(n) { return String(n).padStart(2, "0"); }

  /* "YYYY-MM-DD" for a Date (local time). */
  function dayKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /* Parse "YYYY-MM-DD" to a Date at local midnight. Tolerates a Date. */
  function toDay(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function isValidDay(value) {
    return toDay(value) !== null;
  }

  /* Whole days from `from` to `to` (both calendar days, local midnight). */
  function daysBetween(from, to) {
    var a = toDay(from);
    var b = toDay(to);
    if (!a || !b) return null;
    return Math.round((b - a) / DAY_MS);
  }

  /* Days from today until the target. Null when there is no target. */
  function daysUntil(target, today) {
    if (!isValidDay(target)) return null;
    var t = today == null ? new Date() : today;
    return daysBetween(t, target);
  }

  /* The next local midnight after `now`, as a Date. */
  function nextMidnight(now) {
    var n = now == null ? new Date() : new Date(now);
    return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0, 0);
  }

  /* Badge text for a day count. Kept short so it fits the toolbar chip. */
  function badgeText(days) {
    if (days == null) return "";
    if (days < 0) return "\u2713"; // done
    if (days === 0) return "0";
    if (days > 999) return "999+";
    return String(days);
  }

  function isMilestone(days) {
    return typeof days === "number" && days >= 0 && MILESTONES.indexOf(days) >= 0;
  }

  function milestoneText(days, label) {
    var who = label && String(label).trim() ? " to " + String(label).trim() : "";
    if (days < 0) return "It happened \u2014 and I would choose it again \u2665";
    if (days === 0) return "Today is the day" + who + " \u2665";
    if (days === 1) return "One more sleep" + who + " \u2665";
    return days + " days" + who + " \u2665";
  }

  /* Milestones still ahead (or today), nearest in time first. */
  function upcomingMilestones(days) {
    if (typeof days !== "number" || days < 0) return [];
    return MILESTONES.filter(function (m) { return m <= days; })
      .slice()
      .sort(function (a, b) { return b - a; });
  }

  /* Should a notification fire right now, and has it not already this day? */
  function shouldNotify(config, today) {
    if (!config || !config.notify) return false;
    var days = daysUntil(config.target, today);
    if (!isMilestone(days)) return false;
    var key = dayKey(today == null ? new Date() : today);
    var fired = config.fired || {};
    return !fired[key + ":" + days];
  }

  /* Split a millisecond remainder into D/H/M/S, clamped at zero. */
  function splitRemaining(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return {
      d: Math.floor(total / 86400),
      h: Math.floor((total % 86400) / 3600),
      m: Math.floor((total % 3600) / 60),
      s: total % 60,
      done: ms <= 0
    };
  }

  function padRemaining(parts) {
    return {
      d: String(parts.d),
      h: pad2(parts.h),
      m: pad2(parts.m),
      s: pad2(parts.s),
      done: !!parts.done
    };
  }

  /* Fraction of the way from `start` to `target`, clamped to 0..1. */
  function progress(start, target, today) {
    var total = daysBetween(start, target);
    if (total == null || total <= 0) return 1;
    var left = daysUntil(target, today);
    if (left == null) return 0;
    var elapsed = total - left;
    return Math.min(1, Math.max(0, elapsed / total));
  }

  /* Merge an unknown stored value into a well-formed config. */
  function normalizeConfig(raw) {
    var out = {
      target: "",
      label: DEFAULT_CONFIG.label,
      notify: true,
      fired: {}
    };
    if (raw && typeof raw === "object") {
      if (isValidDay(raw.target)) out.target = raw.target;
      if (typeof raw.label === "string") out.label = raw.label.slice(0, 60);
      if (typeof raw.notify === "boolean") out.notify = raw.notify;
      if (raw.fired && typeof raw.fired === "object") {
        Object.keys(raw.fired).forEach(function (k) {
          if (raw.fired[k]) out.fired[k] = true;
        });
      }
    }
    return out;
  }

  /* Mark a milestone as notified so it never fires twice. */
  function markFired(config, days, today) {
    var key = dayKey(today == null ? new Date() : today) + ":" + days;
    config.fired = config.fired || {};
    config.fired[key] = true;
    return config;
  }

  root.MenaCountdown = {
    DAY_MS: DAY_MS,
    MILESTONES: MILESTONES,
    STORE_KEY: STORE_KEY,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    pad2: pad2,
    dayKey: dayKey,
    toDay: toDay,
    isValidDay: isValidDay,
    daysBetween: daysBetween,
    daysUntil: daysUntil,
    nextMidnight: nextMidnight,
    badgeText: badgeText,
    isMilestone: isMilestone,
    milestoneText: milestoneText,
    upcomingMilestones: upcomingMilestones,
    shouldNotify: shouldNotify,
    splitRemaining: splitRemaining,
    padRemaining: padRemaining,
    progress: progress,
    normalizeConfig: normalizeConfig,
    markFired: markFired
  };
})(typeof self !== "undefined" ? self : this);
