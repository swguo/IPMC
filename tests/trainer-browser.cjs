// End-to-end tests use mocked OpenAI responses and a synthetic microphone.
// No OpenAI key, billable request or real microphone is used.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
if(!process.env.TRAVEL_PASSWORD_FILE)throw Error('Set TRAVEL_PASSWORD_FILE to the private dashboard password file.');
const pass=fs.readFileSync(process.env.TRAVEL_PASSWORD_FILE,'utf8').trim();
const FAKE_KEY='sk-test-only-not-a-real-openai-key-123456789';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['microphone']});
 await context.addInitScript(()=>{
  window.testAudioPlays=0;HTMLMediaElement.prototype.play=async function(){window.testAudioPlays++};
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.testStreams=[];navigator.mediaDevices.getUserMedia=async options=>{const stream=await original(options);window.testStreams.push(stream);return stream};
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const calls=[];let generated=0,evaluations=0,transcriptions=0,speech=0,apiFailure=0,delayQuestion=false,releaseQuestion;
 const complete=value=>({choices:[{message:{content:JSON.stringify(value)}}]});
 await context.route('https://api.openai.com/v1/**',async route=>{
  const request=route.request();const url=new URL(request.url());calls.push(url.pathname);assert.equal(request.headers().authorization,'Bearer '+FAKE_KEY);
  if(apiFailure){return route.fulfill({status:apiFailure,json:{error:{message:'Do not show raw key '+FAKE_KEY}}})}
  if(url.pathname.endsWith('/chat/completions')){
   const data=request.postDataJSON();assert.equal(data.model,'gpt-4.1-mini');const payload=JSON.parse(data.messages[1].content);
   if(data.response_format.json_schema.name==='practice_question'){
    assert.match(payload.reference,/simplest attack/);assert.match(payload.question,/simplest attack/);generated++;
    if(delayQuestion)await new Promise(resolve=>releaseQuestion=resolve);
    return route.fulfill({json:complete({question:generated%2?'Why did you use such a simple injection test?':'What makes a simple added instruction a meaningful test?',keywords:['simple','injection','test']})}).catch(()=>{});
   }
   assert.equal(data.response_format.json_schema.name,'practice_evaluation');assert.ok(payload.answer.length>10);assert.match(data.messages[0].content,/DO NOT claim to evaluate pronunciation/);evaluations++;
   return route.fulfill({json:complete({score:84,relevance:90,accuracy:85,completeness:78,matched:['說明低門檻攻擊'],missing:['可補充研究限制'],unsupported:[],feedback_zh:'模型估計：答到核心。<img src=x onerror="window.testInjected=true">',better_answer_en:'This is an easy low-barrier test. Other attacks are future work.'})});
  }
  if(url.pathname.endsWith('/audio/speech')){const data=request.postDataJSON();assert.equal(data.voice,'onyx');assert.equal(data.model,'gpt-4o-mini-tts');assert.match(data.input,/\?/);speech++;return route.fulfill({contentType:'audio/mpeg',body:Buffer.from([73,68,51,4,0,0,0,0,0,0])})}
  if(url.pathname.endsWith('/audio/transcriptions')){assert.match(request.headers()['content-type'],/multipart\/form-data; boundary=/);const data=request.postDataBuffer();assert.ok(data.length>100);transcriptions++;return route.fulfill({json:{text:'This is a simple low-barrier test. More attack types are future work.'}})}
  throw Error('Unexpected API endpoint');
 });
 async function unlock(){await page.locator('#password').fill(pass);await page.locator('#unlock-button').click();await page.locator('#lock').waitFor();await page.waitForFunction(()=>!document.querySelector('#train-setting-fields').disabled)}
 const base=process.env.TRAVEL_BASE_URL||'http://127.0.0.1:8000/';await page.goto(base+'#training');await unlock();
 assert.ok(await page.locator('#topic-menu').isHidden());assert.ok(await page.locator('#training').isVisible());assert.equal(calls.length,0);
 await page.locator('#train-start').click();await page.waitForFunction(()=>document.querySelector('#train-status').textContent.includes('先設定'));
 await page.locator('#train-settings summary').first().click();await page.locator('#train-api-key').fill(FAKE_KEY);await page.locator('#train-save-key').click();await page.waitForFunction(()=>document.querySelector('#train-key-state').textContent.includes('加密保存'));
 assert.equal(await page.locator('#train-api-key').inputValue(),'');assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes(FAKE_KEY));assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('travel-openai-key-v1')).ciphertext.length>20));
 await page.locator('#train-category').selectOption('focus');assert.deepEqual(await page.locator('#train-target option').evaluateAll(es=>es.map(e=>e.value)),['random','Q5','Q18','Q34','Q35']);await page.locator('#train-category').selectOption('F');await page.locator('#train-target').selectOption('Q31');await page.locator('#train-start').click();await page.waitForFunction(()=>!document.querySelector('#train-record').disabled);
 assert.equal(generated,1);assert.equal(speech,1);assert.ok(await page.locator('#train-question-text').isHidden());assert.ok(await page.evaluate(()=>window.testAudioPlays>0));const plays=await page.evaluate(()=>window.testAudioPlays);await page.locator('#train-replay').click();await page.waitForFunction(n=>window.testAudioPlays>n,plays);assert.equal(speech,1);
 await page.locator('#train-reveal').click();assert.match(await page.locator('#train-question-text').textContent(),/simple injection/);await page.locator('#train-hint').click();assert.match(await page.locator('#train-keywords').textContent(),/injection/);
 await page.locator('#train-answer').fill('This attack is easy to implement without special skills. More types are future work.');await page.locator('#train-evaluate').click();await page.locator('#train-result').waitFor();assert.match(await page.locator('.train-score').textContent(),/84/);assert.equal(await page.locator('#train-feedback img').count(),0);assert.equal(await page.evaluate(()=>window.testInjected),undefined);assert.equal(evaluations,1);
 // Exercise actual MediaRecorder and getUserMedia with Chromium's synthetic microphone.
 await page.locator('#train-record').click();await page.waitForFunction(()=>document.querySelector('#train-status').textContent.includes('錄音中'));
 await page.waitForTimeout(450);await page.locator('#train-stop').click();await page.waitForFunction(()=>document.querySelector('#train-status').textContent.includes('分析完成'));
 assert.equal(transcriptions,1);assert.equal(evaluations,2);assert.match(await page.locator('#train-answer').inputValue(),/low-barrier/);assert.ok(await page.evaluate(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
 // Leaving the topic must discard recording without transcription.
 await page.locator('#train-record').click();await page.waitForFunction(()=>document.querySelector('#train-status').textContent.includes('錄音中'));await page.locator('#topic-menu-toggle').click();await page.locator('[data-topic="qa"]').click();assert.ok(await page.evaluate(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));assert.equal(transcriptions,1);
 await page.locator('#topic-menu-toggle').click();await page.locator('[data-topic="training"]').click();
 for(const [code,word] of [[401,'無效'],[429,'額度'],[404,'模型']]){apiFailure=code;await page.locator('#train-start').click();await page.waitForFunction(word=>document.querySelector('#train-status').textContent.includes(word),word);assert.ok(!(await page.locator('#training').textContent()).includes(FAKE_KEY));}apiFailure=0;await page.evaluate(()=>{window.testSavedGetUserMedia=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}});await page.locator('#train-record').click();await page.waitForFunction(()=>document.querySelector('#train-status').textContent.includes('無法使用麥克風'));await page.evaluate(()=>navigator.mediaDevices.getUserMedia=window.testSavedGetUserMedia);
 await page.locator('#lock').click();assert.equal(await page.locator('#dashboard').innerHTML(),'');await unlock();assert.match(await page.locator('#train-key-state').textContent(),/已解鎖/);assert.equal(await page.locator('#train-api-key').inputValue(),'');
 await page.locator('#train-category').selectOption('F');await page.locator('#train-target').selectOption('Q31');delayQuestion=true;await page.locator('#train-start').click();await page.waitForFunction(()=>document.querySelector('#train-status').textContent.includes('正在產生'));while(!releaseQuestion)await page.waitForTimeout(20);await page.locator('#lock').click();releaseQuestion();await page.waitForTimeout(100);assert.equal(await page.locator('#dashboard').innerHTML(),'');delayQuestion=false;
 await unlock();await page.locator('#train-settings summary').first().click();await page.locator('#train-forget-key').click();assert.equal(await page.evaluate(()=>localStorage.getItem('travel-openai-key-v1')),null);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:process.env.TRAINING_SCREENSHOT||'/tmp/training-mobile.png',fullPage:true});await page.setViewportSize({width:1280,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);const cached=await page.evaluate(async()=>{const urls=[];for(const name of await caches.keys()){const c=await caches.open(name);urls.push(...(await c.keys()).map(r=>r.url))}return urls});assert.ok(cached.every(url=>!url.includes('api.openai.com')));
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!stored.includes('low-barrier'));assert.ok(!stored.includes(FAKE_KEY));assert.deepEqual(errors,[]);
 await context.setOffline(true);await page.reload();await unlock();assert.ok(await page.locator('#training').isVisible());await page.locator('#topic-menu-toggle').click();await page.locator('[data-topic="qa"]').click();assert.equal(await page.locator('#qa-host #list .row').count(),37);
 await browser.close();console.log('PASS: mocked question/TTS/transcription/grading flow, synthetic recording, encrypted key persistence, replay/hints, transcript correction, errors, XSS-safe feedback, topic/lock cancellation, no API caches, mobile and offline QA.');
})().catch(e=>{console.error(e);process.exit(1)});
