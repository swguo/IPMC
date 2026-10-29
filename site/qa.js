import {mountVoiceLookup,matchesVoice} from './qa-voice.js?v=35';
// Interactive UI adapted from the user-provided TRACE Q&A page.
// Question data and answer markup are supplied only after vault decryption.
export function mountQA(host,D,markup,options={}){
const root=host.attachShadow({mode:'open'});
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./qa.css?v=35',import.meta.url).href;root.append(sheet);
const container=document.createElement('div');container.className='qa-root';container.append(markup.cloneNode(true));root.append(container);
if(window.matchMedia('(min-width:900px)').matches)root.querySelector('.filter-options').open=true;
const $ = s => root.querySelector(s);
const byId = Object.fromEntries(D.items.map(i => [i.id, i]));
const store = {
  get(k, d){ try { return localStorage.getItem('traceqa.' + k) ?? d } catch(e){ return d } },
  set(k, v){ try { localStorage.setItem('traceqa.' + k, v) } catch(e){} }
};
const st = { q:'', sec:'all', slide:null, lang: (['zh','en','bi'].includes(store.get('lang','bi'))?store.get('lang','bi'):'bi'), cur:null, sheetTab: 'g2',voiceActive:false,voiceIds:null };
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toks = () => st.q.toLowerCase().normalize('NFKC').split(/\s+/).filter(Boolean);

function matches(it, ts){
  if(st.voiceActive)return matchesVoice(it,ts,st.voiceIds);
  return ts.every(t => it.search.includes(t) || it.id.toLowerCase() === t || (/^\d+$/.test(t) && it.slides.includes(+t)));
}
function score(it, ts){
  let s = 0;
  for (const t of ts){
    if (it.id.toLowerCase() === t) s += 100;
    if (/^\d+$/.test(t) && it.slides.includes(+t)) s += 60;
    if ((it.tz + ' ' + it.te).toLowerCase().includes(t)) s += 12;
    if ((it.kz + ' ' + it.ke).toLowerCase().includes(t)) s += 8;
  }
  return s;
}
function filtered(){
  const ts = toks();
  let arr = D.items.filter(it =>
    (st.sec === 'all' || it.sec === st.sec) &&
    (st.slide == null || it.slides.includes(st.slide)) &&
    matches(it, ts));
  if(st.voiceActive&&st.voiceIds?.size){const order=[...st.voiceIds];arr.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));return arr}
  if (ts.length) arr = arr.map(it => [it, score(it, ts)]).sort((a,b) => b[1]-a[1]).map(x => x[0]);
  return arr;
}
function hl(text){
  let h = esc(text);
  for (const t of toks()){
    if (t.length < 1) continue;
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    h = h.replace(re, m => '<mark>' + m + '</mark>');
  }
  return h;
}
function tags(it){
  let h = '';
  if (it.has_supplement) h += `<span class="tag p">＋補充</span>`;
  if (it.practice_focus) h += `<span class="tag w">★ 加強練習</span>`;
  if (it.slides.length) h += `<span class="tag p">p.${it.slides.join('·')}</span>`;
  if (it.marks.includes('⚠')) h += `<span class="tag w">⚠ 先確認</span>`;
  if (it.marks.includes('🛡')) h += `<span class="tag g">🛡 防守</span>`;
  return h;
}

function renderPages(){
  const has = new Set(D.items.flatMap(i => i.slides));
  const el = $('#pages'); el.innerHTML = '';
  for (let p = 1; p <= 41; p++){
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = p; b.disabled = !has.has(p);
    b.setAttribute('aria-pressed', st.slide === p);
    b.setAttribute('aria-label', '第 ' + p + ' 頁');
    b.onclick = () => { st.slide = st.slide === p ? null : p; renderPages(); renderList(); };
    el.appendChild(b);
  }
}
function renderList(){
  const arr = filtered();
  const ts = toks();
  $('#count').textContent = `${arr.length} 題`+(st.voiceActive?' · AI／語音篩選':'') + (st.slide ? ` · 第 ${st.slide} 頁` : '') + (ts.length ? ` · 搜尋「${st.q.trim()}」` : '');
  if (!arr.length){
    $('#list').innerHTML = `<div class="empty">找不到符合的題目。<br>試試英文關鍵字、頁碼，或先用「聽不懂？」確認對方的問題。</div>`;
    return;
  }
  $('#list').innerHTML = arr.map(it => {
    const t1 = st.lang === 'en' ? it.te : it.tz;
    const t2 = st.lang === 'bi' ? `<div class="t2">${hl(it.te)}</div>` : '';
    return `<button class="row" type="button" data-id="${it.id}" aria-current="${st.cur === it.id}">
      <span class="qid T">${it.id}</span>
      <span class="rt"><div class="t1">${hl(t1)}</div>${t2}<div class="meta">${tags(it)}</div></span></button>`;
  }).join('');
}
function decorate(root){
  root.querySelectorAll('table').forEach(t => { const w = document.createElement('div'); w.className = 'tw'; t.replaceWith(w); w.appendChild(t); });
  root.querySelectorAll('p').forEach(p => {
    const s = p.querySelector('strong'); if (!s || p.firstChild !== s) return;
    const k = s.textContent.trim();
    if (/^(一句話回答|Short answer|回答|英文回答|Answer)$/.test(k)) p.classList.add('key');
    else if (/^(結尾|Closing|收尾句|Closing line)$/.test(k)) p.classList.add('closing');
    else if (/^(不要說|Don't say)$/.test(k)) p.classList.add('dont');
    else if (/^(英文提問|Possible question|可能的問法|You may hear)$/.test(k)) p.classList.add('q');
    else if (/^(關鍵字|Keywords)$/.test(k)) p.hidden = true;
    else if (/^(翻頁|Go to)$/.test(k)) p.classList.add('goto');
  });
}
function renderDetail(id){
  const it = byId[id]; if (!it) return;
  st.cur = id;
  const arr = filtered(); const i = arr.findIndex(x => x.id === id);
  const prev = i > 0 ? arr[i-1] : null, next = i >= 0 && i < arr.length-1 ? arr[i+1] : null;
  const zh = `<div class="lang-block"><div class="lang-label">中文 · 理解摘要</div><div class="prose">${it.hz}</div></div>`;
  const en = `<div class="lang-block"><div class="lang-label">English · 看圖、說明、結論</div><div class="prose">${it.he}</div></div>`;
  const body = st.lang === 'zh' ? zh : st.lang === 'en' ? en : en + zh;
  const navBtn = (x, dir) => x ? `<button type="button" data-id="${x.id}"><small>${dir}</small>${x.id}｜${esc(st.lang==='en'?x.te:x.tz)}</button>` : '<span></span>';
  $('#paneIn').innerHTML = `<button class="back" type="button" id="back">‹ 回到列表</button>
    <div class="qhead"><span class="qid T">${it.id}</span>${tags(it)}<span class="tag p">${secName(it.sec)}</span></div>
    <h1 class="qt">${esc(st.lang==='en'?it.te:it.tz)}</h1>${st.lang==='bi'?`<p class="qte">${esc(it.te)}</p>`:''}
    ${body}
    <div class="nav">${navBtn(prev,'上一題')}${navBtn(next,'下一題')}</div>`;
  decorate($('#paneIn'));
  markHits($('#paneIn').querySelectorAll('.prose'));
  $('#paneIn').querySelectorAll('.prose a[href^="#q"]').forEach(a => a.onclick = ev => { ev.preventDefault(); const k = a.getAttribute('href').slice(1).toUpperCase(); if (byId[k]) renderDetail(k); });
  $('#pane').scrollTop = 0;
  $('#pane').classList.add('open');
  $('#back').onclick = closeDetail;
  $('#paneIn').querySelectorAll('.nav button').forEach(b => b.onclick = () => renderDetail(b.dataset.id));
  renderList();
  
}
function closeDetail(){ $('#pane').classList.remove('open'); }
function renderWelcome(){
  $('#paneIn').innerHTML = `<div class="welcome">
    <h1>被提問時，照這五步</h1>
    <div class="steps">
      <div class="step"><b>1 · 聽</b><span>抓 2–3 個關鍵字</span><em>寫在紙上或打進搜尋</em></div>
      <div class="step"><b>2 · 停</b><span>停 2–3 秒</span><em>"That's a good question."</em></div>
      <div class="step"><b>3 · 確認</b><span>說出關鍵字確認</span><em>"You're asking about X, right?"</em></div>
      <div class="step"><b>4 · 回答</b><span>翻頁 → 說明 → 結論</span><em>說出圖表重點，不逐一念數字</em></div>
      <div class="step"><b>5 · 收尾</b><span>感謝＋未來或論文</span><em>"Does that answer your question?"</em></div>
    </div>
    <p class="count">左邊輸入關鍵字或點頁碼找題目。聽不懂時，按右下角「聽不懂？」。</p></div>`;
}

/* clarify sheet */
function sheetTabs(){
  const G = st.lang === 'en' ? D.guide_en : D.guide_zh;
  const name = st.lang === 'en'
    ? {g2:'Clarify',g3:'Question types',g4:'Need time',g1:'5 steps',g5:'Slide map',ph:'Phrases',g6:'Ending',lookup:'Indexes',refs:'References',source:'Version',supplement:'New notes'}
    : {g2:'確認技巧',g3:'問題類型',g4:'需要時間',g1:'五步驟',g5:'頁碼對照',ph:'萬用句',g6:'結束 Q&A',lookup:'索引',refs:'參考資料',source:'版本',supplement:'補充見解'};
  const order = ['g2','g3','g4','g1','g5','ph','g6','lookup','refs','source','supplement'];
  $('#shTitle').textContent = st.lang === 'en' ? "When you don't understand" : '聽不懂時怎麼辦';
  $('#shTabs').innerHTML = order.map(k => `<button class="chip" type="button" role="tab" data-k="${k}" aria-pressed="${st.sheetTab===k}" aria-selected="${st.sheetTab===k}">${name[k]}</button>`).join('');
  const html = st.sheetTab === 'ph' ? (st.lang === 'en' ? D.ph_en : D.ph_zh) : (G.find(g => g.id === st.sheetTab) || G[1]).html;
  $('#shBody').innerHTML = `<div class="prose">${html}</div>`;
  decorate($('#shBody'));
  $('#shTabs').querySelectorAll('button').forEach(b => b.onclick = () => { st.sheetTab = b.dataset.k; sheetTabs(); $('#shBody').scrollTop = 0; });
}
$('#shBody').addEventListener('click',ev=>{const a=ev.target.closest('a[href^="#q"]');if(!a)return;const key=a.getAttribute('href').slice(1).toUpperCase();if(byId[key]){ev.preventDefault();closeSheet();renderDetail(key)}});
function openSheet(){ sheetTabs(); $('#sheet').hidden = false; $('#scrim').hidden = false; $('.app').inert=true;$('#fab').inert=true;$('#shBody').scrollTop=0;$('#shClose').focus(); }
function closeSheet(){ $('#sheet').hidden = true; $('#scrim').hidden = true; $('.app').inert=false;$('#fab').inert=false;$('#fab').focus(); }

/* wake lock */
let wake = null;
async function toggleWake(){
  const b = $('#wake');
  try {
    if (wake){ await wake.release(); wake = null; b.setAttribute('aria-pressed','false'); b.textContent = '螢幕常亮'; return; }
    wake = await navigator.wakeLock.request('screen');
    b.setAttribute('aria-pressed','true'); b.textContent = '常亮中';
    wake.addEventListener('release', () => { wake = null; b.setAttribute('aria-pressed','false'); b.textContent = '螢幕常亮'; });
  } catch(e){ b.textContent = '無法常亮'; setTimeout(() => b.textContent = '螢幕常亮', 2000); }
}

/* wiring */
function setLang(l){
  st.lang = l; store.set('lang', l);
  root.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === l));
  renderChips(); renderList(); if (st.cur) renderDetail(st.cur); if (!$('#sheet').hidden) sheetTabs();
}
function secName(id){ const x = D.sections.find(s => s.id === id); return x ? (st.lang === 'en' ? x.ne : x.nz) : ''; }
function renderChips(){
  const lab = s => st.lang === 'en' ? s.se : s.sz;
  $('#chips').innerHTML = `<button class="chip" type="button" data-sec="all">${st.lang==='en'?'All':'全部'}</button>` +
    D.sections.map(s => `<button class="chip" type="button" data-sec="${s.id}" title="${esc(st.lang==='en'?s.ne:s.nz)}">${s.id} ${lab(s)}</button>`).join('');
  $('#chips').querySelectorAll('.chip').forEach(b => { b.setAttribute('aria-pressed', b.dataset.sec === st.sec); b.onclick = () => setSec(b.dataset.sec); });
}
function setSec(p){ st.sec = p; renderChips(); renderList(); }
function markHits(roots){
  const ts = toks().filter(t => t.length > 1 || /[\u3400-\u9fff]/.test(t)); if (!ts.length) return;
  const src = '(' + ts.map(t => t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')';
  const re = new RegExp(src, 'gi'), re1 = new RegExp(src, 'i');
  roots.forEach(root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = [];
    while (w.nextNode()) if (re1.test(w.currentNode.nodeValue)) nodes.push(w.currentNode);
    nodes.forEach(n => { re.lastIndex = 0; const f = document.createElement('span');
      f.innerHTML = esc(n.nodeValue).replace(re, m => '<mark class="hit">' + m + '</mark>'); n.replaceWith(...f.childNodes); });
  });
}
$('#q').addEventListener('input', e => { st.voiceActive=false;st.voiceIds=null;$('#voice-filter').hidden=true;st.q = e.target.value; $('#clear').hidden = !st.q; renderList(); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter'){ const f = filtered()[0]; if (f){ renderDetail(f.id); e.target.blur(); } } });
$('#clear').onclick = () => { st.voiceActive=false;st.voiceIds=null;$('#voice-filter').hidden=true;$('#q').value = ''; st.q = ''; $('#clear').hidden = true; renderList(); $('#q').focus(); };
$('#list').addEventListener('click', e => { const r = e.target.closest('.row'); if (r) renderDetail(r.dataset.id); });
root.querySelectorAll('.seg button').forEach(b => b.onclick = () => setLang(b.dataset.lang));
$('#fab').onclick = openSheet; $('#shClose').onclick = closeSheet; $('#scrim').onclick = closeSheet;
$('#wake').onclick = toggleWake;
root.addEventListener('keydown', e => {
  if(e.key==='Tab'&&!$('#sheet').hidden){const items=[...$('#sheet').querySelectorAll('button,a[href],input,[tabindex="0"]')].filter(el=>!el.disabled&&!el.hidden);const first=items[0],last=items.at(-1);if(e.shiftKey&&root.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&root.activeElement===last){e.preventDefault();first.focus()}}
  if (e.key === 'Escape'){ if (!$('#sheet').hidden) closeSheet(); else closeDetail(); }
  if (e.key === '/' && root.activeElement !== $('#q')){ e.preventDefault(); $('#q').focus(); }
});

const voiceFilter=document.createElement('div');voiceFilter.id='voice-filter';voiceFilter.className='voice-filter';voiceFilter.hidden=true;
const voiceLabel=document.createElement('span');voiceLabel.id='voice-filter-label';voiceFilter.append(voiceLabel);
const voiceView=document.createElement('button');voiceView.type='button';voiceView.textContent='中英問題';voiceView.addEventListener('click',()=>voice.show());voiceFilter.append(voiceView);
const voiceClear=document.createElement('button');voiceClear.type='button';voiceClear.textContent='清除AI篩選';voiceClear.addEventListener('click',clearVoiceFilter);voiceFilter.append(voiceClear);$('#count').after(voiceFilter);
function clearVoiceFilter(){st.voiceActive=false;st.voiceIds=null;st.q='';st.sec='all';st.slide=null;$('#q').value='';$('#clear').hidden=true;voiceFilter.hidden=true;renderChips();renderPages();renderList()}
function applyVoiceFilter(result,useCandidates){st.voiceActive=true;st.voiceIds=useCandidates?new Set(result.candidate_ids):null;st.sec='all';st.slide=null;st.q=result.keywords.join(' ');$('#q').value=st.q;$('#clear').hidden=!st.q;voiceLabel.textContent=useCandidates&&result.candidate_ids.length?'AI候選：'+result.candidate_ids.join('、'):'關鍵字（任一詞符合）';voiceFilter.hidden=false;closeDetail();renderWelcome();renderChips();renderPages();renderList();}
const voice=mountVoiceLookup(root,D,{api:options.api,onApply:applyVoiceFilter,onClear:clearVoiceFilter,onSettings:options.onSettings,onActivity:options.onActivity});

renderPages(); setLang(st.lang);
const h = '';
if (byId[h]) renderDetail(h);
else { renderWelcome(); if (window.matchMedia('(min-width: 900px)').matches) $('#pane').classList.add('open'); }

return {pause(){voice.pause();$('#sheet').hidden=true;$('#scrim').hidden=true;if(wake)wake.release().catch(()=>{});},destroy(){voice.destroy();if(wake)wake.release().catch(()=>{});}};

}
