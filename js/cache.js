(function () {
  "use strict";

  var PREFIX = "printurge_cache:";

  function now() {
    return Date.now();
  }

  function storageKey(key) {
    return PREFIX + String(key || "").trim();
  }

  function readEntry(key) {
    try {
      var raw = localStorage.getItem(storageKey(key));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function writeEntry(key, entry) {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(entry));
    } catch (_) {
      // localStorage can fail in private mode or when full; fall back to network-only.
    }
  }

  function isFresh(entry, ttlMs) {
    return !!(
      entry &&
      typeof entry.timestamp === "number" &&
      now() - entry.timestamp < ttlMs
    );
  }

  function clearCache(key) {
    if (!key) return;
    localStorage.removeItem(storageKey(key));
  }

  function clearCacheByPrefix(prefix) {
    var fullPrefix = storageKey(prefix);
    var keys = [];
    for (var i = 0; i < localStorage.length; i += 1) {
      keys.push(localStorage.key(i));
    }
    keys.forEach(function (key) {
      if (key.indexOf(fullPrefix) === 0) {
        localStorage.removeItem(key);
      }
    });
  }

  async function cachedFetch(key, url, options, ttlMs) {
    var maxAge = Number(ttlMs);
    var fetchOptions = options || {};
    if (!maxAge || maxAge < 0) maxAge = 0;

    var cached = readEntry(key);
    if (isFresh(cached, maxAge)) {
      return cached.data;
    }

    var response = await fetch(url, fetchOptions);
    var contentType = response.headers.get("content-type") || "";
    var data = contentType.indexOf("application/json") !== -1
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      var message = data && data.error ? data.error : "Request failed";
      throw new Error(message);
    }

    writeEntry(key, {
      timestamp: now(),
      ttlMs: maxAge,
      data: data,
    });

    return data;
  }

  function cachedJson(key, url, options, ttlMs) {
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    return cachedFetch(key, url, opts, ttlMs);
  }

  function cachedText(key, url, options, ttlMs) {
    return cachedFetch(key, url, options || {}, ttlMs);
  }

  window.PrintUrgeCache = {
    ttl: {
      oneMinute: 60 * 1000,
      fiveMinutes: 5 * 60 * 1000,
      tenMinutes: 10 * 60 * 1000,
      thirtyMinutes: 30 * 60 * 1000,
    },
    cachedFetch: cachedFetch,
    cachedJson: cachedJson,
    cachedText: cachedText,
    clearCache: clearCache,
    clearCacheByPrefix: clearCacheByPrefix,
  };

  window.clearCache = clearCache;
})();
