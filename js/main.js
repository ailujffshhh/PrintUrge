/* ─────────────────────────────────────────────────────────────────────
 * main.js
 * Handles: shared partials, navigation, auth modal, Google auth,
 *          service card filter, services slideshow, footer year.
 *
 * Quick Print panel (service fields, file upload, preview, submit)
 * is fully handled by js/quick-print.js — do NOT add it back here.
 * ───────────────────────────────────────────────────────────────────── */

const getBasePath = () => {
  const path = window.location.pathname.replace(/\\/g, "/");
  if (path.includes("/pages/services/")) return "../../";
  if (path.includes("/pages/")) return "../";
  return "";
};

window.PrintUrgeApiPath = (path) => {
  const clean = String(path);
  if (clean.startsWith("/")) return clean;
  return `${getBasePath()}${clean.replace(/^\/+/, "")}`;
};

const sharedPartials = {
  "site-header": `
<header class="site-header">
  <div class="container nav-shell">
    <a href="{{base}}index.html#top" class="brand" aria-label="PrintUrge home">
      <img src="{{base}}assets/Icons/PrintUrge_Logo.svg" alt="PrintUrge logo" class="brand-logo"/>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open navigation menu">
      <span></span><span></span><span></span>
    </button>
    <div class="nav-menu" id="site-menu">
      <nav class="site-nav" aria-label="Primary navigation">
        <a href="{{base}}index.html#services">Services</a>
        <a href="{{base}}index.html#how-it-works">How It Works</a>
        <a href="{{base}}index.html#faq">FAQ</a>
        <a href="{{base}}pages/track-order.html">Track order</a>
      </nav>
      <div class="nav-actions">
        <button type="button" class="btn btn-outline" data-open-auth="login">Log in</button>
        <button type="button" class="btn btn-primary" data-open-auth="signup">Sign up</button>
      </div>
    </div>
  </div>
  <div class="nav-backdrop" data-nav-close></div>
</header>
`,
  "auth-modal": `
<div class="modal" id="auth-modal" aria-hidden="true">
  <div class="modal-overlay" data-modal-close></div>
  <div class="modal-content auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <div class="modal-header auth-header">
      <div class="auth-heading">
        <h2 class="auth-title" id="auth-title">Log in</h2>
        <p class="auth-subtitle" id="auth-subtitle">Welcome Back</p>
      </div>
      <button type="button" class="modal-close" data-modal-close aria-label="Close dialog">Close</button>
    </div>
    <div class="modal-panel is-active" id="login-panel" role="tabpanel">
      <form class="auth-form" id="login-form" action="/api/auth/login" method="post">
        <label class="field"><span>Email</span><input type="email" name="login-email" autocomplete="email" required/></label>
        <label class="field"><span>Password</span><input type="password" name="login-password" autocomplete="current-password" required/></label>
        <div class="auth-divider"><span>or</span></div>
        <div class="auth-google" id="google-login">
          <button type="button" class="auth-google-btn" data-google-fallback>
            <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C17.4 3.4 15 2.2 12 2.2 6.9 2.2 2.7 6.4 2.7 11.5S6.9 20.8 12 20.8c7 0 8.7-4.9 8.7-7.4 0-.5-.1-.9-.1-1.2H12z"/>
              <path fill="#34A853" d="M3.9 7.1l3.1 2.3c.8-2.4 3.1-4.1 5.9-4.1 1.9 0 3.1.8 3.8 1.5l2.6-2.5C17.4 3.4 15 2.2 12 2.2 8.1 2.2 4.8 4.5 3.9 7.1z"/>
              <path fill="#FBBC05" d="M12 20.8c2.9 0 5.3-1 7.1-2.7l-3.3-2.7c-.9.6-2.1 1.1-3.8 1.1-3 0-5.5-2-6.4-4.7L2.4 14c1.9 3.8 5.6 6.8 9.6 6.8z"/>
              <path fill="#4285F4" d="M20.6 13.4c.1-.5.2-1 .2-1.6 0-.5-.1-.9-.1-1.2H12v3.9h5.5c-.3 1.4-1.2 2.7-2.7 3.6l3.3 2.7c1.9-1.8 2.5-4.3 2.5-7.4z"/>
            </svg>
            Log in with Google
          </button>
        </div>
        <button type="submit" class="btn btn-primary full-width">Log in</button>
        <p class="auth-hint">Don't have an account? <button type="button" class="link-btn" data-auth-tab="signup">Create Here</button></p>
      </form>
    </div>
    <div class="modal-panel" id="signup-panel" role="tabpanel">
      <form class="auth-form" id="signup-form" action="/api/auth/register" method="post">
        <label class="field"><span>Name</span><input type="text" name="signup-name" autocomplete="name" required/></label>
        <label class="field"><span>Email</span><input type="email" name="signup-email" autocomplete="email" required/></label>
        <label class="field"><span>Password</span><input type="password" name="signup-password" autocomplete="new-password" required/></label>
        <label class="field"><span>Confirm Password</span><input type="password" name="signup-confirm" autocomplete="new-password" required/></label>
        <div class="auth-divider"><span>or</span></div>
        <div class="auth-google" id="google-signup">
          <button type="button" class="auth-google-btn" data-google-fallback>
            <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C17.4 3.4 15 2.2 12 2.2 6.9 2.2 2.7 6.4 2.7 11.5S6.9 20.8 12 20.8c7 0 8.7-4.9 8.7-7.4 0-.5-.1-.9-.1-1.2H12z"/>
              <path fill="#34A853" d="M3.9 7.1l3.1 2.3c.8-2.4 3.1-4.1 5.9-4.1 1.9 0 3.1.8 3.8 1.5l2.6-2.5C17.4 3.4 15 2.2 12 2.2 8.1 2.2 4.8 4.5 3.9 7.1z"/>
              <path fill="#FBBC05" d="M12 20.8c2.9 0 5.3-1 7.1-2.7l-3.3-2.7c-.9.6-2.1 1.1-3.8 1.1-3 0-5.5-2-6.4-4.7L2.4 14c1.9 3.8 5.6 6.8 9.6 6.8z"/>
              <path fill="#4285F4" d="M20.6 13.4c.1-.5.2-1 .2-1.6 0-.5-.1-.9-.1-1.2H12v3.9h5.5c-.3 1.4-1.2 2.7-2.7 3.6l3.3 2.7c1.9-1.8 2.5-4.3 2.5-7.4z"/>
            </svg>
            Sign up with Google
          </button>
        </div>
        <button type="submit" class="btn btn-primary full-width">Create account</button>
        <p class="auth-hint">Already have an account? <button type="button" class="link-btn" data-auth-tab="login">Log In</button></p>
      </form>
    </div>
  </div>
</div>
`
};

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const notify = (message, type = "info") => {
  if (typeof window.showToast === "function") {
    window.showToast(message, { type });
  }
};

const apiErrorMessage = (data, fallback) =>
  data && (data.detail || data.error)
    ? `${data.error || fallback}: ${data.detail || ""}`.replace(/:\s*$/, "")
    : fallback;

const setButtonLoading = (btn, loading, label = "Loading...") => {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.textContent = label;
  } else {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    delete btn.dataset.originalText;
  }
};

const applyAuthSession = (data) => {
  if (!data || !data.token || !data.user || !data.user.name) {
    throw new Error("Authentication response was incomplete. Please try again.");
  }
  if (typeof window.PrintUrgeSession?.set !== "function") {
    throw new Error("Session storage is unavailable in this browser.");
  }
  window.PrintUrgeSession.set(data.token, data.user);
  refreshAuthNav();
};

const refreshAuthNav = () => {
  const wrap = document.querySelector(".nav-actions");
  if (!wrap) return;

  const basePath = getBasePath();
  const session =
    window.PrintUrgeSession && typeof window.PrintUrgeSession.get === "function"
      ? window.PrintUrgeSession.get()
      : null;

  if (session && session.user) {
    const adminBtn =
      session.user.role === "admin" || session.user.role === "staff"
        ? `<a href="${basePath}pages/admin.html" class="btn btn-outline">Admin</a>`
        : "";
    wrap.innerHTML = `
      ${adminBtn}
      <span class="nav-user-label">${escapeHtml(session.user.name)}</span>
      <button type="button" class="btn btn-primary" data-auth-logout>Log out</button>
    `;
  } else {
    wrap.innerHTML = `
      <button type="button" class="btn btn-outline" data-open-auth="login">Log in</button>
      <button type="button" class="btn btn-primary" data-open-auth="signup">Sign up</button>
    `;
  }
};

window.refreshAuthNav = refreshAuthNav;

window.addEventListener("printurge-auth-change", () => {
  refreshAuthNav();
});

/* ── Shared Partials ─────────────────────────────────────────────── */
const loadSharedPartials = async () => {
  const includeNodes = document.querySelectorAll("[data-include]");
  if (includeNodes.length === 0) return;

  const basePath = getBasePath();
  const canFetch = window.location.protocol !== "file:";

  await Promise.all(
    Array.from(includeNodes).map(async (node) => {
      const includeName = node.dataset.include;
      if (!includeName) return;

      let html = "";

      if (canFetch) {
        try {
          const response = await fetch(`${basePath}components/${includeName}.html`);
          if (response.ok) html = await response.text();
        } catch (_) { html = ""; }
      }

      if (!html && sharedPartials[includeName]) html = sharedPartials[includeName];
      if (!html) return;

      html = html.replace(/{{base}}/g, basePath);
      node.outerHTML = html;
    })
  );
};

/* ── Navigation ──────────────────────────────────────────────────── */
const initNavigation = () => {
  const navToggle  = document.querySelector(".nav-toggle");
  const navMenu    = document.querySelector(".nav-menu");
  const navBackdrop = document.querySelector(".nav-backdrop");

  if (!navToggle || !navMenu) return;

  const closeMenu = () => {
    navMenu.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-nav-open");
  };

  window._closeMenu = closeMenu;

  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("is-nav-open", isOpen);
  });

  navMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

  if (navBackdrop) navBackdrop.addEventListener("click", closeMenu);

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) closeMenu();
  });
};

const initDelegatedAuthLinks = () => {
  if (window.__printurgeDelegatedAuth) return;
  window.__printurgeDelegatedAuth = true;
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-auth]");
    if (openBtn) {
      e.preventDefault();
      if (typeof window.__printurgeOpenAuth === "function") {
        window.__printurgeOpenAuth(openBtn.getAttribute("data-open-auth") || "login");
      }
    }
    const logoutBtn = e.target.closest("[data-auth-logout]");
    if (logoutBtn) {
      e.preventDefault();
      if (typeof window.PrintUrgeSession?.clear === "function") window.PrintUrgeSession.clear();
      refreshAuthNav();
      notify("Signed out.", "info");
    }
  });
};

/* ── Auth Modal ──────────────────────────────────────────────────── */
const initAuthModal = () => {
  window.__printurgeOpenAuth = null;
  const modal = document.getElementById("auth-modal");
  if (!modal) return;

  const overlay  = modal.querySelector(".modal-overlay");
  const closeBtn = modal.querySelector(".modal-close");
  const title    = document.getElementById("auth-title");
  const subtitle = document.getElementById("auth-subtitle");

  if (!overlay || !closeBtn || !title || !subtitle) return;

  const panels = {
    login:  document.getElementById("login-panel"),
    signup: document.getElementById("signup-panel"),
  };

  const labels = {
    login:  { title: "Log in",   subtitle: "Welcome Back" },
    signup: { title: "Sign up",  subtitle: "Create Your Account" },
  };

  function setTab(tab) {
    Object.keys(panels).forEach((k) => {
      if (panels[k]) panels[k].classList.toggle("is-active", k === tab);
    });
    title.textContent    = labels[tab].title;
    subtitle.textContent = labels[tab].subtitle;
  }

  function openModal(tab) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
    setTab(tab || "login");
    if (window._closeMenu) window._closeMenu();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
  }

  window.__printurgeOpenAuth = openModal;

  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.authTab));
  });

  overlay.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
  modal.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submit = loginForm.querySelector('button[type="submit"]');
      const email = loginForm.querySelector('[name="login-email"]')?.value?.trim() || "";
      const password = loginForm.querySelector('[name="login-password"]')?.value || "";
      try {
        setButtonLoading(submit, true, "Signing in...");
        const res = await fetch(window.PrintUrgeApiPath("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(apiErrorMessage(data, "Login failed"));
        applyAuthSession(data);
        notify("Signed in.", "success");
        closeModal();
      } catch (err) {
        notify(err.message || "Login failed", "error");
      } finally {
        setButtonLoading(submit, false);
      }
    });
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = signupForm.querySelector('[name="signup-password"]');
      const cf = signupForm.querySelector('[name="signup-confirm"]');
      if (pw && cf && pw.value !== cf.value) {
        notify("Passwords do not match.", "error");
        return;
      }
      const name = signupForm.querySelector('[name="signup-name"]')?.value?.trim() || "";
      const email = signupForm.querySelector('[name="signup-email"]')?.value?.trim() || "";
      const password = pw?.value || "";
      const submit = signupForm.querySelector('button[type="submit"]');
      try {
        setButtonLoading(submit, true, "Creating...");
        const res = await fetch(window.PrintUrgeApiPath("/api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(apiErrorMessage(data, "Could not create account"));
        applyAuthSession(data);
        notify("Account created. You are signed in.", "success");
        closeModal();
      } catch (err) {
        notify(err.message || "Sign up failed", "error");
      } finally {
        setButtonLoading(submit, false);
      }
    });
  }
};

/* ── Google Auth ─────────────────────────────────────────────────── */
let googleScriptPromise;

const loadGoogleScript = () => {
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src   = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const handleGoogleCredential = (response) => {
  if (!response || !response.credential) return;
  console.log("Google credential", response.credential);
  if (typeof window.showToast === "function") {
    window.showToast("Google sign-in completed.", { type: "success" });
  }
};

const initGoogleAuth = () => {
  document.querySelectorAll("[data-google-fallback]").forEach((fallbackButton) => {
    fallbackButton.addEventListener("click", () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.prompt();
      } else if (typeof window.showToast === "function") {
        window.showToast("Google sign-in will be available once the app is configured.", { type: "info" });
      }
    });
  });

  const googleContainer = document.getElementById("google-login");
  if (!googleContainer) return;

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID") return;

  loadGoogleScript()
    .then(() => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      googleContainer.innerHTML = "";
      window.google.accounts.id.renderButton(googleContainer, {
        theme: "outline", size: "large", text: "signin_with", shape: "pill", width: 320,
      });
    })
    .catch(() => {});
};

/* ── Service Card Filter ─────────────────────────────────────────── */
const initServiceFilter = () => {
  const filterButtons = document.querySelectorAll("[data-service-filter]");
  const serviceCards  = document.querySelectorAll(".service-card");

  if (!filterButtons.length || !serviceCards.length) return;

  const applyFilter = (filter) => {
    serviceCards.forEach((card) => {
      const cats = (card.dataset.category || "").split(" ").filter(Boolean);
      card.hidden = !(filter === "all" || cats.includes(filter));
    });
  };

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      applyFilter(btn.dataset.serviceFilter || "all");
    });
  });

  applyFilter("all");
};

/* ── Footer Year ─────────────────────────────────────────────────── */
const initHeroScrollCue = () => {
  const cue = document.querySelector(".hero-scroll-down");
  if (!cue) return;

  const syncCue = () => {
    cue.classList.toggle("is-hidden", window.scrollY > 8);
  };

  syncCue();
  window.addEventListener("scroll", syncCue, { passive: true });
};

const updateYear = () => {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = String(new Date().getFullYear());
};

/* ── Boot ────────────────────────────────────────────────────────── */
const runApp = async () => {
  await loadSharedPartials();
  initDelegatedAuthLinks();
  refreshAuthNav();
  initNavigation();
  initAuthModal();
  initGoogleAuth();
  initServiceFilter();
  initHeroScrollCue();
  updateYear();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runApp);
} else {
  runApp();
}

/* ── Services Slideshow ──────────────────────────────────────────── */
(function () {
  var track      = document.getElementById("slideshow-track");
  var dotsWrap   = document.getElementById("slideshow-dots");
  var btnPrev    = document.getElementById("slide-prev");
  var btnNext    = document.getElementById("slide-next");

  if (!track || !dotsWrap || !btnPrev || !btnNext) return;

  var allCards    = Array.from(track.querySelectorAll(".service-card"));
  var filterBtns  = Array.from(document.querySelectorAll("[data-service-filter]"));
  var currentFilter = "all";
  var currentPage   = 0;

  function getPerPage() {
    var w = window.innerWidth;
    if (w <= 660)  return 1;
    if (w <= 1080) return 2;
    return 3;
  }

  function visible() {
    return allCards.filter(function (c) {
      return currentFilter === "all" ||
        (c.dataset.category || "").split(" ").includes(currentFilter);
    });
  }

  function buildDots(pages) {
    dotsWrap.innerHTML = "";
    for (var i = 0; i < pages; i++) {
      var d = document.createElement("button");
      d.className = "slideshow-dot" + (i === currentPage ? " is-active" : "");
      d.setAttribute("aria-label", "Page " + (i + 1));
      d.dataset.page = i;
      d.addEventListener("click", function () { goTo(parseInt(this.dataset.page)); });
      dotsWrap.appendChild(d);
    }
  }

  function render() {
    var vis   = visible();
    var pp    = getPerPage();
    var pages = Math.max(1, Math.ceil(vis.length / pp));
    currentPage = Math.min(currentPage, pages - 1);

    allCards.forEach(function (c) {
      var inFilter = currentFilter === "all" ||
        (c.dataset.category || "").split(" ").includes(currentFilter);
      c.classList.toggle("is-filtered-out", !inFilter);
    });

    var cardW = 0;
    if (vis.length) {
      var rect = vis[0].getBoundingClientRect();
      cardW = rect.width + 20;
    }
    track.style.transform = "translateX(-" + (currentPage * pp * cardW) + "px)";

    buildDots(pages);
    btnPrev.disabled = currentPage === 0;
    btnNext.disabled = currentPage >= pages - 1;
  }

  function goTo(page) { currentPage = page; render(); }

  btnPrev.addEventListener("click", function () { goTo(currentPage - 1); });
  btnNext.addEventListener("click", function () { goTo(currentPage + 1); });

  /* Touch / swipe */
  var startX = 0;
  track.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend",   function (e) {
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) { if (dx < 0) goTo(currentPage + 1); else goTo(currentPage - 1); }
  }, { passive: true });

  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      currentFilter = btn.dataset.serviceFilter;
      currentPage   = 0;
      render();
    });
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { currentPage = 0; render(); }, 120);
  });

  render();
})();
