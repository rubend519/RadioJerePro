const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
let stored=null,writes=0;
const defaults=JSON.parse(fs.readFileSync('community.json','utf8'));
const env={RJP_ADMIN_PASSWORD_SHA256:crypto.createHash('sha256').update('test-password-only').digest('hex')};
const context={exports:{},process:{env},Buffer,URL,Date,require(name){if(name==='@netlify/blobs')return{connectLambda(){},getStore(){return{get:async()=>stored,setJSON:async(k,v)=>{stored=v;writes++}}}};if(name==='node:crypto')return crypto;if(name==='../../community.json')return defaults;throw Error(name)}};
vm.runInNewContext(fs.readFileSync('netlify/functions/community.js','utf8'),context);
const handler=context.exports.handler;
function event(method,body,cookie,origin='https://radiojerepro.netlify.app'){return{httpMethod:method,body:typeof body==='string'?body:JSON.stringify(body),headers:{host:'radiojerepro.netlify.app',origin,'content-type':'application/json',cookie:cookie||''},queryStringParameters:{}}}
(async()=>{
 let r=await handler(event('GET'));assert.equal(r.statusCode,200);const initial=JSON.parse(r.body);assert.deepEqual(initial.data,defaults);
 r=await handler(event('PUT',{data:defaults,revision:initial.revision}));assert.equal(r.statusCode,401);assert.equal(writes,0);
 r=await handler(event('POST',{action:'login',password:'wrong'}));assert.equal(r.statusCode,401);assert.ok(!r.headers['Set-Cookie']);
 r=await handler(event('POST',{action:'login',password:'test-password-only'}));assert.equal(r.statusCode,200);const cookie=r.headers['Set-Cookie'].split(';')[0];assert.match(r.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.ok(!r.body.includes('test-password-only'));
 const session=event('GET',null,cookie);session.queryStringParameters.session='1';assert.equal((await handler(session)).statusCode,200);
 assert.equal((await handler(event('PUT',null,cookie))).statusCode,400);
 assert.equal((await handler(event('PUT','broken',cookie))).statusCode,400);
 assert.equal((await handler(event('PUT',{data:defaults,revision:initial.revision},cookie,'https://evil.example'))).statusCode,403);
 assert.equal((await handler(event('PUT',{data:{...defaults,greeting:'x'.repeat(281)},revision:initial.revision},cookie))).statusCode,400);
 assert.equal((await handler(event('PUT',{data:defaults,revision:initial.revision},cookie+'tampered'))).statusCode,401);
 const next={...defaults,greeting:'¡Un abrazo a España! 📻'};
 r=await handler(event('PUT',{data:next,revision:initial.revision},cookie));assert.equal(r.statusCode,200);assert.equal(writes,1);assert.equal(JSON.parse((await handler(event('GET'))).body).data.greeting,next.greeting);
 assert.equal((await handler(event('PUT',{data:defaults,revision:initial.revision},cookie))).statusCode,409);assert.equal(writes,1);
 r=await handler(event('POST',{action:'logout'},cookie));assert.match(r.headers['Set-Cookie'],/Max-Age=0/);
 delete env.RJP_ADMIN_PASSWORD_SHA256;assert.equal((await handler(event('POST',{action:'login',password:'test-password-only'}))).statusCode,503);assert.equal((await handler(event('PUT',{data:defaults},cookie))).statusCode,401);
 const admin=fs.readFileSync('community-admin.js','utf8');assert.ok(!admin.includes('api.github.com'));assert.ok(!admin.includes('ghConfig'));assert.ok(!fs.readFileSync('admin.html','utf8').includes('const ADMIN_PASS'));
 console.log('Direct publishing: private login, secure session, unauthorized writes, origin checks, validation, persistence, conflicts and logout passed');
})().catch(e=>{console.error(e);process.exit(1)});
