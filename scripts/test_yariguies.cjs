const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/app.js','utf8');
const snippet = source.slice(source.indexOf('const YARIGUIES_OFFICIAL_STREAM'), source.indexOf('let retryAttempts ='));
const official = 'https://estructuraweb.com.co:9339/stream';
const retired = ['https://stream.zeno.fm/yariguies','https://19843.live.streamtheworld.com/YARIGUIES_SC'];
const context = {urlOverrides:{},resolvedUrlCache:{'co-022':retired[1]}};
vm.createContext(context);vm.runInContext(snippet,context);
for (const url of retired) {
  assert.equal(context.getEffectiveUrl({stationuuid:'co-022',url,url_resolved:url}),official,'old saved favorites and resolved cache must use official stream');
  context.urlOverrides['co-022']=url;
  assert.equal(context.getEffectiveUrl({stationuuid:'co-022',url}),official,'retired retry overrides must not win');
}
context.urlOverrides['co-022']='https://example.com/custom.mp3';
assert.equal(context.getEffectiveUrl({stationuuid:'co-022'}),'https://example.com/custom.mp3','keep manual custom links');
context.urlOverrides.other='https://example.com/other.mp3';
assert.equal(context.getEffectiveUrl({stationuuid:'other',url:'old'}),context.urlOverrides.other);
const station=JSON.parse(fs.readFileSync('stations.json','utf8')).stations.find(s=>s.stationuuid==='co-022');
assert.equal(station.url,official);assert.ok(!station.url_resolved);assert.equal(station.homepage,'https://yariguies.com/');
console.log('Yariguies: catalog, saved favorites, cache and manual overrides passed');
