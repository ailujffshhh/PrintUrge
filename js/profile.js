(function () {
  "use strict";

  var gate = document.getElementById("profile-gate");
  var app = document.getElementById("profile-app");
  var details = document.getElementById("profile-details");
  var summary = document.getElementById("profile-summary");
  var ordersEl = document.getElementById("profile-orders");
  var benefitsEl = document.getElementById("profile-benefits");
  var presetsEl = document.getElementById("profile-presets");
  var upgradeBtn = document.getElementById("profile-member-upgrade");

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
    var tier = profile.account_tier || "free";
    details.innerHTML =
      "<dt>Name</dt><dd>" + escapeHtml(profile.name) + "</dd>" +
      "<dt>Email</dt><dd>" + escapeHtml(profile.email) + "</dd>" +
      "<dt>Account tier</dt><dd><span class=\"admin-marker " + (tier === "member" ? "is-paid" : "is-note") + "\">" + escapeHtml(tier === "member" ? "Member" : "Free") + "</span></dd>" +
      "<dt>Status</dt><dd>" + escapeHtml(profile.status) + "</dd>" +
      "<dt>Member since</dt><dd>" + escapeHtml(fmtDate(profile.created_at)) + "</dd>" +
      "<dt>Last login</dt><dd>" + escapeHtml(fmtDate(profile.last_login_at)) + "</dd>" +
      (tier === "member" ? "<dt>Membership start</dt><dd>" + escapeHtml(fmtDate(profile.member_since)) + "</dd>" : "");

    var completed = orders.filter(function (order) { return order.order_status === "completed"; }).length;
    var active = orders.filter(function (order) {
      return order.order_status !== "completed" && order.order_status !== "cancelled";
    }).length;
    summary.innerHTML =
      '<div><strong>' + orders.length + "</strong><span>Total orders</span></div>" +
      '<div><strong>' + active + "</strong><span>Active orders</span></div>" +
      '<div><strong>' + completed + "</strong><span>Completed</span></div>";
  }

  function renderMembership(profile, credits, benefits, rules) {
    if (!benefitsEl) return;
    var tier = profile.account_tier || "free";
    if (upgradeBtn) upgradeBtn.hidden = tier === "member";
    var creditText = credits
      ? escapeHtml(credits.remaining_credits + " / " + credits.starting_credits + " credits")
      : escapeHtml((rules && rules.monthly_print_credits ? rules.monthly_print_credits : 100) + " monthly credits when active");
    var benefitRows = [
      "10% bulk discount above " + ((rules && rules.bulk_discount_min_pages) || 100) + " pages",
      creditText,
      "1 free lamination per month",
      "Saved print presets",
      "Scheduled pickup slots",
      "Priority rush queue",
      "Priority customer support",
      "Early service and promo access",
    ];
    benefitsEl.innerHTML =
      '<div class="profile-tier-banner ' + (tier === "member" ? "is-member" : "") + '">' +
      '<strong>' + escapeHtml(tier === "member" ? "Member" : "Free account") + "</strong>" +
      '<span>' + escapeHtml(tier === "member" ? "Member perks are active on eligible orders." : "Upgrade to unlock credits, discounts, presets, pickup slots, and priority support.") + "</span>" +
      "</div>" +
      '<ul class="profile-benefit-list">' +
      benefitRows.map(function (row) { return "<li>" + escapeHtml(row) + "</li>"; }).join("") +
      "</ul>";
  }

  function renderPresets(presets) {
    if (!presetsEl) return;
    if (!presets.length) {
      presetsEl.innerHTML = '<p class="auth-hint">No saved presets yet. Reorder any past job to start from its settings.</p>';
      return;
    }
    presetsEl.innerHTML = presets
      .map(function (preset) {
        return (
          '<article class="profile-order">' +
          '<div class="profile-order-main"><strong>' + escapeHtml(preset.name) + "</strong><span>" +
          escapeHtml(preset.service) + " · " + escapeHtml(preset.size_key || "-") + "</span></div>" +
          '<button type="button" class="btn btn-outline" data-reorder-preset="' + escapeHtml(preset.id) + '">Use</button>' +
          "</article>"
        );
      })
      .join("");
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
          '<button type="button" class="btn btn-outline" data-save-preset-order="' + escapeHtml(order.id) + '">Save preset</button>' +
          '<button type="button" class="btn btn-outline" data-reorder-order="' + escapeHtml(order.id) + '">Reorder</button>' +
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
      window.__printurgeProfileOrders = orders;
      window.__printurgeProfilePresets = data.presets || [];
      renderProfile(data.profile || current.user, orders);
      renderMembership(data.profile || current.user, data.credits, data.benefits || [], data.member_rules || {});
      renderPresets(data.presets || []);
      renderOrders(orders);
    } catch (err) {
      ordersEl.innerHTML = '<div class="skeleton-error">We could not load your profile. Please try again.</div>';
      if (typeof window.showToast === "function") window.showToast(err.message || "Could not load profile.", { type: "error" });
    }
  }

  function saveReorderSettings(source) {
    try {
      sessionStorage.setItem("printurge_reorder_settings", JSON.stringify(source));
    } catch (_) {}
    window.location.href = "../index.html#top";
  }

  ordersEl.addEventListener("click", function (e) {
    var saveBtn = e.target.closest("[data-save-preset-order]");
    if (saveBtn) {
      var saveId = Number(saveBtn.getAttribute("data-save-preset-order"));
      var saveOrders = window.__printurgeProfileOrders || [];
      var saveOrder = saveOrders.find(function (item) { return Number(item.id) === saveId; });
      if (saveOrder) savePresetFromOrder(saveOrder, saveBtn);
      return;
    }
    var btn = e.target.closest("[data-reorder-order]");
    if (!btn) return;
    var id = Number(btn.getAttribute("data-reorder-order"));
    var orders = window.__printurgeProfileOrders || [];
    var order = orders.find(function (item) { return Number(item.id) === id; });
    if (order) saveReorderSettings(order);
  });

  async function savePresetFromOrder(order, btn) {
    try {
      btn.disabled = true;
      var res = await fetch(apiPath("/api/customer/profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify({
          action: "save-preset",
          name: (order.service || "Print") + " preset",
          service: order.service,
          color_mode: order.color_mode,
          size_key: order.size_key,
          copies: order.copies,
          pages: order.pages,
          custom_width: order.custom_width,
          custom_height: order.custom_height,
        }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Could not save preset.");
      if (typeof window.showToast === "function") window.showToast("Preset saved.", { type: "success" });
      await loadProfile();
    } catch (err) {
      if (typeof window.showToast === "function") window.showToast(err.message || "Could not save preset.", { type: "error" });
    } finally {
      btn.disabled = false;
    }
  }

  if (presetsEl) {
    presetsEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-reorder-preset]");
      if (!btn) return;
      var id = Number(btn.getAttribute("data-reorder-preset"));
      var presets = window.__printurgeProfilePresets || [];
      var preset = presets.find(function (item) { return Number(item.id) === id; });
      if (preset) saveReorderSettings(preset);
    });
  }

  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", async function () {
      try {
        var res = await fetch(apiPath("/api/customer/profile"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
          body: JSON.stringify({ action: "membership-checkout" }),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.error || "Could not start membership checkout.");
        if (data.checkout_url) window.location.href = data.checkout_url;
        else if (typeof window.showToast === "function") window.showToast(data.message || "Membership checkout is not configured yet.", { type: "info" });
      } catch (err) {
        if (typeof window.showToast === "function") window.showToast(err.message || "Membership checkout failed.", { type: "error" });
      }
    });
  }

  window.addEventListener("printurge-auth-change", loadProfile);
  loadProfile();
})();
