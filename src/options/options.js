"use strict";

/*
 * love-countdown-ext — options page.
 *
 * Save the target day, the label and the milestone-notification toggle. A live
 * preview shows exactly what the toolbar badge will read.
 */

(function () {
  var C = globalThis.MenaCountdown;
  var config = C.normalizeConfig(null);

  function $(id) { return document.getElementById(id); }

  var savedTarget = "";

  function storeGet() {
    var maybe = api.storage.local.get([C.STORE_KEY]);
    if (maybe && typeof maybe.then === "function") return Promise.resolve(maybe);
    return new Promise(function (resolve) { api.storage.local.get([C.STORE_KEY], function (r) { resolve(r || {}); }); });
  }

  function storeSet(value) {
    var maybe = api.storage.local.set(value);
    if (maybe && typeof maybe.then === "function") return Promise.resolve(maybe);
    return new Promise(function (resolve) { api.storage.local.set(value, function () { resolve(); }); });
  }

  function paintPreview() {
    var days = C.daysUntil(config.target);
    $("badge").textContent = days == null ? "—" : C.badgeText(days);
    $("preview-text").textContent = days == null
      ? "Pick a date to begin."
      : C.milestoneText(days, config.label);
  }

  function fill() {
    $("target").value = config.target || "";
    $("label").value = config.label || "";
    $("notify").checked = config.notify !== false;
    savedTarget = config.target || "";
    paintPreview();
  }

  function save() {
    var newTarget = $("target").value;
    // A fresh target restarts the "how far along are we" progress.
    if (newTarget !== savedTarget || !C.isValidDay(config.startedAt)) {
      config.startedAt = C.dayKey(new Date());
    }
    savedTarget = newTarget;
    config.target = newTarget;
    config.label = $("label").value.trim().slice(0, 60);
    config.notify = $("notify").checked;
    if (!C.isValidDay(config.target)) {
      $("status").textContent = "Please choose a date first.";
      return;
    }
    var payload = {};
    payload[C.STORE_KEY] = config;
    storeSet(payload).then(function () {
      $("status").textContent = "Saved \u2014 the badge is up to date \u2665";
      paintPreview();
      if (api.runtime && api.runtime.sendMessage) {
        api.runtime.sendMessage({ type: "countdown-refresh" });
      }
    }).catch(function () {
      $("status").textContent = "Could not save \u2014 try again.";
    });
  }

  function testNotify() {
    if (!api.notifications || !api.notifications.create) return;
    api.notifications.create({
      type: "basic",
      iconUrl: "../icons/icon-128.png",
      title: "Our countdown \u2665",
      message: C.milestoneText(C.daysUntil(config.target), config.label)
    });
    $("status").textContent = "Sent a test notification \u2665";
  }

  function boot() {
    $("target").addEventListener("change", function () {
      config.target = $("target").value;
      paintPreview();
    });
    $("label").addEventListener("input", function () {
      config.label = $("label").value;
      paintPreview();
    });
    $("settings").addEventListener("submit", function (ev) {
      ev.preventDefault();
      save();
    });
    $("test").addEventListener("click", testNotify);

    storeGet().then(function (res) {
      config = C.normalizeConfig(res[C.STORE_KEY]);
      fill();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
