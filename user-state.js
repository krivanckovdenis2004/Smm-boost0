(function () {
  function getUser() {
    try { return JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch (e) { return null; }
  }

  function isLoggedIn(user) {
    return Boolean(user && user.userId && user.sessionToken);
  }

  function userTitle(user) {
    return user.displayName || user.socialLogin || user.username || 'Профиль';
  }

  function updateAuthLinks() {
    var user = getUser();
    var loggedIn = isLoggedIn(user);
    var authLinks = document.querySelectorAll('a[href="auth.html"], a[href="/auth.html"]');

    authLinks.forEach(function (link) {
      var text = (link.textContent || '').toLowerCase();
      var isAuthButton = text.indexOf('зарегистр') !== -1 || text.indexOf('вход') !== -1 || link.classList.contains('hero-register-button');
      if (!isAuthButton) return;

      if (loggedIn) {
        link.href = 'wallet.html';
        link.classList.add('sb-logged-link');
        if (link.classList.contains('hero-register-button')) {
          link.textContent = '💰 Мой баланс';
        } else {
          var span = link.querySelector('span:last-child');
          if (span) span.textContent = 'Профиль / баланс';
          else link.textContent = 'Профиль / баланс';
        }
      } else {
        link.classList.remove('sb-logged-link');
      }
    });

    var nav = document.querySelector('.main-nav-links');
    if (nav && loggedIn && !nav.querySelector('[data-user-state-badge]')) {
      var badge = document.createElement('a');
      badge.href = 'wallet.html';
      badge.setAttribute('data-user-state-badge', '1');
      badge.className = 'nav-user-badge';
      badge.textContent = '👤 ' + userTitle(user);
      nav.insertBefore(badge, nav.querySelector('.menu-toggle'));
    }
  }

  window.SBUserState = { getUser: getUser, refresh: updateAuthLinks };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAuthLinks);
  } else {
    updateAuthLinks();
  }
})();
