"use strict";

/*
 * love-countdown-ext — popup.
 *
 * Shows the label, the D/H/M/S remaining to the target day, a progress bar and
 * the milestones still ahead. Ticks once a second while it is open.
 */

(function () {
  var C = globalThis.MenaCountdown;

  var config = C.normalizeConfig(null);
  var timer = 0;
  var start = new Date();

  function $(id) { return document.getElementById(id); }

  function storeGet() {
    var maybe = api.storage.local.get([C.STORE_KEY]);
    if (maybe && typeof maybe.then === "function") return Promise.resolve(maybe);
    return new Promise(function (resolve) { api.storage.local.get([C.STORE_KEY], function (r) { resolve(r || {}); }); });
  }

  function targetMs() {
    var day = C.toDay(config.target);
    return day ? day.getTime() : null;
  }

  function renderStatic() {
    $("label").textContent = config.label || "our day";

    if (!C.isValidDay(config.target)) {
      $("countdown").hidden = true;
      $("setup").hidden = false;
      $("upcoming").hidden = true;
      return;
    }

    $("countdown").hidden = false;
    $("setup").hidden = true;

    var days = C.daysUntil(config.target);
    $("days-big").textContent = days >= 0 ? String(days) : "♥";
    $("milestone").textContent = C.isMilestone(days) ? C.milestoneText(days, config.label) : "";

    var list = $("milestone-list");
    var ahead = C.upcomingMilestones(days);
    list.textContent = "";
    if (ahead.length && days > 0) {
      ahead.slice(0, 6).forEach(function (m) {
        var li = document.createElement("li");
        li.textContent = m + "d";
        list.appendChild(li);
      });
      $("upcoming").hidden = false;
    } else {
      $("upcoming").hidden = true;
    }
  }

  function tick() {
    var ms = targetMs();
    if (ms == null) return;

    var parts = C.padRemaining(C.splitRemaining(ms - Date.now()));
    $("d").textContent = parts.d;
    $("h").textContent = parts.h;
    $("m").textContent = parts.m;
    $("s").textContent = parts.s;

    var fill = $("progress-fill");
    if (fill) fill.style.width = Math.round(C.progress(C.dayKey(start), config.target) * 100) + "%";

    if (targetMs() - Date.now() <= 0) {
      $("days-big").textContent = "♥";
      $("milestone").textContent = C.milestoneText(-1, config.label);
    }
  }

  function boot() {
    $("open-options").addEventListener("click", function () {
      if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
    });
    $("edit").addEventListener("click", function () {
      if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
    });

    storeGet().then(function (res) {
      config = C.normalizeConfig(res[C.STORE_KEY]);
      start = new Date();
      renderStatic();
      tick();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
    }).catch(function () {
      $("status").textContent = "Could not read the saved date.";
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
