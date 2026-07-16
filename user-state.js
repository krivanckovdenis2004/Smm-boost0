(function () {
  "use strict";

  var authModulePromise = null;
  var latestState = { ready: false, loading: true, user: null, source: "unknown" };

  injectStyles();
  markAuthBooting();
  exposeApi();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    bindMenuOnce();
    renderLoading();
    loadAuthModule().then(function (mod) {
      mod.subscribeAuth(function (state) {
        latestState = state || latestState;
        renderFromState(latestState);
      });
    }).catch(function () {
      latestState = { ready: true, loading: false, user: getStoredUser(), source: getStoredUser() ? "legacy" : "guest" };
      renderFromState(latestState);
    });
  }

  function loadAuthModule() {
    if (!authModulePromise) authModulePromise = import("/firebase.js?v=20260716-auth-v6");
    return authModulePromise;
  }

  function exposeApi() {
    window.SBUserState = {
      getUser: function () { return (latestState && latestState.user) || getStoredUser(); },
      refresh: function () {
        latestState = { ready: true, loading: false, user: getStoredUser(), source: getStoredUser() ? "legacy" : "guest" };
        renderFromState(latestState);
      },
      closeMenus: closeMenus,
      logout: logout,
    };
  }

  function getStoredUser() {
    try {
      var user = JSON.parse(localStorage.getItem("sb_user") || "null");
      if (!user || !user.userId || !user.sessionToken) return null;
      return user;
    } catch (e) { return null; }
  }

  function isLoggedIn(user) { return Boolean(user && user.userId && user.sessionToken); }

  function displayName(user) {
    return String(user && (user.displayName || user.username || user.email || user.login) || "Профиль").trim();
  }

  function money(user) {
    var value = Number(user && user.balance || 0) + Number(user && user.bonusBalance || 0);
    return value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "₽";
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function injectStyles() {
    if (document.getElementById("sb-auth-state-style")) return;
    var style = document.createElement("style");
    style.id = "sb-auth-state-style";
    style.textContent = "\
      .auth-slot-skeleton{display:inline-flex;align-items:center;min-width:156px;height:38px;vertical-align:middle}\
      .skeleton-pill{display:inline-block;width:156px;height:36px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,.08) 25%,rgba(255,255,255,.18) 37%,rgba(255,255,255,.08) 63%);background-size:400% 100%;animation:sbSk 1.35s ease infinite}\
      @keyframes sbSk{0%{background-position:100% 50%}100%{background-position:0 50%}}\
      .sb-user-menu{position:relative;display:inline-block;font-family:inherit}\
      .sb-user-trigger{display:inline-flex;align-items:center;gap:9px;max-width:260px;padding:6px 10px 6px 6px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);color:inherit;cursor:pointer;font:700 14px/1 inherit;text-decoration:none}\
      .sb-user-trigger:hover{background:rgba(255,255,255,.13)}\
      .sb-user-avatar{width:30px;height:30px;display:inline-grid;place-items:center;flex:0 0 auto;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;font-weight:900;font-size:12px}\
      .sb-user-avatar img{width:100%;height:100%;object-fit:cover}\
      .sb-user-meta{min-width:0;text-align:left;display:grid;gap:1px}\
      .sb-user-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:145px}\
      .sb-user-balance{font-size:11px;color:#a7f3d0;font-weight:800}\
      .sb-user-caret{opacity:.7}\
      .sb-user-dropdown{position:absolute;top:calc(100% + 9px);right:0;width:268px;padding:8px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(15,23,42,.97);box-shadow:0 22px 60px rgba(0,0,0,.34);z-index:10000;color:#f8fafc}\
      .sb-user-dropdown[hidden]{display:none!important}\
      .sb-user-head{padding:10px 11px 12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:6px}\
      .sb-user-head strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
      .sb-user-head span{display:block;margin-top:3px;color:#94a3b8;font-size:12px;word-break:break-all}\
      .sb-user-item{display:flex;align-items:center;gap:9px;width:100%;box-sizing:border-box;padding:10px 11px;border:0;border-radius:11px;background:transparent;color:#e2e8f0;text-decoration:none;text-align:left;cursor:pointer;font:700 14px/1 inherit}\
      .sb-user-item:hover{background:rgba(255,255,255,.08)}\
      .sb-user-item.danger{color:#fecaca;border-top:1px solid rgba(255,255,255,.08);border-radius:0 0 11px 11px;margin-top:5px}\
      .nav-register-link{display:inline-flex;align-items:center}\
      @media(max-width:520px){.sb-user-name{max-width:92px}.sb-user-dropdown{right:-10px;width:246px}.sb-user-trigger{max-width:170px}}\
      @media(prefers-reduced-motion:reduce){.skeleton-pill{animation:none}}";
    document.head.appendChild(style);
  }

  function markAuthBooting() {
    try { document.documentElement.classList.add("sb-auth-booting"); } catch (e) {}
  }

  function markAuthReady() {
    try {
      document.documentElement.classList.remove("sb-auth-booting");
      document.documentElement.classList.add("sb-auth-ready");
    } catch (e) {}
  }

  function renderLoading() {
    document.querySelectorAll(".main-nav-links").forEach(function (nav) {
      removeAuthControls(nav);
      var btn = ensureMenuButton(nav);
      var sk = document.createElement("span");
      sk.className = "auth-slot-skeleton";
      sk.setAttribute("data-auth-splash", "1");
      sk.setAttribute("aria-busy", "true");
      sk.innerHTML = '<span class="skeleton-pill"></span>';
      if (btn) nav.insertBefore(sk, btn); else nav.appendChild(sk);
    });
  }

  function renderFromState(state) {
    bindMenuOnce();
    if (!state || !state.ready || state.loading) { renderLoading(); return; }
    markAuthReady();
    var user = isLoggedIn(state.user) ? state.user : null;
    renderTopNav(user);
    renderDropMenu(user);
    renderHeroButtons(user);
  }

  function removeAuthControls(nav) {
    Array.from(nav.querySelectorAll('[data-top-auth-link], [data-auth-splash], .sb-user-menu, a[href="auth.html"], a[href="/auth.html"], .nav-register-link, .nav-user-badge')).forEach(function (node) { node.remove(); });
  }

  function normalizeMenuButton(btn) {
    if (!btn) return;
    btn.type = "button";
    btn.classList.add("menu-toggle");
    btn.setAttribute("aria-label", "Открыть меню");
    if (!btn.hasAttribute("aria-expanded")) btn.setAttribute("aria-expanded", "false");
    if (btn.querySelectorAll("span").length !== 3) btn.innerHTML = "<span></span><span></span><span></span>";
  }

  function ensureMenuButton(nav) {
    if (!nav) return null;
    var btn = nav.querySelector(".menu-toggle");
    if (!btn) { btn = document.createElement("button"); btn.className = "menu-toggle"; nav.appendChild(btn); }
    normalizeMenuButton(btn);
    return btn;
  }

  function renderTopNav(user) {
    document.querySelectorAll(".main-nav-links").forEach(function (nav) {
      removeAuthControls(nav);
      var btn = ensureMenuButton(nav);
      var node = user ? buildUserMenu(user) : buildGuestLink();
      if (btn) nav.insertBefore(node, btn); else nav.appendChild(node);
    });
  }

  function buildGuestLink() {
    var a = document.createElement("a");
    a.href = "auth.html";
    a.className = "nav-register-link";
    a.setAttribute("data-top-auth-link", "1");
    a.textContent = "Зарегистрироваться";
    return a;
  }

  function buildUserMenu(user) {
    var name = displayName(user);
    var email = user.email || "";
    var avatar = user.photoURL ? '<img src="' + escapeHtml(user.photoURL) + '" alt="" referrerpolicy="no-referrer">' : escapeHtml((name[0] || "U").toUpperCase());
    var wrap = document.createElement("div");
    wrap.className = "sb-user-menu";
    wrap.setAttribute("data-top-auth-link", "1");
    wrap.innerHTML = '' +
      '<button class="sb-user-trigger" type="button" aria-haspopup="menu" aria-expanded="false">' +
        '<span class="sb-user-avatar">' + avatar + '</span>' +
        '<span class="sb-user-meta"><span class="sb-user-name">' + escapeHtml(name) + '</span><span class="sb-user-balance">' + escapeHtml(money(user)) + '</span></span>' +
        '<span class="sb-user-caret" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="sb-user-dropdown" role="menu" hidden>' +
        '<div class="sb-user-head"><strong>' + escapeHtml(name) + '</strong>' + (email ? '<span>' + escapeHtml(email) + '</span>' : '') + '</div>' +
        '<a class="sb-user-item" href="wallet.html" role="menuitem">👤 Личный кабинет</a>' +
        '<a class="sb-user-item" href="wallet.html" role="menuitem">💰 Баланс</a>' +
        '<a class="sb-user-item" href="orders.html" role="menuitem">📦 Мои заказы</a>' +
        '<a class="sb-user-item" href="referral.html" role="menuitem">🤝 Реферальная программа</a>' +
        '<a class="sb-user-item" href="auth.html?tab=settings" role="menuitem">⚙️ Настройки</a>' +
        '<button class="sb-user-item danger" type="button" data-sb-logout role="menuitem">↩ Выйти</button>' +
      '</div>';
    return wrap;
  }

  function renderDropMenu(user) {
    document.querySelectorAll(".nav-menu").forEach(function (menu) {
      Array.from(menu.querySelectorAll('a[href="auth.html"], a[href="/auth.html"], .sb-menu-auth-link, .sb-menu-logout-link')).forEach(function (node) { node.remove(); });
      ensureMenuLink(menu, "services.html", "🚀", "Заказать услуги");
      ensureMenuLink(menu, "wallet.html", "💰", "Баланс");
      ensureMenuLink(menu, "orders.html", "📦", "Мои заказы");
      ensureMenuLink(menu, "referral.html", "🤝", "Реферальная программа");
      if (user) {
        var profile = document.createElement("a");
        profile.href = "wallet.html";
        profile.className = "sb-menu-auth-link";
        profile.innerHTML = '<span class="menu-emoji">👤</span><span>' + escapeHtml(displayName(user)) + '</span>';
        menu.insertBefore(profile, menu.firstChild);
        var logoutBtn = document.createElement("button");
        logoutBtn.type = "button";
        logoutBtn.className = "sb-menu-logout-link";
        logoutBtn.setAttribute("data-sb-logout", "1");
        logoutBtn.innerHTML = '<span class="menu-emoji">↩</span><span>Выйти</span>';
        menu.appendChild(logoutBtn);
      } else {
        var login = document.createElement("a");
        login.href = "auth.html";
        login.className = "sb-menu-auth-link";
        login.innerHTML = '<span class="menu-emoji">🎁</span><span>Регистрация / вход</span>';
        menu.insertBefore(login, menu.firstChild);
      }
    });
  }

  function ensureMenuLink(menu, href, emoji, text) {
    if (menu.querySelector('a[href="' + href + '"]')) return;
    var a = document.createElement("a");
    a.href = href;
    a.innerHTML = '<span class="menu-emoji">' + emoji + '</span><span>' + text + '</span>';
    menu.appendChild(a);
  }

  function renderHeroButtons(user) {
    document.querySelectorAll('a[href="auth.html"].hero-register-button, a[href="/auth.html"].hero-register-button').forEach(function (link) {
      if (user) { link.href = "wallet.html"; link.textContent = "👤 " + displayName(user); }
      else { link.href = "auth.html"; link.textContent = "🎁 Зарегистрироваться"; }
    });
  }

  function bindMenuOnce() {
    if (document.documentElement.dataset.sbMenuDelegated === "1") return;
    document.documentElement.dataset.sbMenuDelegated = "1";

    document.addEventListener("click", function (e) {
      var userTrigger = e.target.closest && e.target.closest(".sb-user-trigger");
      if (userTrigger) {
        e.preventDefault();
        e.stopPropagation();
        var wrap = userTrigger.closest(".sb-user-menu");
        var dropdown = wrap && wrap.querySelector(".sb-user-dropdown");
        var opened = dropdown && dropdown.hidden;
        closeUserMenus();
        if (dropdown && opened) { dropdown.hidden = false; userTrigger.setAttribute("aria-expanded", "true"); }
        return;
      }

      var logoutBtn = e.target.closest && e.target.closest("[data-sb-logout]");
      if (logoutBtn) {
        e.preventDefault();
        logout(logoutBtn);
        return;
      }

      var menuBtn = e.target.closest && e.target.closest(".menu-toggle");
      if (menuBtn) {
        e.preventDefault();
        e.stopPropagation();
        normalizeMenuButton(menuBtn);
        var navbar = menuBtn.closest(".navbar") || document;
        var menu = navbar.querySelector(".nav-menu") || document.querySelector(".nav-menu");
        if (!menu) return;
        var willOpen = !menu.classList.contains("open");
        closeMenus();
        if (willOpen) { menu.classList.add("open"); menuBtn.setAttribute("aria-expanded", "true"); }
        return;
      }

      if (e.target.closest && e.target.closest(".nav-menu")) {
        if (e.target.closest("a")) closeMenus();
        return;
      }

      closeUserMenus();
      closeMenus();
    }, true);

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeUserMenus(); closeMenus(); }
    });
  }

  function closeUserMenus() {
    document.querySelectorAll(".sb-user-dropdown").forEach(function (drop) { drop.hidden = true; });
    document.querySelectorAll('.sb-user-trigger[aria-expanded="true"]').forEach(function (btn) { btn.setAttribute("aria-expanded", "false"); });
  }

  function closeMenus() {
    document.querySelectorAll(".nav-menu.open").forEach(function (menu) { menu.classList.remove("open"); });
    document.querySelectorAll('.menu-toggle[aria-expanded="true"]').forEach(function (btn) { btn.setAttribute("aria-expanded", "false"); });
  }

  async function logout(button) {
    if (button) { button.disabled = true; button.dataset.oldText = button.textContent; button.textContent = "Выходим..."; }
    try {
      var mod = await loadAuthModule();
      await mod.signOutEverywhere();
    } catch (_) {
      try { localStorage.removeItem("sb_user"); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
    } finally {
      latestState = { ready: true, loading: false, user: null, source: "guest" };
      renderFromState(latestState);
      if (button) { button.disabled = false; button.textContent = button.dataset.oldText || "Выйти"; }
    }
  }
})();
