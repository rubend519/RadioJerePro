const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const publicSource=fs.readFileSync('community.js','utf8');
const adminSource=fs.readFileSync('community-admin.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function elements(){const els={};return {els,get:id=>els[id]||(els[id]={value:'',checked:true,textContent:'',hidden:false,disabled:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}})};}
const initial={greeting:'¡Hola Colombia! 👋',thanks:'Gracias 💜',showGreeting:true,showThanks:true};
async function publicTest(data){const dom=elements();vm.runInNewContext(publicSource,{document:{getElementById:dom.get},fetch:async()=>({ok:true,json:async()=>data}),Date});await tick();return dom;}
async function adminTest(login,remote=initial){const dom=elements(),calls=[];const context={document:{getElementById:dom.get},ghConfig:{token:'test-only'},Date,JSON,Object,String,Error,encodeURIComponent,decodeURIComponent,escape,unescape,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),fetch:async(url,options={})=>{calls.push({url,options});if(url.startsWith('/community.json'))return{ok:true,json:async()=>initial};if(url.endsWith('/user'))return{ok:true,json:async()=>({login})};if(options.method==='PUT')return{ok:true};return{ok:true,json:async()=>({sha:'old-version',content:Buffer.from(JSON.stringify(remote),'utf8').toString('base64')})}}};vm.runInNewContext(adminSource,context);await tick();dom.get('communityGreeting').value='¡Saludos desde España!';await dom.get('communitySave').listeners.click();return{dom,calls};}
(async()=>{
 let d=await publicTest({...initial,greeting:'<img src=x onerror=alert(1)>'});assert.equal(d.get('rjCommunityGreetingText').textContent,'<img src=x onerror=alert(1)>');assert.equal(d.get('rjCommunity').hidden,false);
 d=await publicTest({...initial,showGreeting:false,showThanks:false});assert.equal(d.get('rjCommunity').hidden,true);
 let t=await adminTest('someone-else');assert.ok(!t.calls.some(c=>c.options.method==='PUT'),'other users cannot publish through admin');
 t=await adminTest('rubend519',{...initial,greeting:'Changed elsewhere'});assert.ok(!t.calls.some(c=>c.options.method==='PUT'),'stale edit cannot overwrite another device');
 t=await adminTest('rubend519');const put=t.calls.find(c=>c.options.method==='PUT');assert.ok(put);const body=JSON.parse(put.options.body);assert.equal(body.sha,'old-version');assert.equal(JSON.parse(Buffer.from(body.content,'base64').toString('utf8')).greeting,'¡Saludos desde España!');assert.equal(body.branch,'main');
 console.log('Messages: safe public rendering, hide controls, owner validation, concurrent edits and Unicode publication passed');
})().catch(e=>{console.error(e);process.exit(1)});
