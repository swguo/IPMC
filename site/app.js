const $ = (s) => document.querySelector(s);
const gate = $('#gate'), dashboard = $('#dashboard');
let inactive, toastTimer;
const from64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export async function decrypt(envelope, password) {
  if (envelope.version !== 1 || envelope.iterations !== 600000) throw Error('Unsupported format');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:from64(envelope.salt),iterations:envelope.iterations}, material, {name:'AES-GCM',length:256}, false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(envelope.iv)},key,from64(envelope.ciphertext)));
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('active');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('active'),2500)}
function lock(){clearTimeout(inactive);dashboard.replaceChildren();dashboard.hidden=true;gate.hidden=false;$('#password').value='';$('#password').type='password';$('#reveal').textContent='顯示';$('#reveal').setAttribute('aria-pressed','false');$('#password').focus()}
function resetTimer(){clearTimeout(inactive);if(!dashboard.hidden) inactive=setTimeout(lock,10*60*1000)}
function storage(key,value){try{if(value===undefined)return localStorage.getItem(key);localStorage.setItem(key,value)}catch{return null}}
function chooseDay(day){dashboard.querySelectorAll('[data-day]').forEach(el=>{const selected=el.dataset.day===day;el.setAttribute('aria-selected',String(selected));el.tabIndex=selected?0:-1});dashboard.querySelectorAll('[data-panel]').forEach(el=>el.hidden=el.dataset.panel!==day)}
function network(){const el=$('#network');if(el)el.textContent=navigator.onLine?'已連線 · 非即時航班':'離線模式'}
$('#reveal').addEventListener('click',()=>{const show=$('#password').type==='password';$('#password').type=show?'text':'password';$('#reveal').textContent=show?'隱藏':'顯示';$('#reveal').setAttribute('aria-pressed',String(show))});
$('#unlock').addEventListener('submit',async e=>{e.preventDefault();const password=$('#password').value.trim();$('#unlock-button').disabled=true;$('#login-status').textContent='正在解鎖…';
try{if(!crypto.subtle)throw Error('CRYPTO');
async function loadVault(fresh=false){try{const url=fresh?'./vault.json?refresh='+Date.now():'./vault.json';const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('HTTP');return await r.json()}catch{throw Error('FETCH')}}
let envelope=await loadVault(),html;
try{html=await decrypt(envelope,password)}catch{
// Retry from the network: older workers and HTTP caches may have an old vault.
if(!navigator.onLine)throw Error('OFFLINE_PASSWORD');
envelope=await loadVault(true);
try{html=await decrypt(envelope,password)}catch{throw Error('PASSWORD')}
}
dashboard.innerHTML=html;$('#password').value='';gate.hidden=true;dashboard.hidden=false;$('#login-status').textContent='';
dashboard.querySelectorAll('[data-check]').forEach(el=>el.checked=storage('trip-check-'+el.dataset.check)==='1');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit'}).format(new Date());chooseDay(today.includes('10-30')||today.includes('10/30')?'30':today.includes('10-31')||today.includes('10/31')?'31':today.includes('11-01')||today.includes('11/01')?'01':'29');network();resetTimer();$('#lock').focus();
}catch(err){if(!dashboard.hidden){lock();$('#login-status').textContent='解鎖後載入失敗，請重新整理網站。';return}$('#login-status').textContent=err.message==='OFFLINE_PASSWORD'?'離線資料可能是舊版本。請連網更新後再用新密碼解鎖。':err.message==='FETCH'?'無法讀取旅程，請確認網路或先在線上開啟一次。':err.message==='CRYPTO'?'請使用 HTTPS 網址及支援的瀏覽器。':'密碼不正確，或加密資料已損壞。請重新輸入。'}finally{$('#unlock-button').disabled=false}});
dashboard.addEventListener('click',async e=>{const target=e.target.closest('button');if(!target)return;if(target.id==='lock')return lock();if(target.dataset.day)return chooseDay(target.dataset.day);if(target.dataset.copy){try{await navigator.clipboard.writeText(target.dataset.copy);toast('已複製')}catch{toast('無法自動複製，請長按資料複製')}}});
dashboard.addEventListener('keydown',e=>{if(!e.target.matches('[data-day]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...dashboard.querySelectorAll('[data-day]')];let i=tabs.indexOf(e.target);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;chooseDay(tabs[i].dataset.day);tabs[i].focus()});
dashboard.addEventListener('change',e=>{if(e.target.dataset.check)storage('trip-check-'+e.target.dataset.check,e.target.checked?'1':'0')});
for(const type of ['pointerdown','keydown','scroll'])document.addEventListener(type,resetTimer,{passive:true});
window.addEventListener('online',network);window.addEventListener('offline',network);window.addEventListener('pagehide',lock);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});

$('#refresh').addEventListener('click',async()=>{if(!navigator.onLine){$('#login-status').textContent='請先連上網路再更新網站。';return}$('#refresh').disabled=true;try{if('serviceWorker' in navigator){const r=await navigator.serviceWorker.getRegistration();await r?.update()}const url=new URL(location.href);url.searchParams.set('refresh',Date.now());location.replace(url.href)}catch{$('#login-status').textContent='更新失敗，請稍後再試。';$('#refresh').disabled=false}});
