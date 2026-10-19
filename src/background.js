"use strict";

/*
 * love-countdown-ext — background service worker (MV3).
 *
 * Keeps the toolbar badge showing how many days are left, ticks at local
 * midnight (and hourly as a safety net), and fires a little notification when
 * a milestone day arrives.
 *
 * Firefox loads src/common/api.js and src/common/data.js via
 * background.scripts before this file; Chrome's single service worker pulls
 * them in with importScripts().
 */

if (typeof importScripts === "function") {
  try { importScripts("common/api.js"); } catch (e) { /* already loaded */ }
  try { importScripts("common/data.js"); } catch (e) { /* already loaded */ }
}

(function (root) {
  var C = root.MenaCountdown;

  var TICK_ALARM = "mena-countdown-tick";

  // Prefer the promise form (Firefox, Chrome 95+); fall back to a callback.
  function storeGet() {
    var maybe = api.storage.local.get([C.STORE_KEY]);
    if (maybe && typeof maybe.then === "function") return Promise.resolve(maybe);
    return new Promise(function (resolve) {
      api.storage.local.get([C.STORE_KEY], function (res) { resolve(res || {}); });
    });
  }

  function storeSet(value) {
    var maybe = api.storage.local.set(value);
    if (maybe && typeof maybe.then === "function") return Promise.resolve(maybe);
    return new Promise(function (resolve) {
      api.storage.local.set(value, function () { resolve(); });
    });
  }

  function readConfig() {
    return storeGet().then(function (res) {
      return C.normalizeConfig(res ? res[C.STORE_KEY] : null);
    });
  }

  function writeConfig(config) {
    var payload = {};
    payload[C.STORE_KEY] = config;
    return storeSet(payload);
  }

  function action() {
    return api.action || api.browserAction;
  }

  function paintBadge(text) {
    var a = action();
    if (!a) return;
    if (typeof a.setBadgeBackgroundColor === "function") {
      a.setBadgeBackgroundColor({ color: "#e91e63" });
    }
    if (typeof a.setBadgeText === "function") {
      a.setBadgeText({ text: text == null ? "" : String(text) });
    }
  }

  /* Badge text for a config, given "now". Pure decision, easy to test. */
  function computeBadge(config, now) {
    var days = C.daysUntil(config && config.target, now);
    if (days == null) return "";
    return C.badgeText(days);
  }

  function notifyFor(config, now) {
    var days = C.daysUntil(config.target, now);
    if (!C.shouldNotify(config, now)) return null;
    var body = C.milestoneText(days, config.label);
    var note = { type: "basic", iconUrl: "icons/icon-128.png", title: "Our countdown \u2665", message: body };
    var created = api.notifications && api.notifications.create
      ? api.notifications.create(note)
      : null;
    C.markFired(config, days, now);
    return Promise.resolve(created).then(function () {
      return writeConfig(config);
    }).then(function () { return body; });
  }

  /* Recompute the badge and, on a milestone, notify once. */
  function refresh(now) {
    var when = now == null ? new Date() : now;
    return readConfig().then(function (config) {
      paintBadge(computeBadge(config, when));
      return notifyFor(config, when);
    }).catch(function () { return null; });
  }

  function ensureAlarm() {
    if (!api.alarms) return;
    api.alarms.get(TICK_ALARM, function (existing) {
      if (!existing) {
        api.alarms.create(TICK_ALARM, { periodInMinutes: 60, when: Date.now() + 60000 });
      }
    });
  }

  /* ---- wiring (guarded so the Node harness can load this file) ---- */

  if (api.runtime && api.runtime.onInstalled) {
    api.runtime.onInstalled.addListener(function () {
      ensureAlarm();
      refresh();
    });
  }

  if (api.runtime && api.runtime.onStartup) {
    api.runtime.onStartup.addListener(function () { refresh(); });
  }

  if (api.alarms && api.alarms.onAlarm) {
    api.alarms.onAlarm.addListener(function (alarm) {
      if (alarm && alarm.name === TICK_ALARM) refresh();
    });
  }

  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes && changes[C.STORE_KEY]) refresh();
    });
  }

  if (api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
      if (msg && msg.type === "countdown-refresh") {
        refresh().then(function () { if (sendResponse) sendResponse({ ok: true }); });
        return true; // keep the channel open for the async reply
      }
      return false;
    });
  }

  /* ---- testable surface ---- */
  root.MenaBackground = {
    TICK_ALARM: TICK_ALARM,
    computeBadge: computeBadge,
    refresh: refresh,
    notifyFor: notifyFor,
    ensureAlarm: ensureAlarm
  };
})(typeof self !== "undefined" ? self : this);
