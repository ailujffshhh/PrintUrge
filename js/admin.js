(function () {
  "use strict";

  var gate = document.getElementById("admin-gate");
  var app = document.getElementById("admin-app");
  var loginForm = document.getElementById("admin-login-form");
  var rowsEl = document.getElementById("admin-rows");
  var filters = document.getElementById("admin-status-filters");
  var createPanel = document.getElementById("admin-create");
  var createForm = document.getElementById("admin-create-form");
  var openCreateBtn = document.getElementById("admin-open-create");
  var createCancel = document.getElementById("admin-create-cancel");

  var detailModal = document.getElementById("admin-detail-modal");
  var detailForm = document.getElementById("admin-detail-form");
  var detailFiles = document.getElementById("admin-detail-files");
  var detailTitle = document.getElementById("admin-detail-title");
  var detailSub = document.getElementById("admin-detail-sub");
  var btnArchive = document.getElementById("admin-detail-archive");
  var btnRestore = document.getElementById("admin-detail-restore");

  if (!gate || !app || !loginForm) return;

  var currentStatus = "active";
  var selectedId = null;

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
    return !!(s && s.user && s.user.role === "admin");
  }

  async function api(path, options) {
    var opts = options || {};
    var headers = Object.assign({}, opts.headers || {});
    var tok = token();
    if (tok) headers.Authorization = "Bearer " + tok;
    var res = await fetch(path, Object.assign({}, opts, { headers: headers }));
    var data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) {
      var err = new Error(data.error || "Request failed");
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
      createPanel.hidden = true;
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

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch (_) {
      return String(iso);
    }
  }

  async function loadList() {
    if (!isAdminSession()) return;
    var qs = currentStatus === "all" ? "" : "?status=" + encodeURIComponent(currentStatus);
    var data = await api("/api/admin/print-requests" + qs);
    var items = data.items || [];
    rowsEl.innerHTML = items
      .map(function (row) {
        var cust = row.user_name || row.user_email || "Guest";
        if (row.user_email && row.user_name) cust = row.user_name + " · " + row.user_email;
        var badge =
          row.status === "archived"
            ? '<span class="admin-badge is-archived">Archived</span>'
            : '<span class="admin-badge is-active">Active</span>';
        return (
          "<tr data-id=\"" +
          row.id +
          "\">" +
          "<td>" +
          row.id +
          "</td>" +
          "<td>" +
          escapeHtml(row.service) +
          "</td>" +
          "<td>" +
          escapeHtml(cust) +
          "</td>" +
          "<td>" +
          badge +
          "</td>" +
          "<td>" +
          escapeHtml(fmtDate(row.created_at)) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function openRow(id) {
    selectedId = id;
    var data = await api("/api/admin/print-requests/" + id);
    var item = data.item;
    detailTitle.textContent = "Request #" + item.id;
    detailSub.textContent =
      (item.user_name || "Guest") + (item.user_email ? " · " + item.user_email : "");
    detailForm.elements.namedItem("requestId").value = String(item.id);
    detailForm.service.value = item.service || "";
    detailForm.color_mode.value = item.color_mode || "";
    detailForm.size_key.value = item.size_key || "";
    detailForm.copies.value = item.copies || 1;
    detailForm.pages.value = item.pages || 1;
    detailForm.custom_width.value = item.custom_width || "";
    detailForm.custom_height.value = item.custom_height || "";
    detailForm.admin_notes.value = item.admin_notes || "";

    var files = item.files || [];
    detailFiles.innerHTML =
      "<p style=\"font-weight:700;margin:0 0 .35rem\">Files</p>" +
      files
        .map(function (f, i) {
          return (
            "<div class=\"admin-file-row\"><span>" +
            escapeHtml(f.originalName || f.storedName) +
            "</span><button type=\"button\" class=\"btn btn-outline\" data-dl=\"" +
            escapeHtml(f.storedName) +
            "\">Download</button></div>"
          );
        })
        .join("");

    btnArchive.hidden = item.status !== "active";
    btnRestore.hidden = item.status !== "archived";

    openDetail();
  }

  async function downloadFile(storedName, originalName) {
    var res = await fetch("/api/admin/files/" + encodeURIComponent(storedName), {
      headers: { Authorization: "Bearer " + token() },
    });
    if (!res.ok) {
      notify("Download failed.", "error");
      return;
    }
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = originalName || storedName;
    a.click();
    URL.revokeObjectURL(url);
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = loginForm.querySelector('[name="email"]').value.trim();
    var password = loginForm.querySelector('[name="password"]').value;
    try {
      var data = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });
      if (data.user.role !== "admin") {
        window.PrintUrgeSession.clear();
        notify("This account is not an admin.", "error");
        return;
      }
      window.PrintUrgeSession.set(data.token, data.user);
      if (typeof window.refreshAuthNav === "function") window.refreshAuthNav();
      setView();
      await loadList();
      notify("Welcome back.", "success");
    } catch (err) {
      notify(err.message || "Sign in failed", "error");
    }
  });

  if (filters) {
    filters.addEventListener("click", async function (e) {
      var btn = e.target.closest("[data-status]");
      if (!btn) return;
      currentStatus = btn.getAttribute("data-status") || "active";
      filters.querySelectorAll("[data-status]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      await loadList();
    });
  }

  rowsEl.addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    openRow(Number(tr.getAttribute("data-id"))).catch(function (err) {
      notify(err.message || "Could not load request", "error");
    });
  });

  detailFiles.addEventListener("click", function (e) {
    var b = e.target.closest("[data-dl]");
    if (!b) return;
    var stored = b.getAttribute("data-dl");
    var label = b.closest(".admin-file-row") && b.closest(".admin-file-row").querySelector("span");
    downloadFile(stored, label ? label.textContent : stored);
  });

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
    var id = Number(detailForm.elements.namedItem("requestId").value);
    var body = {
      service: detailForm.service.value.trim(),
      color_mode: detailForm.color_mode.value.trim() || null,
      size_key: detailForm.size_key.value.trim() || null,
      copies: detailForm.copies.value,
      pages: detailForm.pages.value,
      custom_width: detailForm.custom_width.value.trim() || null,
      custom_height: detailForm.custom_height.value.trim() || null,
      admin_notes: detailForm.admin_notes.value,
    };
    try {
      await api("/api/admin/print-requests/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      notify("Saved.", "success");
      await loadList();
      closeDetail();
    } catch (err) {
      notify(err.message || "Save failed", "error");
    }
  });

  btnArchive.addEventListener("click", async function () {
    var id = Number(detailForm.elements.namedItem("requestId").value);
    try {
      await api("/api/admin/print-requests/" + id + "/archive", { method: "POST" });
      notify("Archived.", "success");
      await loadList();
      closeDetail();
    } catch (err) {
      notify(err.message || "Archive failed", "error");
    }
  });

  btnRestore.addEventListener("click", async function () {
    var id = Number(detailForm.elements.namedItem("requestId").value);
    try {
      await api("/api/admin/print-requests/" + id + "/restore", { method: "POST" });
      notify("Restored to active.", "success");
      await loadList();
      closeDetail();
    } catch (err) {
      notify(err.message || "Restore failed", "error");
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
    var uid = createForm.userId.value.trim();
    if (uid) fd.append("userId", uid);

    try {
      var headers = {};
      var tok = token();
      if (tok) headers.Authorization = "Bearer " + tok;
      var res = await fetch("/api/admin/print-requests", { method: "POST", headers: headers, body: fd });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || "Create failed");
      notify("Request created.", "success");
      createForm.reset();
      createPanel.hidden = true;
      await loadList();
    } catch (err) {
      notify(err.message || "Create failed", "error");
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
