import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const site=new URL('../site/',import.meta.url);
const names=await readdir(site);
assert.deepEqual(names.sort(),['app.js','index.html','qa.css','qa.js','style.css','sw.js','vault.json']);
const vault=JSON.parse(await readFile(new URL('vault.json',site),'utf8'));
assert.equal(vault.version,1);assert.equal(vault.iterations,600000);
assert.equal(Buffer.from(vault.salt,'base64').length,16);assert.equal(Buffer.from(vault.iv,'base64').length,12);
assert.ok(Buffer.from(vault.ciphertext,'base64').length>10000);
for(const name of names){
 const text=await readFile(new URL(name,site),'utf8');
 for(const marker of ['DDWLCQ','7815219845393','04831967','109878221581','GUO/SHIHWEI','26KK258524640','郭士煒','QAPI 是什麼？','Where does the 85.8% come from?'])assert.ok(!text.includes(marker),`Private data leaked in ${name}`);
}
const html=await readFile(new URL('index.html',site),'utf8');
assert.match(html,/Content-Security-Policy/);assert.match(html,/type="password"/);
console.log('PASS: public bundle contains encrypted data only; crypto format and login policy checked.');
