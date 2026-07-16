// auth.js — оркестратор новых экранов авторизации.
// Основной путь — Firebase (email + Google). Легаси-логин работает как раньше через /api/auth-social-register.

import {
  loadFirebase,
  registerWithEmail,
  loginWithEmail,
  resendVerification,
  sendResetEmail,
  signOutAll,
  signInWithGoogle,
  checkGoogleRedirectResult,
  applyVerification,
  humanError,
  persistSession
} from './firebase-auth.js';

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const cards = { main: $('#mainCard'), verify: $('#verifyCard'), forgot: $('#forgotCard') };
const toastEl = $('#authToast');
let toastTimer = null;

function showCard(name){
  Object.entries(cards).forEach(([k, el]) => el?.classList.toggle('hidden', k !== name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toast(text, isErr){
  if(!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.toggle('err', !!isErr);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toastEl.classList.remove('show'), 3200);
}
function setBusy(btn, busy, label){
  if(!btn) return;
  if(busy){
    btn.dataset.orig = btn.dataset.orig || btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>' + (label || 'Пожалуйста, подождите…');
  } else {
    btn.disabled = false;
    if(btn.dataset.orig){ btn.innerHTML = btn.dataset.orig; delete btn.dataset.orig; }
  }
}
function inlineMsg(text, type){
  const box = $('#authMessage');
  if(!box) return;
  box.textContent = text || '';
  box.className = 'auth-message ' + (type || '');
}
function goApp(){
  const to = new URLSearchParams(location.search).get('next') || 'services.html';
  location.href = to;
}

// ---------- URL flow: verifyEmail / resetPassword ----------
async function handleActionCode(){
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  if(!mode || !oobCode) return false;

  if(mode === 'verifyEmail'){
    try{
      const { autoSignedIn } = await applyVerification(oobCode);
      history.replaceState({}, '', 'auth.html?verified=1');
      if(autoSignedIn){
        toast('Email подтверждён. Вы вошли в аккаунт.');
        setTimeout(goApp, 700);
      } else {
        toast('Email подтверждён. Войдите в аккаунт.');
        inlineMsg('Email успешно подтверждён. Войдите с вашим email и паролем.', 'ok');
        activateTab('login');
      }
    } catch(e){
      toast(humanError(e), true);
    }
    return true;
  }

  if(mode === 'resetPassword'){
    // Ссылка на отдельную страницу для смены пароля.
    location.replace('reset-password.html' + location.search);
    return true;
  }
  return false;
}

// ---------- Tabs ----------
function activateTab(name){
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.authTab === name));
  document.querySelectorAll('[data-auth-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.authPanel !== name));
  inlineMsg('');
}
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.authTab));
});

// ---------- Verify screen state ----------
let pendingEmail = '';
function showVerifyScreen(email){
  pendingEmail = email || '';
  $('#verifyEmailText').textContent = pendingEmail || 'вашу почту';
  showCard('verify');
}

$('#resendBtn')?.addEventListener('click', async (ev) => {
  const btn = ev.currentTarget;
  setBusy(btn, true, 'Отправляем…');
  try{
    await resendVerification();
    toast('Письмо отправлено повторно.');
  }catch(e){
    toast(humanError(e), true);
  }finally{
    setBusy(btn, false);
  }
});

$('#changeEmailBtn')?.addEventListener('click', async () => {
  await signOutAll();
  activateTab('register');
  showCard('main');
  toast('Введите другой email для регистрации.');
});

$('#switchAccountBtn')?.addEventListener('click', async () => {
  await signOutAll();
  activateTab('login');
  showCard('main');
});

// ---------- Register / Login (email) ----------
$('#registerForm')?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  inlineMsg('');
  const btn = ev.target.querySelector('button[type="submit"]');
  const email = $('#registerEmail').value.trim();
  const password = $('#registerPassword').value;
  const displayName = $('#registerName').value.trim();
  if(!email || password.length < 6){
    inlineMsg('Заполните email и пароль (мин. 6 символов).', 'err');
    return;
  }
  setBusy(btn, true, 'Создаём аккаунт…');
  try{
    const ref = new URLSearchParams(location.search).get('ref') || '';
    await registerWithEmail({ email, password, displayName, referredBy: ref });
    window.ymGoal?.('signup_complete');
    showVerifyScreen(email);
    toast('Аккаунт создан. Проверьте почту.');
  }catch(e){
    inlineMsg(humanError(e), 'err');
    toast(humanError(e), true);
  }finally{
    setBusy(btn, false);
  }
});

$('#loginForm')?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  inlineMsg('');
  const btn = ev.target.querySelector('button[type="submit"]');
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  if(!email || !password){ inlineMsg('Введите email и пароль.', 'err'); return; }
  setBusy(btn, true, 'Входим…');
  try{
    const { needsVerification } = await loginWithEmail({ email, password });
    if(needsVerification){
      showVerifyScreen(email);
      toast('Подтвердите email, чтобы войти.', true);
      return;
    }
    window.ymGoal?.('login_success');
    toast('Готово! Входим…');
    setTimeout(goApp, 400);
  }catch(e){
    inlineMsg(humanError(e), 'err');
    toast(humanError(e), true);
  }finally{
    setBusy(btn, false);
  }
});

// ---------- Google ----------
$('#googleBtn')?.addEventListener('click', async (ev) => {
  const btn = ev.currentTarget;
  setBusy(btn, true, 'Открываем Google…');
  try{
    const res = await signInWithGoogle({ referredBy: (localStorage.getItem('sb_ref') || '') });
    if(res?.redirect) return; // страница перезагрузится, результат обработаем ниже
    window.ymGoal?.('login_success');
    toast('Готово! Входим…');
    setTimeout(goApp, 400);
  }catch(e){
    toast(humanError(e), true);
  }finally{
    setBusy(btn, false);
  }
});

// ---------- Forgot password ----------
$('#forgotBtn')?.addEventListener('click', () => {
  $('#forgotEmail').value = $('#loginEmail').value || '';
  showCard('forgot');
});
$('#backFromForgot')?.addEventListener('click', () => showCard('main'));

$('#forgotForm')?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = ev.target.querySelector('button[type="submit"]');
  const email = $('#forgotEmail').value.trim();
  if(!email){ toast('Введите email', true); return; }
  setBusy(btn, true, 'Отправляем…');
  try{
    await sendResetEmail(email);
    toast('Письмо с инструкцией отправлено.');
    setTimeout(()=>showCard('main'), 600);
  }catch(e){
    toast(humanError(e), true);
  }finally{
    setBusy(btn, false);
  }
});

// ---------- Legacy login (совместимость со старыми пользователями) ----------
$('#legacyToggle')?.addEventListener('click', () => {
  $('#legacyPanel').classList.toggle('show');
});
$('#legacyLoginForm')?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = ev.target.querySelector('button[type="submit"]');
  const username = $('#legacyLogin').value.trim();
  const password = $('#legacyPassword').value;
  setBusy(btn, true, 'Входим…');
  try{
    const resp = await fetch('/api/auth-social-register', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'login', username, password })
    });
    const data = await resp.json();
    if(!resp.ok || !data.ok) throw new Error(data.error || 'Ошибка входа');
    const user = data.user || {};
    localStorage.setItem('sb_user', JSON.stringify({
      ...user,
      authType: user.authType || 'password',
      loggedAt: new Date().toISOString()
    }));
    window.SBUserState?.refresh?.();
    toast('Готово! Входим…');
    setTimeout(goApp, 400);
  }catch(e){
    toast(e.message || 'Ошибка входа', true);
  }finally{
    setBusy(btn, false);
  }
});

// ---------- Bootstrap ----------
(async function init(){
  try{
    // Показ сообщения после подтверждения через ссылку
    if(new URLSearchParams(location.search).get('verified') === '1'){
      inlineMsg('Email подтверждён. Войдите в аккаунт.', 'ok');
      activateTab('login');
    }
    const handled = await handleActionCode();
    if(handled) return;
    await loadFirebase();
    // Проверяем результат Google redirect (если был использован fallback)
    try{
      const res = await checkGoogleRedirectResult();
      if(res?.user){
        toast('Готово! Входим…');
        setTimeout(goApp, 400);
      }
    }catch(e){ console.warn('[auth] redirect result', e); }
  }catch(e){
    console.error('[auth] init failed', e);
    toast('Не удалось загрузить систему авторизации.', true);
  }
})();
