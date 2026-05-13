(function () {
  "use strict";

  var STORAGE_KEY = "printurge_auth";

  function read() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.token || !data.user) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function write(data) {
    if (!data) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  window.PrintUrgeSession = {
    get: read,
    getToken: function () {
      var s = read();
      return s && s.token ? s.token : null;
    },
    set: function (token, user) {
      write({ token: token, user: user });
      window.dispatchEvent(new CustomEvent("printurge-auth-change"));
    },
    clear: function () {
      write(null);
      window.dispatchEvent(new CustomEvent("printurge-auth-change"));
    },
  };
})();
