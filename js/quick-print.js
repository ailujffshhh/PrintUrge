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

  // ── Render all slides ─────────────────────────────────
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
  submitBtn.addEventListener("click", async function () {
    var cfg            = SERVICE_CONFIG[serviceType.value] || SERVICE_CONFIG.document;
    var isBannerCustom = serviceType.value === "banner" && paperSize.value === "custom";

    if (isBannerCustom) {
      var w = parseFloat(customWidth.value);
      var h = parseFloat(customHeight.value);
      if (!w || !h || w <= 0 || h <= 0) {
        notify("Please enter a valid custom width and height.", "error");
        return;
      }
    }

    if (!files.length) {
      notify("Please add at least one file to print.", "error");
      return;
    }

    var formData = new FormData();
    files.forEach(function (f) { formData.append("files", f); });
    formData.append("service",   serviceType.value);
    formData.append("colorMode", cfg.showColor  !== false ? colorMode.value : "");
    formData.append("size",      paperSize.value);
    formData.append("copies",    cfg.showCopies !== false ? (copies.value  || 1) : 1);
    formData.append("pages",     cfg.showPages  !== false ? (pages.value   || 1) : 1);

    if (isBannerCustom) {
      formData.append("customWidth",  customWidth.value);
      formData.append("customHeight", customHeight.value);
    }

    try {
      var headers = {};
      if (window.PrintUrgeSession && typeof window.PrintUrgeSession.getToken === "function") {
        var tok = window.PrintUrgeSession.getToken();
        if (tok) headers.Authorization = "Bearer " + tok;
      }
      var apiPath = window.PrintUrgeApiPath || function (path) { return path; };
      var res = await fetch(apiPath("api/print-requests.php"), { method: "POST", headers: headers, body: formData });
      if (!res.ok) throw new Error("Upload failed");
      var data = await res.json();
      console.log("Upload success:", data);
      notify("Print request submitted successfully.", "success");
      closePreview(true);
    } catch (err) {
      console.error(err);
      notify("We could not submit your request. Check your connection and try again.", "error");
    }
  });

})();
