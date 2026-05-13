(function () {
  "use strict";

  if (!window.PrintUrgeCache) return;

  var cache = window.PrintUrgeCache;
  var apiPath = window.PrintUrgeApiPath || function (path) { return path; };
  var servicesSection = document.getElementById("services");
  var servicesSkeleton = document.getElementById("services-skeleton");

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
    if (window.PrintUrgeSkeleton && servicesSkeleton) {
      window.PrintUrgeSkeleton.services(servicesSkeleton, 8);
    }
    try {
      var results = await Promise.all([loadServicesList(), loadShopInfo()]);
      window.PrintUrgeServices = results[0].services || [];
      window.PrintUrgeShopInfo = results[1].shop || {};
      if (window.PrintUrgeSkeleton && servicesSkeleton) {
        window.PrintUrgeSkeleton.hide(servicesSkeleton);
      }
    } catch (_) {
      if (window.PrintUrgeSkeleton && servicesSkeleton) {
        window.PrintUrgeSkeleton.error(servicesSkeleton, "We could not refresh the services right now. Showing the saved page content.");
      }
    } finally {
      if (servicesSection) {
        servicesSection.classList.remove("services-loading");
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", warmHomepageCache);
  } else {
    warmHomepageCache();
  }
})();
