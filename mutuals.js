import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPhcoKEW9O1soc_bbBHWmitjaoZwHrfL8",
  authDomain: "smm-boost-905d5.firebaseapp.com",
  projectId: "smm-boost-905d5",
  storageBucket: "smm-boost-905d5.firebasestorage.app",
  messagingSenderId: "554912523069",
  appId: "1:554912523069:web:26d405b696b9d45e5edb54",
  measurementId: "G-E6SRLXZW5V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const mutualsRef = collection(db, "mutuals");

const TWO_HOURS = 2 * 60 * 60 * 1000;
const MIN_OPENED = 10;

const list = document.getElementById("mutualsList");
const addBtn = document.getElementById("addProfileBtn");
const refreshBtn = document.getElementById("refreshMutualsBtn");
const socialInput = document.getElementById("social");
const linkInput = document.getElementById("profileLink");
const counter = document.getElementById("subscribedCounter");
const requirement = document.getElementById("mutualsRequirement");

let mutuals = [];
let myProfileDocId = localStorage.getItem("smmBoostMutualProfileDocId") || "";

// Use authenticated sb_user session if available, fallback to local ID for anonymous users
function getMutualsUserId() {
  try {
    const sbUser = JSON.parse(localStorage.getItem("sb_user") || "{}");
    if (sbUser.userId) return sbUser.userId;
  } catch {}

  let existingId = localStorage.getItem("smmBoostMutualUserId");
  if (existingId) return existingId;

  let userId = "u_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  localStorage.setItem("smmBoostMutualUserId", userId);
  return userId;
}

let userId = getMutualsUserId();

function setupMenu(){
  const btn = document.querySelector(".menu-toggle");
  const menu = document.querySelector(".nav-menu");
  if(!btn || !menu) return;

  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    const opened = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", opened ? "true" : "false");
  });

  document.addEventListener("click", (e)=>{
    if(!menu.contains(e.target) && !btn.contains(e.target)){
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

function normalizeUrl(url){
  const value = String(url || "").trim();
  if(!value) return "";
  if(/^https?:\/\//i.test(value)) return value;
  return "https://" + value;
}

function getOpenedIds(){
  try { return JSON.parse(localStorage.getItem("smmBoostOpenedMutuals") || "[]"); }
  catch { return []; }
}

function setOpenedIds(ids){
  localStorage.setItem("smmBoostOpenedMutuals", JSON.stringify([...new Set(ids)]));
}

function markOpened(id){
  if(!id || id === myProfileDocId) return;
  const ids = getOpenedIds();
  ids.push(id);
  setOpenedIds(ids);
  updateCounter();
}

function updateCounter(){
  const openedCount = getOpenedIds().length;
  const required = Math.min(MIN_OPENED, Math.max(0, mutuals.filter(x => x.id !== myProfileDocId).length));
  const effectiveRequired = mutuals.length >= MIN_OPENED ? MIN_OPENED : 0;

  if(counter){
    counter.textContent = mutuals.length >= MIN_OPENED
      ? `Открыто профилей: ${Math.min(openedCount, MIN_OPENED)}/${MIN_OPENED}`
      : "Пока участников меньше 10 — можно добавить профиль без условия.";
  }

  if(requirement){
    requirement.textContent = mutuals.length >= MIN_OPENED
      ? "Перед добавлением откройте минимум 10 профилей участников."
      : "Пока участников меньше 10 — первые профили можно добавлять без условия.";
  }

  return { openedCount, required: effectiveRequired };
}

function getPlatformIcon(social){
  const s = String(social || "").toLowerCase();
  if(s.includes("tiktok")) return "🎵";
  if(s.includes("telegram")) return "✈️";
  if(s.includes("vk")) return "🔵";
  if(s.includes("youtube")) return "▶️";
  if(s.includes("instagram")) return "📸";
  return "🌐";
}

function getTimeLeftText(lastBoost){
  if(!lastBoost) return "✅ Можно поднять сейчас";

  let lastMs = 0;
  if(typeof lastBoost.toMillis === "function") lastMs = lastBoost.toMillis();
  else if(lastBoost.seconds) lastMs = lastBoost.seconds * 1000;
  else lastMs = Number(lastBoost || 0);

  const diff = TWO_HOURS - (Date.now() - lastMs);
  if(diff <= 0) return "✅ Можно поднять сейчас";

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `⏳ Повторно через ${h}ч ${m}м`;
}

function canBoost(lastBoost){
  if(!lastBoost) return true;
  let lastMs = 0;
  if(typeof lastBoost.toMillis === "function") lastMs = lastBoost.toMillis();
  else if(lastBoost.seconds) lastMs = lastBoost.seconds * 1000;
  else lastMs = Number(lastBoost || 0);
  return Date.now() - lastMs >= TWO_HOURS;
}

function createCard(item, isMine){
  const div = document.createElement("div");
  div.className = isMine ? "mutual-card my-profile" : "mutual-card";
  div.dataset.id = item.id;

  const link = normalizeUrl(item.link);
  const opened = getOpenedIds().includes(item.id);

  div.innerHTML = `
    <div class="mutual-card-top">
      <h3>${isMine ? "⭐ Ваш профиль" : `${getPlatformIcon(item.social)} ${item.social || "Профиль"}`}</h3>
      ${isMine ? `<span class="mutual-badge">Всегда сверху у вас</span>` : opened ? `<span class="mutual-badge done">Открыт</span>` : ``}
    </div>

    ${isMine ? `<p>${getPlatformIcon(item.social)} ${item.social || "Соцсеть"}</p>` : ``}

    <a href="${link}" target="_blank" rel="noopener" class="mutual-open-link">
      ${isMine ? "Открыть мой профиль" : "Открыть профиль"}
    </a>

    <button class="mutual-boost-btn" type="button" ${!canBoost(item.boostedAt) ? "disabled" : ""}>
      📈 Поднять в топ
    </button>

    <div class="timer">${getTimeLeftText(item.boostedAt)}</div>
  `;

  div.querySelector(".mutual-open-link")?.addEventListener("click", ()=>markOpened(item.id));
  div.querySelector(".mutual-boost-btn")?.addEventListener("click", ()=>boostProfile(item));

  return div;
}

function renderProfiles(){
  updateCounter();
  list.innerHTML = "";

  const myProfile = mutuals.find(x => x.id === myProfileDocId || x.userId === userId);
  if(myProfile){
    myProfileDocId = myProfile.id;
    localStorage.setItem("smmBoostMutualProfileDocId", myProfile.id);
    list.appendChild(createCard(myProfile, true));
  }

  const others = mutuals.filter(x => x.id !== myProfileDocId && x.userId !== userId);
  if(others.length === 0 && !myProfile){
    list.innerHTML = `<div class="mutual-empty">Пока профилей нет. Будьте первым участником 🔥</div>`;
    return;
  }

  others.forEach(item => list.appendChild(createCard(item, false)));
}

async function addProfile(){
  const social = socialInput.value;
  const link = normalizeUrl(linkInput.value);

  if(!link || !/^https?:\/\//i.test(link)){
    alert("Вставьте корректную ссылку на профиль");
    return;
  }

  if(myProfileDocId || mutuals.some(x => x.userId === userId)){
    alert("Вы уже добавили профиль. Он отображается сверху в блоке 'Ваш профиль'.");
    return;
  }

  const { openedCount, required } = updateCounter();
  if(required > 0 && openedCount < required){
    alert(`Сначала откройте минимум ${required} профилей участников`);
    return;
  }

  addBtn.disabled = true;
  addBtn.textContent = "Добавляем...";

  try{
    const docRef = await addDoc(mutualsRef, {
      social,
      link,
      userId,
      createdAt: serverTimestamp(),
      boostedAt: serverTimestamp()
    });

    myProfileDocId = docRef.id;
    localStorage.setItem("smmBoostMutualProfileDocId", docRef.id);
    linkInput.value = "";
    alert("Профиль добавлен. Теперь он будет сверху у вас и в общей ленте у других пользователей.");
  }catch(e){
    console.error(e);
    alert("Не удалось добавить профиль. Проверьте доступ к базе Firebase/Firestore.");
  }finally{
    addBtn.disabled = false;
    addBtn.textContent = "🚀 Добавить профиль";
  }
}

async function boostProfile(item){
  if(!item || !item.id) return;

  if(!canBoost(item.boostedAt)){
    alert("Поднять профиль можно раз в 2 часа");
    return;
  }

  try{
    await updateDoc(doc(db, "mutuals", item.id), {
      boostedAt: serverTimestamp()
    });
    alert("Профиль поднят в топ 🔥");
  }catch(e){
    console.error(e);
    alert("Не удалось поднять профиль. Попробуйте позже.");
  }
}

function startRealtime(){
  const q = query(mutualsRef, orderBy("boostedAt", "desc"));
  onSnapshot(q, (snap)=>{
    mutuals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProfiles();
  }, (error)=>{
    console.error(error);
    list.innerHTML = `<div class="mutual-empty">Не удалось загрузить общую ленту. Проверьте Firestore Rules.</div>`;
  });
}

setupMenu();
addBtn?.addEventListener("click", addProfile);
refreshBtn?.addEventListener("click", renderProfiles);
setInterval(renderProfiles, 30000);
startRealtime();
