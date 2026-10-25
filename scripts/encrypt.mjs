// Usage: node scripts/encrypt.mjs /private/content.html /private/password.txt
import {readFile,writeFile} from 'node:fs/promises';
import {webcrypto as crypto} from 'node:crypto';
const [contentPath,passwordPath]=process.argv.slice(2);
if(!contentPath||!passwordPath)throw Error('Supply private HTML and password file paths');
const password=(await readFile(passwordPath,'utf8')).trim();
if(!password)throw Error('Password must not be empty');
if(password.length<16 && !process.argv.includes('--allow-short-password'))throw Error('Use at least 16 characters or explicitly pass --allow-short-password');
const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
const iterations=600000;
const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt']);
const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,await readFile(contentPath));
const b64=b=>Buffer.from(b).toString('base64');
await writeFile(new URL('../site/vault.json',import.meta.url),JSON.stringify({version:1,iterations,salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)})+'\n');
console.log('Encrypted vault written; no password or plaintext copied to site.');
