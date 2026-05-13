/**
 * quick-print.js
 * ──────────────────────────────────────────────────────────────────
 * Handles the Quick Print panel:
 *   – service-aware labels, options, and slot visibility
 *   – custom banner size slot
 *   – drag-and-drop + file input
 *   – file preview popup (slider)
 *   – form submission
 *
 * HOW TO USE
 * 1. Add to your HTML (just before </body>):
 *      <script src="js/quick-print.js" defer></script>
 * 2. In main.js, DELETE the two Quick Print IIFEs
 *    (the blocks that start with "var SERVICE_CONFIG = {" and
 *     the DOMContentLoaded block that handles drop-zone / preview).
 *    Keep everything else in main.js (nav, auth, slideshow, etc.)
 * ──────────────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────────────
   * 1. SERVICE CONFIGURATION
   *
   * showColor  : show the color/finish dropdown slot
   * showCopies : show the copies input slot
   * showPages  : show the pages/quantity input slot
   * showCustom : (banner only) reveal custom-size inputs when
   *              the size dropdown is set to "custom"
   * ───────────────────────────────────────────────────────────────── */
  var SERVICE_CONFIG = {

    document: {
      colorLabel : "Color Mode",
      colorOpts  : [["bw","Black and White"],["color","Full Color"]],
      showColor  : true,
      sizeLabel  : "Paper Size",
      sizes      : [["a4","A4"],["long","Long Bond"],["a3","A3"]],
      pagesLabel : "Pages",
      showPages  : true,
      showCopies : true,
    },

    photocopy: {
      colorLabel : "Color Mode",
      colorOpts  : [["bw","Black and White"],["color","Full Color"]],
      showColor  : true,
      sizeLabel  : "Paper Size",
      sizes      : [["a4","A4"],["long","Long Bond"],["a3","A3"]],
      pagesLabel : "Pages",
      showPages  : true,
      showCopies : true,
    },

    photoid: {
      colorLabel : "Color Mode",
      colorOpts  : [["color","Full Color"],["bw","Black and White"]],
      showColor  : true,
      sizeLabel  : "Photo Size",
      sizes      : [["1x1","1×1 inch"],["2x2","2×2 inch"],["passport","Passport Size"]],
      pagesLabel : "Quantity",
      showPages  : true,
      showCopies : true,
    },

    lamination: {
      colorLabel : "Finish Type",
      colorOpts  : [["glossy","Glossy"],["matte","Matte"]],
      showColor  : true,
      sizeLabel  : "Paper Size",
      sizes      : [["a4","A4"],["long","Long Bond"],["a3","A3"]],
      pagesLabel : "Pieces",
      showPages  : true,
      showCopies : true,
    },

    poster: {
      colorLabel : "Color Mode",
      colorOpts  : [["color","Full Color"],["bw","Black and White"]],
      showColor  : true,
      sizeLabel  : "Poster Size",
      sizes      : [
        ["a3","A3 (297×420 mm)"],
        ["a2","A2 (420×594 mm)"],
        ["a1","A1 (594×841 mm)"],
        ["a0","A0 (841×1189 mm)"],
      ],
      pagesLabel : "Quantity",
      showPages  : true,
      showCopies : true,
    },

    banner: {
      colorLabel : "Color Mode",
      colorOpts  : [["color","Full Color"],["bw","Black and White"]],
      showColor  : true,
      sizeLabel  : "Banner Size",
      sizes      : [
        ["2x3","2 ft × 3 ft"],
        ["3x4","3 ft × 4 ft"],
        ["4x6","4 ft × 6 ft"],
        ["4x8","4 ft × 8 ft"],
        ["custom","Custom Size"],
      ],
      pagesLabel : "Quantity",
      showPages  : true,
      showCopies : true,
      showCustom : true,
    },

    softbinding: {
      colorLabel : "Color Mode",
      colorOpts  : [["bw","Black and White"],["color","Full Color"]],
      showColor  : true,
      sizeLabel  : "Paper Size",
      sizes      : [["a4","A4"],["long","Long Bond"],["a3","A3"]],
      pagesLabel : "Pages",
      showPages  : true,
      showCopies : true,
    },

    spiralbinding: {
      colorLabel : "Color Mode",
      colorOpts  : [["bw","Black and White"],["color","Full Color"]],
      showColor  : true,
      sizeLabel  : "Paper Size",
      sizes      : [["a4","A4"],["long","Long Bond"],["a3","A3"]],
      pagesLabel : "Pages",
      showPages  : true,
      showCopies : true,
    },
  };

  /* ─────────────────────────────────────────────────────────────────
   * 2. ELEMENT REFERENCES
   * ───────────────────────────────────────────────────────────────── */
  var serviceType   = document.getElementById("service-type");
  var colorMode     = document.getElementById("color-mode");
  var paperSize     = document.getElementById("paper-size");
  var copies        = document.getElementById("copies");
  var pages         = document.getElementById("pages");
  var colorLabel    = document.getElementById("color-label");
  var sizeLabel     = document.getElementById("size-label");
  var pagesLabel    = document.getElementById("pages-label");
  var quickLayout   = document.getElementById("quick-layout");
  var slotColor     = document.querySelector(".slot-color");
  var slotCopies    = document.querySelector(".slot-copies");
  var slotPages     = document.getElementById("slot-pages");
  var slotCustom    = document.getElementById("slot-custom");
  var customWidth   = document.getElementById("custom-width");
  var customHeight  = document.getElementById("custom-height");

  // Bail if the Quick Print panel is not on this page
  if (!serviceType || !quickLayout) return;

  /** Home uses a select#service-type; service pages use a hidden input with a fixed service key. */
  var serviceKeyIsSelect = serviceType.tagName === "SELECT";

  function notify(msg, type) {
    if (typeof window.showToast === "function") {
      window.showToast(msg, { type: type || "info" });
    } else {
      window.alert(msg);
    }
  }

  /* ─────────────────────────────────────────────────────────────────
   * 3. HELPERS
   * ───────────────────────────────────────────────────────────────── */
  function setOptions(sel, opts) {
    sel.innerHTML = opts
      .map(function (o) {
        return '<option value="' + o[0] + '">' + o[1] + "</option>";
      })
      .join("");
  }

  // Show or hide a slot div and disable/enable its inputs accordingly
  function toggleSlot(el, visible) {
    if (!el) return;
    el.classList.toggle("slot-hidden", !visible);
    el.querySelectorAll("input, select").forEach(function (inp) {
      inp.disabled = !visible;
    });
  }

  function animateLayout() {
    quickLayout.classList.remove("is-switching");
    void quickLayout.offsetWidth; // force reflow
    quickLayout.classList.add("is-switching");
    setTimeout(function () { quickLayout.classList.remove("is-switching"); }, 300);
  }

  /* ─────────────────────────────────────────────────────────────────
   * 4. CUSTOM SIZE SLOT  (banner → "Custom Size" only)
   * ───────────────────────────────────────────────────────────────── */
  function updateCustomSlot() {
    var cfg  = SERVICE_CONFIG[serviceType.value] || SERVICE_CONFIG.document;
    var show = !!(cfg.showCustom && paperSize.value === "custom");

    slotCustom.classList.toggle("slot-custom-hidden", !show);
    customWidth.required  = show;
    customHeight.required = show;

    if (!show) {
      customWidth.value  = "";
      customHeight.value = "";
    }
  }

  /* ─────────────────────────────────────────────────────────────────
   * 5. MAIN SERVICE UPDATE
   *    Called on page load and every time the service dropdown changes
   * ───────────────────────────────────────────────────────────────── */
  function updateService() {
    var cfg = SERVICE_CONFIG[serviceType.value] || SERVICE_CONFIG.document;

    // Update labels
    if (colorLabel) colorLabel.textContent = cfg.colorLabel;
    if (sizeLabel) sizeLabel.textContent = cfg.sizeLabel;
    if (pagesLabel) pagesLabel.textContent = cfg.pagesLabel;

    // Rebuild dropdown options
    setOptions(colorMode, cfg.colorOpts);
    setOptions(paperSize, cfg.sizes);

    // Toggle slot visibility
    toggleSlot(slotColor,  cfg.showColor  !== false);
    toggleSlot(slotCopies, cfg.showCopies !== false);
    toggleSlot(slotPages,  cfg.showPages  !== false);

    // Handle custom banner size slot
    updateCustomSlot();

    // Animate
    animateLayout();
  }

  if (serviceKeyIsSelect) {
    serviceType.addEventListener("change", updateService);
  }
  paperSize.addEventListener("change", updateCustomSlot);

  // Run once on load
  updateService();

  function serviceLabel(value) {
    if (serviceKeyIsSelect) {
      var opt = serviceType.querySelector('option[value="' + value + '"]');
      if (opt) return opt.textContent;
    }
    var key = String(value || "");
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ") || "Print job";
  }

  function selectedText(select) {
    if (!select || !select.options || select.selectedIndex < 0) return "";
    return select.options[select.selectedIndex].textContent;
  }

  function validateCurrentPrintJob() {
    var isBannerCustom = serviceType.value === "banner" && paperSize.value === "custom";

    if (isBannerCustom) {
      var w = parseFloat(customWidth.value);
      var h = parseFloat(customHeight.value);
      if (!w || !h || w <= 0 || h <= 0) {
        notify("Please enter a valid custom width and height.", "error");
        return false;
      }
    }

    if (!files.length) {
      notify("Please add at least one file to print.", "error");
      return false;
    }

    return true;
  }

  function createPrintJobSnapshot() {
    var cfg = SERVICE_CONFIG[serviceType.value] || SERVICE_CONFIG.document;
    var isBannerCustom = serviceType.value === "banner" && paperSize.value === "custom";
    var jobFiles = files.slice();
    return {
      service: serviceType.value,
      serviceLabel: serviceLabel(serviceType.value),
      colorMode: cfg.showColor !== false ? colorMode.value : "",
      colorLabel: cfg.showColor !== false ? selectedText(colorMode) : "",
      size: paperSize.value,
      sizeLabel: selectedText(paperSize),
      copies: cfg.showCopies !== false ? (copies.value || 1) : 1,
      pages: cfg.showPages !== false ? (pages.value || 1) : 1,
      customWidth: isBannerCustom ? customWidth.value : "",
      customHeight: isBannerCustom ? customHeight.value : "",
      files: jobFiles,
    };
  }

  function formDataFromJob(job) {
    var formData = new FormData();
    job.files.forEach(function (f) { formData.append("files", f); });
    formData.append("service", job.service);
    formData.append("colorMode", job.colorMode || "");
    formData.append("size", job.size || "");
    formData.append("copies", job.copies || 1);
    formData.append("pages", job.pages || 1);
    if (job.customWidth && job.customHeight) {
      formData.append("customWidth", job.customWidth);
      formData.append("customHeight", job.customHeight);
    }
    return formData;
  }

  /* ─────────────────────────────────────────────────────────────────
   * 6. FILE HANDLING  (drag-and-drop + file input)
   * ───────────────────────────────────────────────────────────────── */
  var dropZone        = document.getElementById("drop-zone");
  var fileInput       = document.getElementById("print-file");
  var fileStatus      = document.getElementById("file-status");
  var previewPopup    = document.getElementById("preview-popup");
  var previewSlider   = document.getElementById("preview-slider");
  var previewFilename = document.getElementById("preview-filename");
  var prevBtn         = document.getElementById("prev-file");
  var nextBtn         = document.getElementById("next-file");
  var slideIndex      = document.getElementById("slide-index");
  var confirmBtn      = document.getElementById("confirm-file");
  var previewBtn      = document.getElementById("preview-btn");
  var submitBtn       = document.getElementById("submit-btn");

  var files      = [];
  var objectUrls = [];
  var currentIdx = 0;
  var pendingSubmit = null;
  var pendingCartItems = null;
  var cartItems = [];
  var cartActions = null;
  var addToCartBtn = null;
  var viewCartBtn = null;
  var cartBadge = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Drag & drop ──────────────────────────────────────
  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropZone.classList.add("dragging");
  });

  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("dragging");
  });

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("dragging");
    var dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length) addFiles(dropped);
  });

  // ── File input change ────────────────────────────────
  fileInput.addEventListener("change", function () {
    addFiles(Array.from(fileInput.files));
    fileInput.value = ""; // allow re-selecting the same file
  });

  // ── Add files to internal array ──────────────────────
  function addFiles(newFiles) {
    if (!newFiles.length) return;
    files = files.concat(newFiles);
    syncInput();
    renderSlides();
    showSlide(files.length - newFiles.length); // jump to first new file
    openPreview();
    updateIndicator();
  }

  // ── Sync DataTransfer back to the hidden <input> ─────
  function syncInput() {
    try {
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(f); });
      fileInput.files = dt.files;
    } catch (e) { /* Safari fallback – silent */ }
  }

  // ── Update file-count label ───────────────────────────
  function updateIndicator() {
    if (!fileStatus) return;
    if (files.length === 0) {
      fileStatus.textContent = "No files selected";
      fileStatus.classList.remove("has-files");
    } else {
      fileStatus.textContent = files.length + " file(s) selected";
      fileStatus.classList.add("has-files");
    }
    previewBtn.style.display = files.length ? "inline-flex" : "none";
  }

  function setupCartControls() {
    cartActions = document.createElement("div");
    cartActions.className = "quick-cart-actions";
    cartActions.innerHTML =
      '<button type="button" class="btn btn-outline full-width quick-cart-add" id="add-to-cart-btn">Add to cart</button>' +
      '<button type="button" class="btn btn-outline full-width quick-cart-view" id="view-cart-btn">Cart <span class="quick-cart-badge" id="quick-cart-badge">0</span></button>';
    submitBtn.insertAdjacentElement("beforebegin", cartActions);

    addToCartBtn = cartActions.querySelector("#add-to-cart-btn");
    viewCartBtn = cartActions.querySelector("#view-cart-btn");
    cartBadge = cartActions.querySelector("#quick-cart-badge");

    addToCartBtn.addEventListener("click", addCurrentJobToCart);
    viewCartBtn.addEventListener("click", openCartModal);
    window.addEventListener("printurge-auth-change", updateCartVisibility);
    updateCartVisibility();
  }

  function updateCartVisibility() {
    var visible = isSignedIn();
    if (cartActions) cartActions.hidden = !visible;
    if (addToCartBtn) addToCartBtn.hidden = !visible;
    if (viewCartBtn) viewCartBtn.hidden = !visible;
    if (!visible && cartItems.length) {
      cartItems = [];
      renderCart();
      closeCartModal();
      notify("Print cart cleared after signing out.", "info");
    }
    updateCartBadge();
  }

  function updateCartBadge() {
    if (cartBadge) cartBadge.textContent = String(cartItems.length);
    if (viewCartBtn) viewCartBtn.disabled = !cartItems.length;
  }

  function addCurrentJobToCart() {
    if (!isSignedIn()) {
      notify("Print cart is available for signed-in accounts only.", "error");
      return;
    }
    if (!validateCurrentPrintJob()) return;

    cartItems.push(createPrintJobSnapshot());
    closePreview(true);
    updateCartBadge();
    renderCart();
    notify("Added to cart. You can add another print job now.", "success");
  }

  // ── Render all slides ─────────────────────────────────
  setupCartControls();
  updateIndicator();

  function renderSlides() {
    previewSlider.innerHTML = "";
    objectUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    objectUrls = [];

    files.forEach(function (file, idx) {
      var url = URL.createObjectURL(file);
      objectUrls.push(url);

      var slide = document.createElement("div");
      slide.className = "preview-slide";

      var content;
      if (file.type.startsWith("image/")) {
        content = '<img src="' + url + '" alt="' + file.name + '">';
      } else if (file.type === "application/pdf") {
        content = '<iframe src="' + url + '" title="' + file.name + '"></iframe>';
      } else {
        content = '<p class="unsupported-file">📄 ' + file.name + '</p>';
      }

      slide.innerHTML =
        content +
        '<div class="file-chip">' +
          '<span>' + file.name + '</span>' +
          '<button type="button" class="remove-file" data-index="' + idx + '">✕</button>' +
        '</div>';

      previewSlider.appendChild(slide);
    });

    attachRemoveButtons();
  }

  // ── Show a slide by index ─────────────────────────────
  function showSlide(idx) {
    var slides = previewSlider.querySelectorAll(".preview-slide");
    if (!files.length) { closePreview(true); return; }
    if (idx < 0) idx = 0;
    if (idx >= files.length) idx = files.length - 1;

    slides.forEach(function (s) { s.classList.remove("active"); });
    if (slides[idx]) slides[idx].classList.add("active");

    currentIdx = idx;
    slideIndex.textContent      = (idx + 1) + " / " + files.length;
    previewFilename.textContent = files[idx] ? files[idx].name : "";
  }

  // ── Attach remove buttons inside slides ──────────────
  function attachRemoveButtons() {
    previewSlider.querySelectorAll(".remove-file").forEach(function (btn) {
      btn.onclick = function () {
        var idx = Number(btn.dataset.index);
        files.splice(idx, 1);
        syncInput();
        updateIndicator();

        if (!files.length) { closePreview(true); return; }
        if (currentIdx >= files.length) currentIdx = files.length - 1;

        renderSlides();
        showSlide(currentIdx);
      };
    });
  }

  // ── Open / close preview popup ────────────────────────
  function openPreview() {
    previewPopup.classList.add("active");
  }

  function closePreview(full) {
    previewPopup.classList.remove("active");
    if (full) {
      files = [];
      objectUrls.forEach(function (u) { URL.revokeObjectURL(u); });
      objectUrls             = [];
      currentIdx             = 0;
      previewSlider.innerHTML = "";
      slideIndex.textContent  = "0 / 0";
      previewFilename.textContent = "No file selected";
      updateIndicator();
    }
  }

  // ── Slider navigation ─────────────────────────────────
  function ensureCartModal() {
    var modal = document.getElementById("printurge-cart-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "modal print-cart-modal";
    modal.id = "printurge-cart-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="modal-overlay" data-cart-close></div>' +
      '<div class="modal-content auth-modal" role="dialog" aria-modal="true" aria-labelledby="print-cart-title">' +
      '<div class="modal-header auth-header"><div class="auth-heading">' +
      '<h2 class="auth-title" id="print-cart-title">Print cart</h2>' +
      '<p class="auth-subtitle" id="print-cart-subtitle">Review multiple print jobs before checkout.</p>' +
      '</div><button type="button" class="modal-close" data-cart-close aria-label="Close">Close</button></div>' +
      '<div class="print-cart-list" id="print-cart-list"></div>' +
      '<p class="auth-hint print-cart-empty" id="print-cart-empty">Your cart is empty. Add a print job first.</p>' +
      '<div class="payment-actions">' +
      '<button type="button" class="btn btn-outline" data-cart-close>Keep adding</button>' +
      '<button type="button" class="btn btn-primary" id="print-cart-checkout">Checkout cart</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-cart-close]").forEach(function (el) {
      el.addEventListener("click", closeCartModal);
    });
    modal.querySelector("#print-cart-checkout").addEventListener("click", function () {
      if (!isSignedIn()) {
        notify("Print cart is available for signed-in accounts only.", "error");
        return;
      }
      if (!cartItems.length) {
        notify("Your print cart is empty.", "error");
        return;
      }
      closeCartModal();
      openCartPaymentModal(cartItems.slice());
    });
    return modal;
  }

  function renderCart() {
    var modal = document.getElementById("printurge-cart-modal");
    if (!modal) return;
    var list = modal.querySelector("#print-cart-list");
    var empty = modal.querySelector("#print-cart-empty");
    var checkout = modal.querySelector("#print-cart-checkout");
    if (!list || !empty || !checkout) return;

    list.innerHTML = cartItems.map(function (item, idx) {
      var details = [
        item.sizeLabel,
        item.colorLabel,
        item.copies + " copy/copies",
        item.pages + " page(s)",
      ].filter(Boolean).join(" · ");
      return (
        '<article class="print-cart-item">' +
        '<div><strong>' + escapeHtml(item.serviceLabel) + '</strong>' +
        '<span>' + escapeHtml(details) + '</span>' +
        '<small>' + item.files.length + ' file(s)</small></div>' +
        '<button type="button" class="btn btn-outline print-cart-remove" data-cart-remove="' + idx + '">Remove</button>' +
        '</article>'
      );
    }).join("");

    list.querySelectorAll("[data-cart-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        cartItems.splice(Number(btn.dataset.cartRemove), 1);
        updateCartBadge();
        renderCart();
      });
    });
    empty.hidden = !!cartItems.length;
    checkout.disabled = !cartItems.length;
  }

  function openCartModal() {
    if (!isSignedIn()) {
      notify("Print cart is available for signed-in accounts only.", "error");
      return;
    }
    var modal = ensureCartModal();
    renderCart();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
  }

  function closeCartModal() {
    var modal = document.getElementById("printurge-cart-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
  }

  prevBtn.addEventListener("click", function () { showSlide(currentIdx - 1); });
  nextBtn.addEventListener("click", function () { showSlide(currentIdx + 1); });

  // ── Preview button ────────────────────────────────────
  previewBtn.addEventListener("click", function () {
    if (files.length) {
      renderSlides();
      showSlide(currentIdx);
      openPreview();
    }
  });

  // ── Confirm – close popup, keep files ────────────────
  confirmBtn.addEventListener("click", function () {
    previewPopup.classList.remove("active");
    if (files.length) {
      notify("Files are set for your print request.", "success");
    }
  });

  /* ─────────────────────────────────────────────────────────────────
   * 7. FORM SUBMISSION
   * ───────────────────────────────────────────────────────────────── */
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

  function isSignedIn() {
    var s = window.PrintUrgeSession && window.PrintUrgeSession.get && window.PrintUrgeSession.get();
    return !!(s && s.user);
  }

  function getSessionUser() {
    var s = window.PrintUrgeSession && window.PrintUrgeSession.get && window.PrintUrgeSession.get();
    return s && s.user ? s.user : null;
  }

  function getQrSrc() {
    if (window.PRINTURGE_QR_SRC) return window.PRINTURGE_QR_SRC;
    var basePath = typeof window.PrintUrgeApiPath === "function" ? window.PrintUrgeApiPath("/") : "/";
    return basePath.replace(/\/$/, "") + "/asssets/payment-qr.png";
  }

  function isValidEmail(s) {
    s = String(s || "").trim();
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function ensureBankQrWindowModal() {
    var modal = document.getElementById("printurge-bank-qr-window");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "modal payment-modal payment-bank-layer";
    modal.id = "printurge-bank-qr-window";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="modal-overlay" data-bank-win-close></div>' +
      '<div class="modal-content auth-modal" role="dialog" aria-modal="true" aria-labelledby="bank-win-title">' +
      '<div class="modal-header auth-header">' +
      '<div class="auth-heading">' +
      '<h2 class="auth-title" id="bank-win-title">Bank transfer</h2>' +
      '<p class="auth-subtitle">Scan the QR code with your banking app, then continue to upload your receipt.</p>' +
      '</div><button type="button" class="modal-close" data-bank-win-close aria-label="Close">Close</button></div>' +
      '<div class="payment-qr-wrap">' +
      '<p class="payment-qr-label" style="margin:0 0 .5rem;font-weight:600;text-align:center">Bank QR image</p>' +
      '<img src="' + getQrSrc() + '" alt="Banking QR code" onerror="this.style.display=\'none\'; var n=this.nextElementSibling; if(n) n.hidden=false;">' +
      '<p hidden class="payment-qr-fallback">Add your banking QR image at <strong>asssets/payment-qr.png</strong>.</p></div>' +
      '<p class="auth-hint">Complete the transfer, then choose <strong>Continue to receipt</strong>. Staff will confirm your payment before printing.</p>' +
      '<div class="payment-actions" style="margin-top:.5rem">' +
      '<button type="button" class="btn btn-outline" data-bank-win-back>Back</button>' +
      '<button type="button" class="btn btn-primary" data-bank-win-continue>Continue to receipt</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-bank-win-close]").forEach(function (el) {
      el.addEventListener("click", closeBankQrWindowModal);
    });
    modal.querySelector("[data-bank-win-back]").addEventListener("click", function () {
      closeBankQrWindowModal();
      showPaymentStep("details");
    });
    modal.querySelector("[data-bank-win-continue]").addEventListener("click", function () {
      closeBankQrWindowModal();
      showPaymentStep("receipt");
    });
    return modal;
  }

  function openBankQrWindowModal() {
    var modal = ensureBankQrWindowModal();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeBankQrWindowModal() {
    var modal = document.getElementById("printurge-bank-qr-window");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function ensurePaymentModal() {
    var modal = document.getElementById("guest-payment-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "modal payment-modal";
    modal.id = "guest-payment-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="modal-overlay" data-payment-close></div>' +
      '<div class="modal-content auth-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">' +
      '<div class="modal-header auth-header"><div class="auth-heading">' +
      '<h2 class="auth-title" id="payment-title">Checkout details</h2>' +
      '<p class="auth-subtitle" id="payment-subtitle">We need your contact information before submitting your print job.</p>' +
      '</div><button type="button" class="modal-close" data-payment-close aria-label="Close">Close</button></div>' +
      '<div class="payment-step is-active" id="payment-details-step">' +
      '<label class="field"><span>Name</span><input type="text" name="customerName" required autocomplete="name"></label>' +
      '<label class="field"><span>Email</span><input type="email" name="customerEmail" required autocomplete="email" placeholder="For e-receipt and order tracking"></label>' +
      '<label class="field"><span>Notes</span><textarea name="customerNotes" rows="3" placeholder="Paper instructions, pickup notes, or contact details"></textarea></label>' +
      '<label class="field"><span>Payment method</span><select name="paymentMethod" required><option value="cash" selected>Cash on pickup</option><option value="bank_qr" data-account-only>Bank QR Transfer</option></select></label>' +
      '<button type="button" class="btn btn-primary full-width" id="payment-details-continue">Continue</button>' +
      '</div>' +
      '<div class="payment-step" id="payment-cash-confirm-step">' +
      '<p class="auth-hint" id="payment-cash-lead">You chose <strong>cash on pickup</strong>. No bank payment or receipt upload is needed.</p>' +
      '<p class="auth-hint" id="payment-cash-summary" style="margin-top:0"></p>' +
      '<div class="payment-actions">' +
      '<button type="button" class="btn btn-outline" data-cash-confirm-back>Back</button>' +
      '<button type="button" class="btn btn-primary" id="payment-cash-confirm-submit">Confirm order</button>' +
      '</div></div>' +
      '<div class="payment-step" id="payment-receipt-step">' +
      '<p class="auth-hint" id="payment-receipt-hint">Upload a clear photo or screenshot of your bank transfer receipt. Staff will verify it before confirming payment.</p>' +
      '<label class="field"><span>Receipt image</span><input type="file" id="payment-receipt-input" accept="image/*"></label>' +
      '<div class="payment-actions">' +
      '<button type="button" class="btn btn-outline" data-receipt-back>Back</button>' +
      '<button type="button" class="btn btn-primary" id="payment-paid-submit">I have paid — submit proof</button>' +
      '</div></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-payment-close]").forEach(function (el) {
      el.addEventListener("click", closePaymentModal);
    });
    modal.querySelector("#payment-details-continue").addEventListener("click", function () {
      var details = readPaymentDetails();
      if (!details.customerName) {
        notify("Please enter your name.", "error");
        return;
      }
      if (!isValidEmail(details.customerEmail)) {
        notify("Please enter a valid email for your receipt and order tracking.", "error");
        return;
      }
      var pm = details.paymentMethod;
      if (pm === "bank_qr" && !isSignedIn()) {
        notify("Bank QR Transfer is available for signed-in accounts only.", "error");
        syncPaymentMethodLock();
        return;
      }
      if (pm === "cash") {
        updateCashConfirmSummary();
        showPaymentStep("cashConfirm");
        return;
      }
      openBankQrWindowModal();
    });
    modal.querySelector("[data-cash-confirm-back]").addEventListener("click", function () {
      showPaymentStep("details");
    });
    modal.querySelector("#payment-cash-confirm-submit").addEventListener("click", function () {
      var details = readPaymentDetails();
      if (!details.customerName || !isValidEmail(details.customerEmail)) {
        showPaymentStep("details");
        notify("Please complete your name and email.", "error");
        return;
      }
      details.paymentStatus = "unpaid";
      details.paymentMethod = "cash";
      submitPendingCheckout(details, null);
    });
    modal.querySelector("[data-receipt-back]").addEventListener("click", function () {
      openBankQrWindowModal();
    });
    modal.querySelector("#payment-paid-submit").addEventListener("click", function () {
      var details = readPaymentDetails();
      var inp = modal.querySelector("#payment-receipt-input");
      var f = inp && inp.files && inp.files[0];
      if (!f) {
        notify("Please attach a receipt image.", "error");
        return;
      }
      if (!details.customerName || !isValidEmail(details.customerEmail)) {
        showPaymentStep("details");
        notify("Please complete your name and email.", "error");
        return;
      }
      details.paymentStatus = "pending_review";
      submitPendingCheckout(details, f);
    });
    return modal;
  }

  function syncPaymentMethodLock() {
    var modal = ensurePaymentModal();
    var select = modal.querySelector('[name="paymentMethod"]');
    var bankOption = modal.querySelector('[name="paymentMethod"] option[value="bank_qr"]');
    if (!select || !bankOption) return;

    var locked = !isSignedIn();
    bankOption.disabled = locked;
    bankOption.textContent = locked
      ? "Bank QR Transfer (accounts only)"
      : "Bank QR Transfer";
    if (locked && select.value === "bank_qr") {
      select.value = "cash";
    }
  }

  function prefillCheckoutIdentity() {
    var user = getSessionUser();
    if (!user) return;
    var modal = ensurePaymentModal();
    var name = modal.querySelector('[name="customerName"]');
    var email = modal.querySelector('[name="customerEmail"]');
    if (name && !name.value.trim()) name.value = user.name || "";
    if (email && !email.value.trim()) email.value = user.email || "";
  }

  function updateCashConfirmSummary() {
    var modal = ensurePaymentModal();
    var d = readPaymentDetails();
    var sum = modal.querySelector("#payment-cash-summary");
    if (sum) {
      sum.textContent = d.customerName + " · " + d.customerEmail;
    }
  }

  function showPaymentStep(step) {
    var modal = ensurePaymentModal();
    var dStep = modal.querySelector("#payment-details-step");
    var cStep = modal.querySelector("#payment-cash-confirm-step");
    var rStep = modal.querySelector("#payment-receipt-step");
    if (dStep) dStep.classList.toggle("is-active", step === "details");
    if (cStep) cStep.classList.toggle("is-active", step === "cashConfirm");
    if (rStep) rStep.classList.toggle("is-active", step === "receipt");
    var t = modal.querySelector("#payment-title");
    var s = modal.querySelector("#payment-subtitle");
    if (step === "receipt") {
      t.textContent = "Payment proof";
      s.textContent = "Upload your transfer receipt so staff can verify your payment.";
    } else if (step === "cashConfirm") {
      t.textContent = "Confirm your order";
      s.textContent = "Review and submit. Pay cash when you pick up your prints.";
    } else {
      t.textContent = "Checkout details";
      s.textContent = "We need your contact information before submitting your print job.";
    }
    var rin = modal.querySelector("#payment-receipt-input");
    if (rin) rin.value = "";
  }

  function openPaymentModal(formData) {
    pendingSubmit = formData;
    pendingCartItems = null;
    var modal = ensurePaymentModal();
    var paymentMethod = modal.querySelector('[name="paymentMethod"]');
    if (paymentMethod) paymentMethod.value = "cash";
    closeBankQrWindowModal();
    syncPaymentMethodLock();
    prefillCheckoutIdentity();
    showPaymentStep("details");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
  }

  function openCartPaymentModal(items) {
    pendingSubmit = null;
    pendingCartItems = items;
    var modal = ensurePaymentModal();
    var paymentMethod = modal.querySelector('[name="paymentMethod"]');
    if (paymentMethod) paymentMethod.value = "cash";
    closeBankQrWindowModal();
    syncPaymentMethodLock();
    prefillCheckoutIdentity();
    showPaymentStep("details");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
  }

  function closePaymentModal() {
    closeBankQrWindowModal();
    var modal = document.getElementById("guest-payment-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
    pendingSubmit = null;
    pendingCartItems = null;
  }

  function readPaymentDetails() {
    var modal = ensurePaymentModal();
    return {
      customerName: modal.querySelector('[name="customerName"]').value.trim(),
      customerEmail: modal.querySelector('[name="customerEmail"]').value.trim(),
      customerNotes: modal.querySelector('[name="customerNotes"]').value.trim(),
      paymentMethod: modal.querySelector('[name="paymentMethod"]').value,
      paymentStatus: "unpaid",
    };
  }

  function applyPaymentDetails(formData, paymentDetails, receiptFile) {
    if (paymentDetails) {
      formData.set("customerName", paymentDetails.customerName || "");
      formData.set("customerEmail", paymentDetails.customerEmail || "");
      formData.set("customerNotes", paymentDetails.customerNotes || "");
      formData.set("paymentMethod", paymentDetails.paymentMethod || "");
      formData.set("paymentStatus", paymentDetails.paymentStatus || "unpaid");
    }
    if (receiptFile) {
      formData.set("paymentReceipt", receiptFile);
    }
  }

  async function postPrintRequest(formData, paymentDetails, receiptFile) {
    applyPaymentDetails(formData, paymentDetails, receiptFile);
    var headers = {};
    if (window.PrintUrgeSession && typeof window.PrintUrgeSession.getToken === "function") {
      var tok = window.PrintUrgeSession.getToken();
      if (tok) headers.Authorization = "Bearer " + tok;
    }
    var apiPath = window.PrintUrgeApiPath || function (path) { return path; };
    var res = await fetch(apiPath("/api/print-requests"), { method: "POST", headers: headers, body: formData });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.detail ? (data.error || "Upload failed") + ": " + data.detail : data.error || "Upload failed");
    return data;
  }

  function submitPendingCheckout(paymentDetails, receiptFile) {
    if (pendingCartItems && pendingCartItems.length) {
      sendCartRequests(pendingCartItems, paymentDetails, receiptFile);
      return;
    }
    if (pendingSubmit) sendPrintRequest(pendingSubmit, paymentDetails, receiptFile);
  }

  async function sendPrintRequest(formData, paymentDetails, receiptFile) {
    try {
      setButtonLoading(submitBtn, true, "Sending...");
      var data = await postPrintRequest(formData, paymentDetails, receiptFile);
      var ps = data.payment_status || "";
      var extra = ps === "pending_review" ? " Payment proof received; staff will confirm shortly." : "";
      notify("Print request submitted. Transaction " + (data.transaction_id || "created") + "." + extra, "success");
      closePaymentModal();
      closePreview(true);
    } catch (err) {
      console.error(err);
      notify(err.message || "We could not submit your request. Check your connection and try again.", "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  async function sendCartRequests(items, paymentDetails, receiptFile) {
    try {
      setButtonLoading(submitBtn, true, "Submitting cart...");
      var created = [];
      for (var i = 0; i < items.length; i += 1) {
        var data = await postPrintRequest(formDataFromJob(items[i]), paymentDetails, receiptFile);
        created.push(data.transaction_id || ("item " + (i + 1)));
      }
      cartItems = [];
      updateCartBadge();
      renderCart();
      closePaymentModal();
      notify("Cart submitted. Transactions: " + created.join(", ") + ".", "success");
    } catch (err) {
      console.error(err);
      notify(err.message || "We could not submit your cart. Check your connection and try again.", "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  }

  submitBtn.addEventListener("click", async function () {
    if (!validateCurrentPrintJob()) return;
    openPaymentModal(formDataFromJob(createPrintJobSnapshot()));
  });

})();
