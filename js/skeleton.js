(function () {
  "use strict";

  function resolve(target) {
    return typeof target === "string" ? document.querySelector(target) : target;
  }

  function line(width) {
    return '<span class="skeleton-line" style="width:' + width + '"></span>';
  }

  function show(target, html) {
    var el = resolve(target);
    if (!el) return null;
    el.innerHTML = html;
    el.hidden = false;
    el.setAttribute("aria-busy", "true");
    return el;
  }

  function hide(target) {
    var el = resolve(target);
    if (!el) return;
    el.removeAttribute("aria-busy");
    el.hidden = true;
    el.innerHTML = "";
  }

  function error(target, message) {
    show(target, '<div class="skeleton-error">' + escapeHtml(message || "Something went wrong. Please try again.") + "</div>");
    var el = resolve(target);
    if (el) el.removeAttribute("aria-busy");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function services(target, count) {
    var total = count || 8;
    var cards = "";
    for (var i = 0; i < total; i += 1) {
      cards +=
        '<article class="skeleton-card skeleton-service-card">' +
        '<span class="skeleton-icon"></span>' +
        '<span class="skeleton-copy">' +
        line("72%") +
        line("94%") +
        line("64%") +
        "</span></article>";
    }
    return show(target, '<div class="skeleton-services-grid">' + cards + "</div>");
  }

  function orderResult(target) {
    return show(
      target,
      '<div class="skeleton-card skeleton-order-card">' +
        line("38%") +
        '<div class="skeleton-order-grid">' +
        line("72%") + line("55%") +
        line("64%") + '<span class="skeleton-pill"></span>' +
        line("76%") + line("66%") +
        line("58%") + line("45%") +
        line("70%") + line("62%") +
        "</div></div>"
    );
  }

  function tableRows(target, rows, columns) {
    var body = "";
    var rowCount = rows || 5;
    var colCount = columns || 6;
    for (var r = 0; r < rowCount; r += 1) {
      body += '<tr class="skeleton-table-row">';
      for (var c = 0; c < colCount; c += 1) {
        body += '<td><span class="skeleton-table-cell" style="width:' + (c % 3 === 0 ? "55%" : "82%") + '"></span></td>';
      }
      body += "</tr>";
    }
    return show(target, body);
  }

  async function wrap(target, skeletonHtmlOrFn, task, errorMessage) {
    if (typeof skeletonHtmlOrFn === "function") {
      skeletonHtmlOrFn(target);
    } else {
      show(target, skeletonHtmlOrFn);
    }
    try {
      var result = await task();
      var el = resolve(target);
      if (el) el.removeAttribute("aria-busy");
      return result;
    } catch (err) {
      error(target, errorMessage || (err && err.message) || "Could not load this content.");
      throw err;
    }
  }

  window.PrintUrgeSkeleton = {
    show: show,
    hide: hide,
    error: error,
    services: services,
    orderResult: orderResult,
    tableRows: tableRows,
    wrap: wrap,
  };
})();
