const assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/app.js','utf8');
const migration=source.slice(source.indexOf('const DEFAULT_ANCHORED ='),source.indexOf('/* RJ_HOME_PINS_RELEASE_20261019_V1'));
function run(data={}) {const store={...data};vm.runInNewContext(migration,{localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v},console});return store;}
let s=run(); assert.ok(JSON.parse(s.rjp_anchored).includes('co-038')); assert.ok(!JSON.parse(s.rjp_anchored).includes('co-036'));
s=run({rjp_anchored:JSON.stringify(['my-radio','co-036']),rjp_anchor_store:JSON.stringify({'co-038':{name:'outdated'},'my-radio':{name:'Mine'}})});
assert.deepEqual(JSON.parse(s.rjp_anchored),['my-radio','co-036','co-038']);assert.ok(JSON.parse(s.rjp_anchor_store)['my-radio']);assert.ok(!JSON.parse(s.rjp_anchor_store)['co-038']);
s.rjp_anchored=JSON.stringify(['my-radio']);s=run(s);assert.deepEqual(JSON.parse(s.rjp_anchored),['my-radio'],'do not repin after an explicit later unpin');
s=run({rjp_anchored:'broken'});assert.ok(JSON.parse(s.rjp_anchored).includes('co-038'));
const catalog=JSON.parse(fs.readFileSync('stations.json','utf8')).stations;
const fundingue=catalog.find(s=>s.stationuuid==='co-038');assert.equal(fundingue.name,'Radio Fundingue');assert.equal(fundingue.homepage,'https://fundingue.co/');assert.ok(fundingue.url.startsWith('https://'));assert.ok(fs.existsSync('.'+fundingue.favicon));assert.ok((fundingue.name+' '+fundingue.tags).toLowerCase().includes('fundingue.co'));
console.log('Fundingue default pin, migration and search metadata checks passed');
