(function () {
  "use strict";

  var gate = document.getElementById("profile-gate");
  var app = document.getElementById("profile-app");
  var details = document.getElementById("profile-details");
  var summary = document.getElementById("profile-summary");
  var ordersEl = document.getElementById("profile-orders");

  if (!gate || !app || !details || !summary || !ordersEl) return;

  function session() {
    return window.PrintUrgeSession && window.PrintUrgeSession.get ? window.PrintUrgeSession.get() : null;
  }

  function token() {
    return window.PrintUrgeSession && window.PrintUrgeSession.getToken ? window.PrintUrgeSession.getToken() : null;
  }

  function apiPath(path) {
    if (typeof window.PrintUrgeApiPath === "function") return window.PrintUrgeApiPath(path);
    return path;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch (_) {
      return String(value);
    }
  }

  function labelStatus(value) {
    var labels = {
      submitted: "Submitted",
      processing: "Processing",
      ready: "Ready for pickup",
      completed: "Completed",
      cancelled: "Cancelled",
      pending_review: "Proof review",
      paid: "Paid",
      unpaid: "Unpaid",
    };
    return labels[value] || value || "-";
  }

  function renderProfile(profile, orders) {
    details.innerHTML =
      "<dt>Name</dt><dd>" + escapeHtml(profile.name) + "</dd>" +
      "<dt>Email</dt><dd>" + escapeHtml(profile.email) + "</dd>" +
      "<dt>Status</dt><dd>" + escapeHtml(profile.status) + "</dd>" +
      "<dt>Member since</dt><dd>" + escapeHtml(fmtDate(profile.created_at)) + "</dd>" +
      "<dt>Last login</dt><dd>" + escapeHtml(fmtDate(profile.last_login_at)) + "</dd>";

    var completed = orders.filter(function (order) { return order.order_status === "completed"; }).length;
    var active = orders.filter(function (order) {
      return order.order_status !== "completed" && order.order_status !== "cancelled";
    }).length;
    summary.innerHTML =
      '<div><strong>' + orders.length + "</strong><span>Total orders</span></div>" +
      '<div><strong>' + active + "</strong><span>Active orders</span></div>" +
      '<div><strong>' + completed + "</strong><span>Completed</span></div>";
  }

  function renderOrders(orders) {
    if (!orders.length) {
      ordersEl.innerHTML = '<p class="auth-hint">No orders yet.</p>';
      return;
    }
    ordersEl.innerHTML = orders
      .map(function (order) {
        return (
          '<article class="profile-order">' +
          '<div class="profile-order-main">' +
          '<strong>' + escapeHtml(order.transaction_id || ("Request #" + order.id)) + "</strong>" +
          '<span>' + escapeHtml(order.service || "Print request") + "</span>" +
          "</div>" +
          '<div class="profile-order-meta">' +
          '<span class="admin-marker is-note">' + escapeHtml(labelStatus(order.order_status)) + "</span>" +
          '<span class="admin-marker ' + (order.payment_status === "paid" ? "is-paid" : "is-new") + '">' +
          escapeHtml(labelStatus(order.payment_status)) +
          "</span>" +
          '<span>' + escapeHtml(fmtDate(order.created_at)) + "</span>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  async function loadProfile() {
    var current = session();
    if (!current || !current.user || !token()) {
      gate.hidden = false;
      app.hidden = true;
      return;
    }

    gate.hidden = true;
    app.hidden = false;
    ordersEl.innerHTML = '<div class="admin-loading"><span></span>Loading orders...</div>';

    try {
      var res = await fetch(apiPath("/api/customer/profile"), {
        headers: { Authorization: "Bearer " + token() },
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Could not load profile.");
      var orders = data.orders || [];
      renderProfile(data.profile || current.user, orders);
      renderOrders(orders);
    } catch (err) {
      ordersEl.innerHTML = '<div class="skeleton-error">We could not load your profile. Please try again.</div>';
      if (typeof window.showToast === "function") window.showToast(err.message || "Could not load profile.", { type: "error" });
    }
  }

  window.addEventListener("printurge-auth-change", loadProfile);
  loadProfile();
})();
