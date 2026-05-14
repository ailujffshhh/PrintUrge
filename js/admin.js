(function () {
  "use strict";

  var gate = document.getElementById("admin-gate");
  var app = document.getElementById("admin-app");
  var loginForm = document.getElementById("admin-login-form");
  var rowsEl = document.getElementById("admin-rows");
  var filters = document.getElementById("admin-status-filters");
  var historyShortcut = document.getElementById("admin-history-shortcut");
  var historyTools = document.getElementById("admin-history-tools");
  var historySearch = document.getElementById("admin-history-search");
  var historyFilter = document.getElementById("admin-history-filter");
  var createPanel = document.getElementById("admin-create");
  var createForm = document.getElementById("admin-create-form");
  var openCreateBtn = document.getElementById("admin-open-create");
  var createCancel = document.getElementById("admin-create-cancel");

  var detailModal = document.getElementById("admin-detail-modal");
  var detailForm = document.getElementById("admin-detail-form");
  var detailFiles = document.getElementById("admin-detail-files");
  var detailTitle = document.getElementById("admin-detail-title");
  var detailSub = document.getElementById("admin-detail-sub");
  var detailMarkers = document.getElementById("admin-detail-markers");
  var btnArchive = document.getElementById("admin-detail-archive");
  var btnRestore = document.getElementById("admin-detail-restore");
  var btnPaid = document.getElementById("admin-detail-paid");
  var btnRejectReceipt = document.getElementById("admin-detail-reject-receipt");
  var btnUnpaid = document.getElementById("admin-detail-unpaid");
  var btnComplete = document.getElementById("admin-detail-complete");

  if (!gate || !app || !loginForm) return;

  var currentStatus = "active";
  var selectedId = null;
  var currentItems = [];

  function notify(msg, type) {
    if (typeof window.showToast === "function") {
      window.showToast(msg, { type: type || "info" });
    } else {
      window.alert(msg);
    }
  }

  function token() {
    return window.PrintUrgeSession && window.PrintUrgeSession.getToken
      ? window.PrintUrgeSession.getToken()
      : null;
  }

  function isAdminSession() {
    var s = window.PrintUrgeSession && window.PrintUrgeSession.get();
    return !!(s && s.user && (s.user.role === "admin" || s.user.role === "staff"));
  }

  function apiPath(path) {
    if (typeof window.PrintUrgeApiPath === "function") return window.PrintUrgeApiPath(path);
    return path;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString();
    } catch (_) {
      return String(iso);
    }
  }

  function hasText(value) {
    return String(value || "").trim().length > 0;
  }

  function isNewRequest(item) {
    return (item.order_status || "submitted") === "submitted" && item.status !== "archived";
  }

  function markerHtml(item) {
    var markers = [];
    if (isNewRequest(item)) markers.push('<span class="admin-marker is-new">New</span>');
    if (hasText(item.customer_notes)) markers.push('<span class="admin-marker is-note">Customer note</span>');
    if (hasText(item.admin_notes)) markers.push('<span class="admin-marker is-admin-note">Admin note</span>');
    if (item.payment_status === "paid") markers.push('<span class="admin-marker is-paid">Paid</span>');
    return markers.join("");
  }

  function setHistoryToolsVisible() {
    if (historyTools) historyTools.hidden = currentStatus !== "history";
  }

  function filteredItems(items) {
    if (currentStatus !== "history") return items;
    var query = historySearch ? historySearch.value.trim().toLowerCase() : "";
    var payment = historyFilter ? historyFilter.value : "all";
    return items.filter(function (item) {
      var tid = String(item.transaction_id || "").toLowerCase();
      var matchesSearch = !query || tid.indexOf(query) !== -1;
      var matchesPayment = payment === "all" || item.payment_status === payment;
      return matchesSearch && matchesPayment;
    });
  }

  function renderRows(items) {
    var visibleItems = filteredItems(items);
    if (!visibleItems.length) {
      rowsEl.innerHTML =
        '<tr><td colspan="8">' +
        (currentStatus === "history" ? "No completed transactions match your filters." : "No print requests yet.") +
        "</td></tr>";
      return;
    }

    rowsEl.innerHTML = visibleItems
      .map(function (row) {
        var cust = row.user_name || row.customer_name || row.user_email || "Guest";
        if (row.user_email && row.user_name) cust = row.user_name + " - " + row.user_email;
        var statusBadge =
          row.status === "archived"
            ? '<span class="admin-badge is-archived">Archived</span>'
            : '<span class="admin-badge is-active">Active</span>';
        var payment;
        if (row.payment_status === "paid") {
          payment = '<span class="payment-badge is-paid">Paid</span>';
        } else if (row.payment_status === "pending_review") {
          payment = '<span class="payment-badge is-pending">Proof</span>';
        } else {
          payment =
            '<button type="button" class="payment-badge is-unpaid" data-pay-row="' + row.id + '">Unpaid</button>';
        }
        var orderSt = row.order_status || "submitted";
        var markers = markerHtml(row);

        return (
          '<tr data-id="' + row.id + '">' +
          '<td data-label="ID">' + row.id + "</td>" +
          '<td data-label="Transaction"><span class="admin-transaction-id">' + escapeHtml(row.transaction_id || "-") + "</span>" +
          (markers ? '<span class="admin-row-markers">' + markers + "</span>" : "") +
          "</td>" +
          '<td data-label="Service">' + escapeHtml(row.service) + "</td>" +
          '<td data-label="Customer">' + escapeHtml(cust) + "</td>" +
          '<td data-label="Payment">' + payment + "</td>" +
          '<td data-label="Order">' + escapeHtml(orderSt) + "</td>" +
          '<td data-label="Status">' + statusBadge + "</td>" +
          '<td data-label="Created">' + escapeHtml(fmtDate(row.created_at)) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function setButtonLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.textContent = label || "Loading...";
    } else {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }

  async function api(path, options) {
    var opts = options || {};
    var headers = Object.assign({}, opts.headers || {});
    var tok = token();
    if (tok) headers.Authorization = "Bearer " + tok;
    var res = await fetch(apiPath(path), Object.assign({}, opts, { headers: headers }));
    var data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) {
      var message = data.detail ? (data.error || "Request failed") + ": " + data.detail : data.error || "Request failed";
      var err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function setView() {
    if (isAdminSession()) {
      gate.hidden = true;
      app.hidden = false;
    } else {
      gate.hidden = false;
      app.hidden = true;
      if (createPanel) createPanel.hidden = true;
    }
  }

  function closeDetail() {
    if (!detailModal) return;
    detailModal.classList.remove("is-open");
    detailModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
  }

  function openDetail() {
    if (!detailModal) return;
    detailModal.classList.add("is-open");
    detailModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
  }

  async function loadList() {
    if (!isAdminSession() || !rowsEl) return;
    setHistoryToolsVisible();
    if (window.PrintUrgeSkeleton) {
      window.PrintUrgeSkeleton.tableRows(rowsEl, 6, 8);
    } else {
      rowsEl.innerHTML = '<tr><td colspan="8"><div class="admin-loading"><span></span>Loading print requests...</div></td></tr>';
    }

    try {
      var qs = currentStatus === "all" ? "" : "?status=" + encodeURIComponent(currentStatus);
      var data = await api("/api/admin/print-requests" + qs);
      var items = data.items || [];
      currentItems = items;

      rowsEl.removeAttribute("aria-busy");
      renderRows(items);
    } catch (err) {
      rowsEl.removeAttribute("aria-busy");
      rowsEl.innerHTML = '<tr><td colspan="8"><div class="skeleton-error">We could not load print requests. Please try again.</div></td></tr>';
      notify(err.message || "Could not load print requests.", "error");
    }
  }

  async function openRow(id) {
    selectedId = id;
    var data = await api("/api/admin/print-requests/" + encodeURIComponent(id));
    var item = data.item;
    detailTitle.textContent = "Request #" + item.id;
    detailSub.textContent =
      (item.transaction_id || "No transaction ID") +
      " - " +
      (item.user_name || item.customer_name || "Guest") +
      (item.user_email ? " - " + item.user_email : "");
    if (detailMarkers) detailMarkers.innerHTML = markerHtml(item);

    detailForm.elements.namedItem("requestId").value = String(item.id);
    detailForm.transaction_id.value = item.transaction_id || "";
    detailForm.customer_name.value = item.customer_name || item.user_name || "";
    if (detailForm.elements.namedItem("customer_email")) {
      detailForm.elements.namedItem("customer_email").value = item.customer_email || item.user_email || "";
    }
    detailForm.payment_method.value = item.payment_method || "";
    detailForm.payment_status.value = item.payment_status || "unpaid";
    if (detailForm.elements.namedItem("order_status")) {
      detailForm.elements.namedItem("order_status").value = item.order_status || "submitted";
    }
    detailForm.service.value = item.service || "";
    detailForm.color_mode.value = item.color_mode || "";
    detailForm.size_key.value = item.size_key || "";
    detailForm.copies.value = item.copies || 1;
    detailForm.pages.value = item.pages || 1;
    detailForm.custom_width.value = item.custom_width || "";
    detailForm.custom_height.value = item.custom_height || "";
    detailForm.customer_notes.value = item.customer_notes || "";
    detailForm.admin_notes.value = item.admin_notes || "";

    var files = item.files || [];
    detailFiles.innerHTML =
      '<p style="font-weight:700;margin:0 0 .35rem">Files</p>' +
      files
        .map(function (f) {
          var isReceipt = f.kind === "payment_receipt";
          var tag =
            isReceipt
              ? ' <span class="admin-badge is-pending" style="margin-left:.35rem">Receipt</span>'
              : "";
          var primaryAction = isReceipt
            ? '<button type="button" class="btn btn-primary" data-view-file="' +
              escapeHtml(f.storedName) +
              '">View</button>'
            : '<button type="button" class="btn btn-primary" data-print-file="' +
              escapeHtml(f.storedName) +
              '">Print file</button>';
          return (
            '<div class="admin-file-row"><span>' +
            escapeHtml(f.originalName || f.storedName) +
            tag +
            '</span><div class="admin-file-actions">' +
            '<button type="button" class="btn btn-outline" data-dl="' +
            escapeHtml(f.storedName) +
            '">Download</button>' +
            primaryAction +
            "</div></div>"
          );
        })
        .join("");

    btnArchive.hidden = item.status !== "active";
    btnRestore.hidden = item.status !== "archived";
    if (btnPaid) {
      btnPaid.hidden = item.payment_status === "paid";
      btnPaid.textContent =
        item.payment_status === "pending_review" ? "Approve payment (e-receipt)" : "Mark paid / approve";
    }
    if (btnRejectReceipt) {
      btnRejectReceipt.hidden = item.payment_status !== "pending_review";
    }
    if (btnUnpaid) btnUnpaid.hidden = item.payment_status === "unpaid";
    if (btnComplete) {
      btnComplete.hidden = item.order_status === "completed" || item.order_status === "cancelled";
    }

    openDetail();
  }

  async function fetchFileBlob(storedName) {
    var res = await fetch(apiPath("/api/admin/files/" + encodeURIComponent(storedName)), {
      headers: { Authorization: "Bearer " + token() },
    });
    if (!res.ok) throw new Error("Could not load file");
    return res.blob();
  }

  async function downloadFile(storedName, originalName) {
    try {
      var blob = await fetchFileBlob(storedName);
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = originalName || storedName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify(err.message || "Download failed.", "error");
    }
  }

  async function printFile(storedName, btn) {
    try {
      setButtonLoading(btn, true, "Opening...");
      var blob = await fetchFileBlob(storedName);
      var url = URL.createObjectURL(blob);
      var win = window.open(url, "_blank");
      if (!win) {
        notify("Allow popups to print this file.", "error");
        URL.revokeObjectURL(url);
        return;
      }
      setTimeout(function () {
        try {
          win.focus();
          win.print();
        } catch (_) {}
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      }, 700);
    } catch (err) {
      notify(err.message || "Could not print file.", "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function viewFile(storedName, btn) {
    try {
      setButtonLoading(btn, true, "Opening...");
      var blob = await fetchFileBlob(storedName);
      var url = URL.createObjectURL(blob);
      var win = window.open(url, "_blank");
      if (!win) {
        notify("Allow popups to view this file.", "error");
        URL.revokeObjectURL(url);
        return;
      }
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    } catch (err) {
      notify(err.message || "Could not view file.", "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function markPayment(id, paid, sourceBtn) {
    try {
      setButtonLoading(sourceBtn || (paid ? btnPaid : btnUnpaid), true, paid ? "Marking..." : "Updating...");
      await api("/api/admin/print-requests/" + encodeURIComponent(id) + "/" + (paid ? "mark-paid" : "mark-unpaid"), {
        method: "POST",
      });
      notify(paid ? "Marked as paid. E-receipt sent if email is on file." : "Marked as unpaid.", "success");
      await loadList();
      if (selectedId === id) await openRow(id);
    } catch (err) {
      notify(err.message || "Payment update failed", "error");
    } finally {
      setButtonLoading(sourceBtn || (paid ? btnPaid : btnUnpaid), false);
    }
  }

  async function rejectPaymentProof(id, sourceBtn) {
    try {
      setButtonLoading(sourceBtn, true, "Rejecting...");
      await api("/api/admin/print-requests/" + encodeURIComponent(id) + "/reject-receipt", { method: "POST" });
      notify("Payment proof rejected.", "success");
      await loadList();
      if (selectedId === id) await openRow(id);
    } catch (err) {
      notify(err.message || "Reject failed", "error");
    } finally {
      setButtonLoading(sourceBtn, false);
    }
  }

  async function completeRequest(id, sourceBtn) {
    try {
      setButtonLoading(sourceBtn, true, "Completing...");
      await api("/api/admin/print-requests/" + encodeURIComponent(id) + "/complete", { method: "POST" });
      notify("Request marked as completed.", "success");
      await loadList();
      if (selectedId === id) await openRow(id);
    } catch (err) {
      notify(err.message || "Complete update failed", "error");
    } finally {
      setButtonLoading(sourceBtn, false);
    }
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var submit = loginForm.querySelector('button[type="submit"]');
    var email = loginForm.querySelector('[name="email"]').value.trim();
    var password = loginForm.querySelector('[name="password"]').value;
    try {
      setButtonLoading(submit, true, "Signing in...");
      var data = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });
      if (data.user.role !== "admin" && data.user.role !== "staff") {
        window.PrintUrgeSession.clear();
        notify("This account is not admin or staff.", "error");
        return;
      }
      window.PrintUrgeSession.set(data.token, data.user);
      if (typeof window.refreshAuthNav === "function") window.refreshAuthNav();
      setView();
      await loadList();
      notify("Welcome back.", "success");
    } catch (err) {
      notify(err.message || "Sign in failed", "error");
    } finally {
      setButtonLoading(submit, false);
    }
  });

  if (filters) {
    filters.addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-status]");
      if (!btn) return;
      currentStatus = btn.getAttribute("data-status") || "active";
      if (historySearch && currentStatus !== "history") historySearch.value = "";
      if (historyFilter && currentStatus !== "history") historyFilter.value = "all";
      filters.querySelectorAll("[data-status]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      try {
        setButtonLoading(btn, true, "Loading...");
        await loadList();
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  if (historyShortcut) {
    historyShortcut.addEventListener("click", async function () {
      var historyButton = filters && filters.querySelector('[data-status="history"]');
      currentStatus = "history";
      if (filters) {
        filters.querySelectorAll("[data-status]").forEach(function (b) {
          b.classList.toggle("is-active", b === historyButton);
        });
      }
      try {
        historyShortcut.disabled = true;
        historyShortcut.classList.add("is-loading");
        await loadList();
      } finally {
        historyShortcut.disabled = false;
        historyShortcut.classList.remove("is-loading");
      }
    });
  }

  if (historySearch) {
    historySearch.addEventListener("input", function () {
      renderRows(currentItems);
    });
  }

  if (historyFilter) {
    historyFilter.addEventListener("change", function () {
      renderRows(currentItems);
    });
  }

  if (rowsEl) {
    rowsEl.addEventListener("click", function (e) {
      var payBtn = e.target.closest("[data-pay-row]");
      if (payBtn) {
        e.stopPropagation();
        markPayment(Number(payBtn.getAttribute("data-pay-row")), true, payBtn);
        return;
      }
      var tr = e.target.closest("tr[data-id]");
      if (!tr) return;
      openRow(Number(tr.getAttribute("data-id"))).catch(function (err) {
        notify(err.message || "Could not load request", "error");
      });
    });
  }

  if (detailFiles) {
    detailFiles.addEventListener("click", function (e) {
      var dl = e.target.closest("[data-dl]");
      if (dl) {
        var label = dl.closest(".admin-file-row") && dl.closest(".admin-file-row").querySelector("span");
        downloadFile(dl.getAttribute("data-dl"), label ? label.textContent : dl.getAttribute("data-dl"));
        return;
      }
      var pr = e.target.closest("[data-print-file]");
      if (pr) {
        printFile(pr.getAttribute("data-print-file"), pr);
        return;
      }
      var view = e.target.closest("[data-view-file]");
      if (view) viewFile(view.getAttribute("data-view-file"), view);
    });
  }

  if (detailModal) {
    detailModal.querySelectorAll("[data-admin-detail-close]").forEach(function (el) {
      el.addEventListener("click", closeDetail);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && detailModal.classList.contains("is-open")) closeDetail();
    });
  }

  detailForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var submit = detailForm.querySelector('button[type="submit"]');
    var id = Number(detailForm.elements.namedItem("requestId").value);
    var body = {
      service: detailForm.service.value.trim(),
      color_mode: detailForm.color_mode.value.trim() || null,
      size_key: detailForm.size_key.value.trim() || null,
      copies: detailForm.copies.value,
      pages: detailForm.pages.value,
      custom_width: detailForm.custom_width.value.trim() || null,
      custom_height: detailForm.custom_height.value.trim() || null,
      customer_name: detailForm.customer_name.value.trim() || null,
      customer_email: detailForm.elements.namedItem("customer_email")
        ? detailForm.elements.namedItem("customer_email").value.trim().toLowerCase() || null
        : null,
      customer_notes: detailForm.customer_notes.value,
      payment_method: detailForm.payment_method.value.trim() || null,
      admin_notes: detailForm.admin_notes.value,
      order_status: detailForm.elements.namedItem("order_status")
        ? detailForm.elements.namedItem("order_status").value
        : undefined,
    };
    try {
      setButtonLoading(submit, true, "Saving...");
      await api("/api/admin/print-requests/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      notify("Saved.", "success");
      await loadList();
      closeDetail();
    } catch (err) {
      notify(err.message || "Save failed", "error");
    } finally {
      setButtonLoading(submit, false);
    }
  });

  if (btnPaid) {
    btnPaid.addEventListener("click", function () {
      markPayment(Number(detailForm.elements.namedItem("requestId").value), true, btnPaid);
    });
  }

  if (btnRejectReceipt) {
    btnRejectReceipt.addEventListener("click", function () {
      rejectPaymentProof(Number(detailForm.elements.namedItem("requestId").value), btnRejectReceipt);
    });
  }
  if (btnComplete) {
    btnComplete.addEventListener("click", function () {
      completeRequest(Number(detailForm.elements.namedItem("requestId").value), btnComplete);
    });
  }

  if (btnUnpaid) {
    btnUnpaid.addEventListener("click", function () {
      markPayment(Number(detailForm.elements.namedItem("requestId").value), false, btnUnpaid);
    });
  }

  btnArchive.addEventListener("click", async function () {
    var id = Number(detailForm.elements.namedItem("requestId").value);
    try {
      setButtonLoading(btnArchive, true, "Archiving...");
      await api("/api/admin/print-requests/" + encodeURIComponent(id) + "/archive", { method: "POST" });
      notify("Archived.", "success");
      await loadList();
      closeDetail();
    } catch (err) {
      notify(err.message || "Archive failed", "error");
    } finally {
      setButtonLoading(btnArchive, false);
    }
  });

  btnRestore.addEventListener("click", async function () {
    var id = Number(detailForm.elements.namedItem("requestId").value);
    try {
      setButtonLoading(btnRestore, true, "Restoring...");
      await api("/api/admin/print-requests/" + encodeURIComponent(id) + "/restore", { method: "POST" });
      notify("Restored to active.", "success");
      await loadList();
      closeDetail();
    } catch (err) {
      notify(err.message || "Restore failed", "error");
    } finally {
      setButtonLoading(btnRestore, false);
    }
  });

  openCreateBtn.addEventListener("click", function () {
    createPanel.hidden = !createPanel.hidden;
  });

  createCancel.addEventListener("click", function () {
    createPanel.hidden = true;
  });

  createForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var submit = createForm.querySelector('button[type="submit"]');
    var fd = new FormData();
    var fileInput = createForm.querySelector('input[type="file"]');
    var files = fileInput.files;
    if (!files.length) {
      notify("Add at least one file.", "error");
      return;
    }
    for (var i = 0; i < files.length; i++) fd.append("files", files[i]);
    fd.append("service", createForm.service.value);
    fd.append("colorMode", createForm.colorMode.value);
    fd.append("size", createForm.size.value);
    fd.append("copies", createForm.copies.value || "1");
    fd.append("pages", createForm.pages.value || "1");
    if (createForm.customWidth.value) fd.append("customWidth", createForm.customWidth.value);
    if (createForm.customHeight.value) fd.append("customHeight", createForm.customHeight.value);
    if (createForm.userId.value.trim()) fd.append("userId", createForm.userId.value.trim());
    if (createForm.customerName.value.trim()) fd.append("customerName", createForm.customerName.value.trim());
    var ce = createForm.querySelector('[name="customerEmail"]');
    if (ce && ce.value.trim()) fd.append("customerEmail", ce.value.trim().toLowerCase());
    if (createForm.customerNotes.value.trim()) fd.append("customerNotes", createForm.customerNotes.value.trim());
    if (createForm.paymentMethod.value) fd.append("paymentMethod", createForm.paymentMethod.value);
    fd.append("paymentStatus", createForm.paymentStatus.value || "unpaid");

    try {
      setButtonLoading(submit, true, "Saving...");
      var headers = {};
      var tok = token();
      if (tok) headers.Authorization = "Bearer " + tok;
      var res = await fetch(apiPath("/api/admin/print-requests"), { method: "POST", headers: headers, body: fd });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.detail ? (data.error || "Create failed") + ": " + data.detail : data.error || "Create failed");
      notify("Request created. Transaction " + (data.transaction_id || ""), "success");
      createForm.reset();
      createPanel.hidden = true;
      await loadList();
    } catch (err) {
      notify(err.message || "Create failed", "error");
    } finally {
      setButtonLoading(submit, false);
    }
  });

  window.addEventListener("printurge-auth-change", function () {
    setView();
    if (isAdminSession()) loadList().catch(function () {});
  });

  window.addEventListener("load", function () {
    setTimeout(async function () {
      setView();
      if (isAdminSession()) {
        try {
          await loadList();
        } catch (_) {
          gate.hidden = false;
          app.hidden = true;
        }
      }
    }, 0);
  });
})();
