const mutuals = JSON.parse(localStorage.getItem('mutuals')) || [];

function renderProfiles(){

const list = document.getElementById('mutualsList');

list.innerHTML = '';

mutuals.forEach((item,index)=>{

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

const done = localStorage.getItem('subscribed_profiles');

if(!done || parseInt(done) < 10){

alert('Сначала подпишитесь минимум на 10 профилей');

return;

}

if(localStorage.getItem('my_profile_added')){

alert('Вы уже добавили профиль');

return;

}

mutuals.unshift({
social,
link
});

localStorage.setItem('mutuals',JSON.stringify(mutuals));

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

renderProfiles();