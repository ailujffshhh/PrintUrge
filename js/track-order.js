(function () {
  "use strict";

  var form = document.getElementById("track-order-form");
  var out = document.getElementById("track-order-result");
  if (!form || !out) return;

  function notify(msg, type) {
    if (typeof window.showToast === "function") {
      window.showToast(msg, { type: type || "info" });
    } else {
      window.alert(msg);
    }
  }

  function apiPath(path) {
    if (typeof window.PrintUrgeApiPath === "function") return window.PrintUrgeApiPath(path);
    var clean = String(path);
    if (clean.startsWith("/")) return clean;
    return "../" + clean.replace(/^\/+/, "");
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function labelPayment(st) {
    if (st === "paid") return "Paid (confirmed)";
    if (st === "pending_review") return "Payment proof submitted — awaiting staff confirmation";
    return "Unpaid / not yet confirmed";
  }

  function labelOrder(st) {
    var m = {
      submitted: "Submitted",
      processing: "Processing",
      ready: "Ready for pickup",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return m[st] || st || "Submitted";
  }

  function orderCacheKey(tid, email) {
    return "order-status:" + tid + ":" + email;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var tid = form.elements.namedItem("transaction_id").value.trim().toUpperCase();
    var email = form.elements.namedItem("email").value.trim().toLowerCase();
    if (!tid || !email) {
      notify("Enter both fields.", "error");
      return;
    }
    out.hidden = true;
    out.innerHTML = "";
    try {
      var requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: tid, email: email }),
      };
      var data;
      if (window.PrintUrgeCache) {
        data = await window.PrintUrgeCache.cachedJson(
          orderCacheKey(tid, email),
          apiPath("/api/track-order"),
          requestOptions,
          window.PrintUrgeCache.ttl.oneMinute
        );
      } else {
        var res = await fetch(apiPath("/api/track-order"), requestOptions);
        data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          throw new Error(data.error || "Lookup failed");
        }
      }
      var o = data.order;
      out.innerHTML =
        '<div class="card track-card">' +
        "<h2>Order status</h2>" +
        "<dl class=\"track-dl\">" +
        "<dt>Transaction ID</dt><dd><code>" + esc(o.transaction_id) + "</code></dd>" +
        "<dt>Service</dt><dd>" + esc(o.service) + "</dd>" +
        "<dt>Customer</dt><dd>" + esc(o.customer_name || "—") + "</dd>" +
        "<dt>Print job status</dt><dd>" + esc(labelOrder(o.order_status)) + "</dd>" +
        "<dt>Payment</dt><dd>" + esc(labelPayment(o.payment_status)) + "</dd>" +
        "<dt>Request folder</dt><dd>" + esc(o.request_status === "archived" ? "Archived" : "Active") + "</dd>" +
        "<dt>Submitted</dt><dd>" + esc(o.created_at) + "</dd>" +
        "</dl></div>";
      out.hidden = false;
    } catch (err) {
      notify(err.message || "Could not find an order.", "error");
    }
  });
})();
