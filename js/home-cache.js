(function () {
  "use strict";

  if (!window.PrintUrgeCache) return;

  var cache = window.PrintUrgeCache;
  var apiPath = window.PrintUrgeApiPath || function (path) { return path; };

  async function loadServicesList() {
    return cache.cachedJson(
      "services:list",
      apiPath("/api/services"),
      { method: "GET" },
      cache.ttl.tenMinutes
    );
  }

  async function loadShopInfo() {
    return cache.cachedJson(
      "shop:info",
      apiPath("/api/shop-info"),
      { method: "GET" },
      cache.ttl.thirtyMinutes
    );
  }

  async function warmHomepageCache() {
    try {
      var results = await Promise.all([loadServicesList(), loadShopInfo()]);
      window.PrintUrgeServices = results[0].services || [];
      window.PrintUrgeShopInfo = results[1].shop || {};
    } catch (_) {
      // Static homepage content remains available if these optional GETs fail.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", warmHomepageCache);
  } else {
    warmHomepageCache();
  }
})();
