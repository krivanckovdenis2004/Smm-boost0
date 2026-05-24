const mutuals = JSON.parse(localStorage.getItem('mutuals')) || [];

function renderProfiles(){

const list = document.getElementById('mutualsList');

list.innerHTML = '';

const myProfile = JSON.parse(localStorage.getItem('my_profile'));

if(myProfile){

const myDiv = document.createElement('div');

myDiv.className = 'mutual-card my-profile';

myDiv.innerHTML = `
<h3>⭐ Ваш профиль</h3>

<p>${myProfile.social}</p>

<a href="${myProfile.link}" target="_blank">
Открыть мой профиль
</a>

<button onclick="boostMyProfile()">
📈 Поднять мой профиль
</button>

<div class="timer" id="myBoostTimer"></div>
`;

list.appendChild(myDiv);

updateMyBoostTimer();

}

mutuals.forEach((item,index)=>{

if(
myProfile &&
item.link === myProfile.link
){
return;
}

const div = document.createElement('div');

div.className = 'mutual-card';

const boostTime = localStorage.getItem('boost_'+index);

let timer = '';

if(boostTime){

const diff = 7200000 - (Date.now() - parseInt(boostTime));

if(diff > 0){

const h = Math.floor(diff / 3600000);
const m = Math.floor((diff % 3600000)/60000);

timer = `⏳ ${h}ч ${m}м`;

}

}

div.innerHTML = `
<h3>${item.social}</h3>

<a href="${item.link}" target="_blank">
Открыть профиль
</a>

<button onclick="boostProfile(${index})">
📈 Поднять в топ
</button>

<div class="timer">${timer}</div>
`;

list.appendChild(div);

});

}

function addProfile(){

const social = document.getElementById('social').value;
const link = document.getElementById('profileLink').value;

if(mutuals.length >= 10){

const done = localStorage.getItem('subscribed_profiles');

if(!done || parseInt(done) < 10){

alert('Сначала подпишитесь минимум на 10 профилей');

return;

}

}

if(localStorage.getItem('my_profile_added')){

alert('Вы уже добавили профиль');

return;

}

const profile = {
social,
link
};

mutuals.unshift(profile);

localStorage.setItem('mutuals',JSON.stringify(mutuals));

localStorage.setItem('my_profile',JSON.stringify(profile));

localStorage.setItem('my_profile_added','true');

renderProfiles();

}

function boostProfile(index){

const last = localStorage.getItem('boost_'+index);

if(last){

const diff = Date.now() - parseInt(last);

if(diff < 7200000){

alert('Поднять профиль можно раз в 2 часа');

return;

}

}

const item = mutuals.splice(index,1)[0];

mutuals.unshift(item);

localStorage.setItem('mutuals',JSON.stringify(mutuals));

localStorage.setItem('boost_'+index,Date.now());

renderProfiles();

}

function boostMyProfile(){

const last = localStorage.getItem('my_profile_boost');

if(last){

const diff = Date.now() - parseInt(last);

if(diff < 7200000){

alert('Поднять профиль можно раз в 2 часа');

return;

}

}

const myProfile = JSON.parse(localStorage.getItem('my_profile'));

if(!myProfile) return;

const filtered = mutuals.filter(item => item.link !== myProfile.link);

filtered.unshift(myProfile);

mutuals.length = 0;

filtered.forEach(item => mutuals.push(item));

localStorage.setItem('mutuals',JSON.stringify(mutuals));

localStorage.setItem('my_profile_boost',Date.now());

renderProfiles();

}

function updateMyBoostTimer(){

const timer = document.getElementById('myBoostTimer');

if(!timer) return;

const last = localStorage.getItem('my_profile_boost');

if(!last){

timer.innerHTML = '✅ Можно поднять сейчас';

return;

}

const interval = setInterval(()=>{

const diff = 7200000 - (Date.now() - parseInt(last));

if(diff <= 0){

timer.innerHTML = '✅ Можно поднять сейчас';

clearInterval(interval);

return;

}

const h = Math.floor(diff / 3600000);
const m = Math.floor((diff % 3600000)/60000);

timer.innerHTML = `⏳ Повторно через ${h}ч ${m}м`;

},1000);

}

renderProfiles();