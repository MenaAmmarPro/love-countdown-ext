"use strict";

/*
 * The one place that reaches for the browser namespace.
 *
 * Chrome/Edge expose `chrome`, Firefox exposes `browser` (which also returns
 * promises). Every other script just uses the global `api` defined here.
 */

var api = globalThis.browser || globalThis.chrome;
