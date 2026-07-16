// user-menu.js — дроп-ин виджет пользователя для шапки сайта.
// Подключение:  <script type="module" src="/user-menu.js"></script>
// В шапке разместить контейнер:  <div id="userMenu"></div>
// (если контейнера нет — виджет создаст плавающий в правом верхнем углу).
import { subscribeAuth, signOutEverywhere, getStoredUser } from '/firebase.js?v=20260716-auth-v9';

const css = `
.um-wrap{position:relative;display:inline-block;font-family:'Inter',sans-serif}
.um-btn{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.14);color:#fff;padding:8px 12px;border-radius:999px;
  cursor:pointer;font:600 14px/1 'Inter',sans-serif;transition:.2s}
.um-btn:hover{background:rgba(255,255,255,.1)}
.um-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7c5cff,#22d3ee);
  display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0}
.um-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.um-name{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.um-drop{position:absolute;top:calc(100% + 8px);right:0;min-width:240px;
  background:rgba(20,25,40,.96);backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px;
  box-shadow:0 20px 60px rgba(0,0,0,.4);z-index:9998;
  opacity:0;transform:translateY(-6px);pointer-events:none;transition:.18s}
.um-wrap.open .um-drop{opacity:1;transform:none;pointer-events:auto}
.um-drop a,.um-drop button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
  background:transparent;border:0;color:#eef2ff;padding:10px 12px;border-radius:10px;cursor:pointer;
  font:500 14px/1 'Inter',sans-serif;text-decoration:none;transition:.15s}
.um-drop a:hover,.um-drop button:hover{background:rgba(255,255,255,.06)}
.um-drop .um-sep{height:1px;background:rgba(255,255,255,.08);margin:6px 4px}
.um-drop .um-danger{color:#ff8fa1}
.um-fixed{position:fixed;top:calc(env(safe-area-inset-top) + 12px);right:12px;z-index:9998}
@media (max-width:480px){.um-name{display:none}}
`;
const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

function initials(str){
  return (str||'?').trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase() || '?';
}

function render(user){
  let host = document.getElementById('userMenu');
  if(!host){ host = document.createElement('div'); host.id='userMenu'; host.className='um-fixed'; document.body.appendChild(host); }
  host.innerHTML = '';

  if(!user){
    const a = document.createElement('a');
    a.href='/auth.html'; a.className='um-btn'; a.textContent='Войти';
    host.appendChild(a);
    return;
  }

  const name = user.displayName || user.email || 'Аккаунт';
  const wrap = document.createElement('div'); wrap.className='um-wrap';
  wrap.innerHTML = `
    <button class="um-btn" type="button" aria-haspopup="menu" aria-expanded="false">
      <span class="um-av">${user.photoURL?`<img src="${user.photoURL}" alt="">`:initials(name)}</span>
      <span class="um-name">${name}</span>
      <span aria-hidden="true">▾</span>
    </button>
    <div class="um-drop" role="menu">
      <a href="/dashboard.html">👤 Личный кабинет</a>
      <a href="/orders.html">📦 Мои заказы</a>
      <a href="/wallet.html">💳 Пополнить баланс</a>
      <a href="/settings.html">⚙️ Настройки</a>
      <div class="um-sep"></div>
      <button type="button" class="um-danger" data-logout>↩ Выйти</button>
    </div>`;
  host.appendChild(wrap);

  const btn = wrap.querySelector('.um-btn');
  const drop = wrap.querySelector('.um-drop');
  btn.addEventListener('click', e=>{ e.stopPropagation(); wrap.classList.toggle('open'); btn.setAttribute('aria-expanded', wrap.classList.contains('open')); });
  document.addEventListener('click', e=>{ if(!wrap.contains(e.target)){ wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }});
  wrap.querySelector('[data-logout]').addEventListener('click', async ()=>{
    try{
      await signOutEverywhere();
      try{ sessionStorage.clear(); }catch(_){}
      try{
        // Чистим только auth-ключи, не трогая корзину/настройки сайта
        Object.keys(localStorage).forEach(k=>{ if(/^(firebase|fb|auth|user|token|session)/i.test(k)) localStorage.removeItem(k); });
      }catch(_){}
    }finally{
      render(null);
      // мягкое обновление интерфейса без reload — просто перерисовали виджет
    }
  });
}

subscribeAuth(state => render((state && state.user) || getStoredUser() || null));
