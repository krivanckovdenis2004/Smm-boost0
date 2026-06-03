(function () {
  function getUser() {
    try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch (e) { return null; }
  }

  function isLoggedIn(user) {
    return Boolean(user && user.userId && user.sessionToken);
  }

  function userTitle(user) {
    return user.displayName || user.username || 'Профиль';
  }

  function compactTopNav(loggedIn, user) {
    var nav = document.querySelector('.main-nav-links');
    if (!nav) return;

    Array.from(nav.querySelectorAll('a')).forEach(function (link) {
      link.remove();
    });

    var authLink = document.createElement('a');
    authLink.setAttribute('data-top-auth-link', '1');
    authLink.href = loggedIn ? 'wallet.html' : 'auth.html';
    authLink.className = loggedIn ? 'nav-user-badge' : 'nav-register-link';
    authLink.textContent = loggedIn ? ('👤 ' + userTitle(user)) : 'Зарегистрироваться';

    var menuBtn = nav.querySelector('.menu-toggle');
    if (menuBtn) nav.insertBefore(authLink, menuBtn);
    else nav.appendChild(authLink);
  }

  function updateMenuAuth(loggedIn, user) {
    var menu = document.querySelector('.nav-menu');
    if (!menu) return;

    var hasOrders = Array.from(menu.querySelectorAll('a')).some(function (a) { return a.getAttribute('href') === 'orders.html'; });
    if (!hasOrders) {
      var wallet = menu.querySelector('a[href="wallet.html"]');
      var orders = document.createElement('a');
      orders.href = 'orders.html';
      orders.innerHTML = '<span class="menu-emoji">📦</span><span>Мои заказы</span>';
      if (wallet && wallet.nextSibling) menu.insertBefore(orders, wallet.nextSibling);
      else menu.insertBefore(orders, menu.firstChild);
    }

    var authLinks = menu.querySelectorAll('a[href="auth.html"], a[href="/auth.html"], .sb-menu-auth-link');
    if (!authLinks.length) {
      var link = document.createElement('a');
      link.className = 'sb-menu-auth-link';
      menu.insertBefore(link, menu.firstChild);
      authLinks = [link];
    }

    authLinks.forEach(function (link) {
      link.classList.add('sb-menu-auth-link');
      if (loggedIn) {
        link.href = 'wallet.html';
        link.innerHTML = '<span class="menu-emoji">👤</span><span>' + userTitle(user) + '</span>';
      } else {
        link.href = 'auth.html';
        link.innerHTML = '<span class="menu-emoji">🎁</span><span>Зарегистрироваться / войти</span>';
      }
    });
  }

  function updateHeroButtons(loggedIn, user) {
    document.querySelectorAll('a[href="auth.html"].hero-register-button, a[href="/auth.html"].hero-register-button').forEach(function (link) {
      if (loggedIn) {
        link.href = 'wallet.html';
        link.textContent = '👤 ' + userTitle(user);
      } else {
        link.textContent = '🎁 Зарегистрироваться';
      }
    });
  }



  function normalizeMenuButton() {
    document.querySelectorAll('.menu-toggle').forEach(function(btn){
      if (btn.querySelectorAll('span').length < 3) {
        btn.textContent = '';
        btn.innerHTML = '<span></span><span></span><span></span>';
      }
      btn.setAttribute('aria-label', 'Открыть меню');
      if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function bindMenu() {
    normalizeMenuButton();
    var btn = document.querySelector('.menu-toggle');
    var menu = document.querySelector('.nav-menu');
    if (!btn || !menu || btn.dataset.sbMenuBound === '1') return;
    btn.dataset.sbMenuBound = '1';
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var opened = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', opened ? 'true' : 'false');
    });
    document.addEventListener('click', function(e){
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    menu.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', function(){
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function updateAuthLinks() {
    bindMenu();
    var user = getUser();
    if (user && user.userId && !user.sessionToken) {
      localStorage.removeItem('sb_user');
      user = null;
    }
    var loggedIn = isLoggedIn(user);
    compactTopNav(loggedIn, user || {});
    updateMenuAuth(loggedIn, user || {});
    updateHeroButtons(loggedIn, user || {});
  }

  window.SBUserState = { getUser: getUser, refresh: updateAuthLinks };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAuthLinks);
  } else {
    updateAuthLinks();
  }
})();
