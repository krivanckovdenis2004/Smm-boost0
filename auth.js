// auth.js — UI controller. Бизнес-логика в firebase-auth.js не меняется.
import {
  fbSignUp, fbSignIn, fbGoogle, fbSendReset, fbResendVerification,
  fbSignOut, fbOnAuth, fbCurrentUser
} from '/firebase-auth.js';

/* ===== helpers ===== */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const qs = new URLSearchParams(location.search);

const toastBox = $('#toasts');
function toast(msg, type='info', ttl=3800){
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  toastBox.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-8px)'; t.style.transition='.25s'; setTimeout(()=>t.remove(),260); }, ttl);
}

function setBusy(btn, busy){
  if(!btn) return;
  btn.disabled = !!busy;
  const label = btn.dataset._label || btn.innerHTML;
  if(busy){
    btn.dataset._label = label;
    btn.innerHTML = '<span class="spinner"></span>';
  } else if(btn.dataset._label){
    btn.innerHTML = btn.dataset._label;
    delete btn.dataset._label;
  }
}

function fieldError(id, msg){
  const input = $('#'+id);
  const wrap  = input?.closest('.input-wrap');
  const hint  = $(`.hint[data-hint="${id}"]`);
  if(wrap) wrap.classList.toggle('error', !!msg);
  if(hint) hint.textContent = msg || '';
}
function clearErrors(form){ $$('.hint',form).forEach(h=>h.textContent=''); $$('.input-wrap.error',form).forEach(w=>w.classList.remove('error')); }

const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v||'').trim());

/* ===== views ===== */
const views = {
  tabs:      $('#view-tabs'),
  verify:    $('#view-verify'),
  verified:  $('#view-verified'),
  resetSent: $('#view-reset-sent'),
  resetDone: $('#view-reset-done'),
};
function show(name){
  $('#skeleton').classList.add('hidden');
  Object.values(views).forEach(v=>v.classList.add('hidden'));
  views[name]?.classList.remove('hidden');
}

const panes = { login: $('#form-login'), signup: $('#form-signup'), reset: $('#form-reset') };
const titles = {
  login:  ['С возвращением','Войдите в аккаунт, чтобы продолжить.'],
  signup: ['Создайте аккаунт','Займёт меньше минуты. Бонус за регистрацию.'],
  reset:  ['Восстановление','Пришлём ссылку для сброса пароля на почту.'],
};
function selectTab(name){
  $$('.tab').forEach(b=>b.setAttribute('aria-selected', b.dataset.tab===name ? 'true' : 'false'));
  Object.entries(panes).forEach(([k,el])=>el.classList.toggle('hidden', k!==name));
  const [t,s] = titles[name]; $('#tabTitle').textContent = t; $('#tabSub').textContent = s;
  show('tabs');
}

/* ===== password toggle ===== */
document.addEventListener('click', e=>{
  const btn = e.target.closest('[data-toggle]');
  if(!btn) return;
  const inp = document.getElementById(btn.dataset.toggle);
  if(!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Скрыть' : 'Показать';
});

/* ===== tab switching / navigation ===== */
document.addEventListener('click', e=>{
  const tab = e.target.closest('.tab'); if(tab) return selectTab(tab.dataset.tab);
  const go  = e.target.closest('[data-goto]'); if(go) return selectTab(go.dataset.goto);
});

/* ===== live validation ===== */
function bindLive(id, validator){
  const inp = $('#'+id); if(!inp) return;
  inp.addEventListener('blur', ()=>{
    if(!inp.value) return fieldError(id,'');
    const err = validator(inp.value.trim()); fieldError(id, err||'');
  });
  inp.addEventListener('input', ()=>{ if($(`.hint[data-hint="${id}"]`)?.textContent) fieldError(id,''); });
}
bindLive('loginEmail', v=> isEmail(v) ? '' : 'Введите корректный email');
bindLive('suEmail',    v=> isEmail(v) ? '' : 'Введите корректный email');
bindLive('rsEmail',    v=> isEmail(v) ? '' : 'Введите корректный email');
bindLive('suPass',     v=> v.length>=8 ? '' : 'Минимум 8 символов');
bindLive('suPass2',    v=> v === $('#suPass').value ? '' : 'Пароли не совпадают');

/* ===== resend throttle ===== */
function throttle(btn, sec=60){
  let left = sec;
  const base = btn.dataset._base || btn.textContent;
  btn.dataset._base = base;
  btn.disabled = true;
  const tick = ()=>{
    btn.textContent = `Отправить ещё раз (${left}с)`;
    if(left<=0){ btn.textContent = base; btn.disabled = false; clearInterval(iv); return; }
    left--;
  };
  tick(); const iv = setInterval(tick,1000);
}

/* ===== Firebase error mapper ===== */
function mapError(e){
  const code = e?.code || '';
  const map = {
    'auth/invalid-email':'Неверный формат email',
    'auth/user-not-found':'Пользователь не найден',
    'auth/wrong-password':'Неверный пароль',
    'auth/invalid-credential':'Неверный email или пароль',
    'auth/email-already-in-use':'Этот email уже зарегистрирован',
    'auth/weak-password':'Слишком слабый пароль',
    'auth/too-many-requests':'Слишком много попыток. Попробуйте позже',
    'auth/popup-closed-by-user':'Окно Google закрыто',
    'auth/network-request-failed':'Проблемы с сетью',
  };
  return map[code] || e?.message || 'Что-то пошло не так';
}

/* ===== email provider link ===== */
function mailUrlFor(email){
  const d = (email.split('@')[1]||'').toLowerCase();
  if(/gmail|googlemail/.test(d)) return 'https://mail.google.com';
  if(/yandex|ya\.ru/.test(d))    return 'https://mail.yandex.ru';
  if(/mail\.ru|inbox|bk|list/.test(d)) return 'https://e.mail.ru';
  if(/outlook|hotmail|live|msn/.test(d)) return 'https://outlook.live.com';
  if(/icloud|me\.com/.test(d))   return 'https://www.icloud.com/mail';
  if(/proton/.test(d))           return 'https://mail.proton.me';
  return `https://${d}`;
}

/* ===== FORMS ===== */

// LOGIN
$('#form-login').addEventListener('submit', async e=>{
  e.preventDefault(); clearErrors(e.target);
  const email = $('#loginEmail').value.trim();
  const pass  = $('#loginPass').value;
  let bad=false;
  if(!isEmail(email)){ fieldError('loginEmail','Введите корректный email'); bad=true; }
  if(!pass){ fieldError('loginPass','Введите пароль'); bad=true; }
  if(bad) return;

  const btn = $('#loginSubmit'); setBusy(btn,true);
  try{
    const u = await fbSignIn(email, pass);
    if(u && !u.emailVerified){
      showVerify(email);
      toast('Подтвердите email, чтобы войти', 'info');
      return;
    }
    toast('Добро пожаловать!','success');
    setTimeout(()=>location.href='/dashboard.html', 500);
  }catch(err){ toast(mapError(err),'error'); }
  finally{ setBusy(btn,false); }
});

// SIGNUP
$('#form-signup').addEventListener('submit', async e=>{
  e.preventDefault(); clearErrors(e.target);
  const email = $('#suEmail').value.trim();
  const p1 = $('#suPass').value, p2 = $('#suPass2').value;
  let bad=false;
  if(!isEmail(email)){ fieldError('suEmail','Введите корректный email'); bad=true; }
  if(p1.length<8){ fieldError('suPass','Минимум 8 символов'); bad=true; }
  if(p1!==p2){ fieldError('suPass2','Пароли не совпадают'); bad=true; }
  if(bad) return;

  const btn = $('#signupSubmit'); setBusy(btn,true);
  try{
    const refBy = qs.get('ref') || localStorage.getItem('referredBy') || null;
    await fbSignUp(email, p1, { referredBy: refBy });
    showVerify(email);
    toast('Письмо с подтверждением отправлено','success');
  }catch(err){ toast(mapError(err),'error'); }
  finally{ setBusy(btn,false); }
});

// RESET
$('#form-reset').addEventListener('submit', async e=>{
  e.preventDefault(); clearErrors(e.target);
  const email = $('#rsEmail').value.trim();
  if(!isEmail(email)){ fieldError('rsEmail','Введите корректный email'); return; }
  const btn = $('#resetSubmit'); setBusy(btn,true);
  try{
    await fbSendReset(email);
    $('#resetEmailShown').textContent = email;
    show('resetSent');
    toast('Ссылка отправлена','success');
  }catch(err){ toast(mapError(err),'error'); }
  finally{ setBusy(btn,false); }
});

// GOOGLE
document.addEventListener('click', async e=>{
  const btn = e.target.closest('[data-google]'); if(!btn) return;
  setBusy(btn,true);
  try{
    const refBy = qs.get('ref') || localStorage.getItem('referredBy') || null;
    await fbGoogle({ referredBy: refBy });
    toast('Добро пожаловать!','success');
    setTimeout(()=>location.href='/dashboard.html', 500);
  }catch(err){ toast(mapError(err),'error'); }
  finally{ setBusy(btn,false); }
});

/* ===== verify view ===== */
function showVerify(email){
  $('#verifyEmail').textContent = email;
  $('#openMail').href = mailUrlFor(email);
  show('verify');
}
$('#resendMail').addEventListener('click', async (e)=>{
  const btn = e.currentTarget;
  try{
    await fbResendVerification();
    toast('Письмо отправлено повторно','success');
    throttle(btn, 60);
  }catch(err){ toast(mapError(err),'error'); }
});
$('#changeEmail').addEventListener('click', async ()=>{
  try{ await fbSignOut(); }catch(_){}
  selectTab('signup');
});
document.querySelectorAll('[data-close-verify]').forEach(b=>b.addEventListener('click', async ()=>{
  try{ await fbSignOut(); }catch(_){}
}));
$('#resetResend').addEventListener('click', async (e)=>{
  const email = $('#resetEmailShown').textContent;
  if(!isEmail(email)) return;
  try{ await fbSendReset(email); toast('Отправлено ещё раз','success'); throttle(e.currentTarget, 60); }
  catch(err){ toast(mapError(err),'error'); }
});

/* ===== initial state ===== */
(async function init(){
  // deep-link states from reset-password.html
  if(qs.get('state')==='reset-done')   { show('resetDone'); return; }
  if(qs.get('state')==='verified')     { show('verified'); setTimeout(()=>location.href='/dashboard.html', 1800); return; }

  const initialTab = ['login','signup','reset'].includes(qs.get('tab')) ? qs.get('tab') : 'login';

  // skeleton пока Firebase инициализируется
  fbOnAuth(user=>{
    if(user && !user.emailVerified){
      showVerify(user.email || '');
      return;
    }
    if(user && user.emailVerified){
      // Уже вошёл — сразу в кабинет
      location.href = '/dashboard.html';
      return;
    }
    selectTab(initialTab);
  });

  // safety: если fbOnAuth не сработал за 1.2s — показать форму
  setTimeout(()=>{ if(!$('#skeleton').classList.contains('hidden')) selectTab(initialTab); }, 1200);
})();
