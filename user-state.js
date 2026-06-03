(function () {
  'use strict';

  function getUser() {
    try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch (e) { return null; }
  }

  function isLoggedIn(user) {
    return Boolean(user && user.userId && user.sessionToken);
  }

  function userTitle(user) {
    return String(user?.displayName || user?.username || user?.login || 'Профиль').trim();
  }

  function normalizeMenuButton(btn) {
    if (!btn) return;
    btn.type = 'button';
    btn.classList.add('menu-toggle');
    btn.setAttribute('aria-label', 'Открыть меню');
    if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
    if (btn.querySelectorAll('span').length !== 3) {
      btn.textContent = '';
      btn.innerHTML = '<span></span><span></span><span></span>';
    }
  }

  function ensureMenuButton(navLinks) {
    if (!navLinks) return null;
    let btn = navLinks.querySelector('.menu-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'menu-toggle';
      navLinks.appendChild(btn);
    }
    normalizeMenuButton(btn);
    return btn;
  }

  function compactTopNav(loggedIn, user) {
    const nav = document.querySelector('.main-nav-links');
    if (!nav) return;

    const btn = ensureMenuButton(nav);

    Array.from(nav.querySelectorAll('a')).forEach((link) => link.remove());

    const authLink = document.createElement('a');
    authLink.setAttribute('data-top-auth-link', '1');
    authLink.href = loggedIn ? 'wallet.html' : 'auth.html';
    authLink.className = loggedIn ? 'nav-user-badge' : 'nav-register-link';
    authLink.textContent = loggedIn ? ('👤 ' + userTitle(user)) : 'Зарегистрироваться';

    if (btn) nav.insertBefore(authLink, btn);
    else nav.appendChild(authLink);
  }

  function updateMenuAuth(loggedIn, user) {
    const menu = document.querySelector('.nav-menu');
    if (!menu) return;

    if (!Array.from(menu.querySelectorAll('a')).some((a) => a.getAttribute('href') === 'orders.html')) {
      const wallet = menu.querySelector('a[href="wallet.html"]');
      const orders = document.createElement('a');
      orders.href = 'orders.html';
      orders.innerHTML = '<span class="menu-emoji">📦</span><span>Мои заказы</span>';
      if (wallet && wallet.nextSibling) menu.insertBefore(orders, wallet.nextSibling);
      else menu.insertBefore(orders, menu.firstChild);
    }

    let authLink = menu.querySelector('.sb-menu-auth-link');
    if (!authLink) {
      authLink = document.createElement('a');
      authLink.className = 'sb-menu-auth-link';
      const orders = menu.querySelector('a[href="orders.html"]');
      if (orders && orders.nextSibling) menu.insertBefore(authLink, orders.nextSibling);
      else menu.insertBefore(authLink, menu.firstChild);
    }

    // Удаляем дубли старой ссылки авторизации, чтобы меню было аккуратным.
    Array.from(menu.querySelectorAll('a[href="auth.html"], a[href="/auth.html"]')).forEach((link) => {
      if (link !== authLink) link.remove();
    });

    if (loggedIn) {
      authLink.href = 'wallet.html';
      authLink.innerHTML = '<span class="menu-emoji">👤</span><span>' + escapeHtml(userTitle(user)) + '</span>';
    } else {
      authLink.href = 'auth.html';
      authLink.innerHTML = '<span class="menu-emoji">🎁</span><span>Регистрация / вход</span>';
    }
  }

  function updateHeroButtons(loggedIn, user) {
    document.querySelectorAll('a[href="auth.html"].hero-register-button, a[href="/auth.html"].hero-register-button').forEach((link) => {
      if (loggedIn) {
        link.href = 'wallet.html';
        link.textContent = '👤 ' + userTitle(user);
      } else {
        link.href = 'auth.html';
        link.textContent = '🎁 Зарегистрироваться';
      }
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function closeMenus() {
    document.querySelectorAll('.nav-menu.open').forEach((menu) => menu.classList.remove('open'));
    document.querySelectorAll('.menu-toggle[aria-expanded="true"]').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
  }

  function bindMenuOnce() {
    if (document.documentElement.dataset.sbMenuDelegated === '1') return;
    document.documentElement.dataset.sbMenuDelegated = '1';

    document.addEventListener('click', function (e) {
      const btn = e.target.closest && e.target.closest('.menu-toggle');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        normalizeMenuButton(btn);
        const navbar = btn.closest('.navbar') || document;
        const menu = navbar.querySelector('.nav-menu') || document.querySelector('.nav-menu');
        if (!menu) return;

        const willOpen = !menu.classList.contains('open');
        closeMenus();
        if (willOpen) {
          menu.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      if (e.target.closest && e.target.closest('.nav-menu')) {
        if (e.target.closest('a')) closeMenus();
        return;
      }

      closeMenus();
    }, true);

    window.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeMenus();
    });
  }

  function updateAuthLinks() {
    bindMenuOnce();
    document.querySelectorAll('.menu-toggle').forEach(normalizeMenuButton);

    let user = getUser();
    if (user && user.userId && !user.sessionToken) {
      localStorage.removeItem('sb_user');
      user = null;
    }
    const loggedIn = isLoggedIn(user);

    compactTopNav(loggedIn, user || {});
    updateMenuAuth(loggedIn, user || {});
    updateHeroButtons(loggedIn, user || {});
    document.querySelectorAll('.menu-toggle').forEach(normalizeMenuButton);
  }

  window.SBUserState = { getUser, refresh: updateAuthLinks, closeMenus };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAuthLinks);
  } else {
    updateAuthLinks();
  }
})();
