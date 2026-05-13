/**
 * Lightweight toast stack for PrintUrge.
 * Usage: window.showToast("Message", { type: "success" | "error" | "info", duration: 4000 })
 */
(function () {
  "use strict";

  var DEFAULT_MS = 4200;
  var host = null;

  function ensureHost() {
    if (host) return host;
    host = document.createElement("div");
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-relevant", "additions text");
    document.body.appendChild(host);
    return host;
  }

  function iconMarkup(type) {
    if (type === "success") return "✓";
    if (type === "error") return "!";
    return "i";
  }

  function show(message, opts) {
    if (!message) return;
    opts = opts || {};
    var type = opts.type === "error" || opts.type === "success" || opts.type === "info" ? opts.type : "info";
    var duration = typeof opts.duration === "number" ? opts.duration : DEFAULT_MS;
    var root = ensureHost();

    var el = document.createElement("div");
    el.className = "toast toast--" + type;
    el.setAttribute("role", "status");

    el.innerHTML =
      '<span class="toast__icon" aria-hidden="true">' +
      iconMarkup(type) +
      "</span>" +
      '<div class="toast__body"></div>' +
      '<button type="button" class="toast__close" aria-label="Dismiss notification">×</button>';

    el.querySelector(".toast__body").textContent = message;

    function remove() {
      if (!el.parentNode) return;
      el.classList.add("is-leaving");
      setTimeout(function () {
        el.remove();
      }, 220);
    }

    el.querySelector(".toast__close").addEventListener("click", remove);
    root.appendChild(el);

    if (duration > 0) {
      setTimeout(remove, duration);
    }
  }

  window.showToast = show;
})();
