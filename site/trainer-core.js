export const KEY_SLOT='travel-openai-key-v1';
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const AAD=enc.encode('travel-openai-key-v1');
export async function createKeyStore(password,storage){
 let stored=null,invalid=false,generation=0;
 try{const text=storage.getItem(KEY_SLOT);if(text)stored=JSON.parse(text)}catch{invalid=true}
 if(stored&&!(stored.version===1&&stored.iterations===600000&&typeof stored.salt==='string'&&typeof stored.iv==='string'&&typeof stored.ciphertext==='string')){stored=null;invalid=true}
 let salt;
 try{salt=stored?un64(stored.salt):crypto.getRandomValues(new Uint8Array(16));if(salt.length!==16)throw Error()}catch{salt=crypto.getRandomValues(new Uint8Array(16));stored=null;invalid=true}
 const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);password='';
 let key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 return {
  async load(){if(invalid)throw Error('SAVED_KEY');if(!stored)return '';try{return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(stored.iv),additionalData:AAD},key,un64(stored.ciphertext)))}catch{throw Error('SAVED_KEY')}},
  async save(secret){const revision=generation;const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},key,enc.encode(secret));if(!key||revision!==generation)throw new DOMException('Cancelled','AbortError');const record={version:1,iterations:600000,salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)};storage.setItem(KEY_SLOT,JSON.stringify(record));stored=record;invalid=false},
  remove(){generation++;storage.removeItem(KEY_SLOT);stored=null;invalid=false},
  destroy(){generation++;key=null;stored=null}
 };
}
export const questionSchema={type:'object',properties:{question:{type:'string'},keywords:{type:'array',items:{type:'string'}}},required:['question','keywords'],additionalProperties:false};
export const evaluationSchema={type:'object',properties:{score:{type:'integer'},relevance:{type:'integer'},accuracy:{type:'integer'},completeness:{type:'integer'},matched:{type:'array',items:{type:'string'}},missing:{type:'array',items:{type:'string'}},unsupported:{type:'array',items:{type:'string'}},feedback_zh:{type:'string'},better_answer_en:{type:'string'}},required:['score','relevance','accuracy','completeness','matched','missing','unsupported','feedback_zh','better_answer_en'],additionalProperties:false};
function validStrings(list){return Array.isArray(list)&&list.length<=20&&list.every(s=>typeof s==='string'&&s.length<=3000)}
export function validateQuestion(x){if(!x||typeof x.question!=='string'||!x.question.trim()||x.question.length>1500||!validStrings(x.keywords))throw Error('FORMAT');return x}
export function validateEvaluation(x){if(!x||!['score','relevance','accuracy','completeness'].every(k=>Number.isInteger(x[k])&&x[k]>=0&&x[k]<=100)||!['matched','missing','unsupported'].every(k=>validStrings(x[k]))||!['feedback_zh','better_answer_en'].every(k=>typeof x[k]==='string'&&x[k].length<=10000))throw Error('FORMAT');return x}
export function parseCompletion(data){try{const message=data.choices?.[0]?.message;if(message?.refusal)throw Error();return JSON.parse(message.content)}catch{throw Error('FORMAT')}}
