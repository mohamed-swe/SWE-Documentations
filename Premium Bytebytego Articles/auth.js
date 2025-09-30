(function () {
  function isSessionValid() {
    try {
      const raw = localStorage.getItem("auth.session");
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (!session || !session.expiryAt) return false;
      return Date.now() < Number(session.expiryAt);
    } catch (e) {
      return false;
    }
  }

  function logoutIfExpired() {
    if (!isSessionValid()) {
      localStorage.removeItem("auth.session");
    }
  }

  function enforceAuthIfNeeded() {
    const shouldEnforce =
      typeof window !== "undefined" && !!window.ENFORCE_AUTH;
    if (!shouldEnforce) return;
    if (!isSessionValid()) {
      try {
        const current = window.location.pathname.replace(/^\/+/, "");
        sessionStorage.setItem(
          "auth.redirect",
          current || "articles/index.html"
        );
      } catch (_) {}
      window.location.replace("../login.html");
    }
  }

  function attachGlobalHelpers() {
    window.auth = window.auth || {};
    window.auth.logout = function () {
      localStorage.removeItem("auth.session");
      window.location.replace("login.html");
    };
    window.auth.isLoggedIn = isSessionValid;
  }

  logoutIfExpired();
  attachGlobalHelpers();
  enforceAuthIfNeeded();
})();
