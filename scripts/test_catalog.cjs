const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/app.js','utf8');
const funcs = source.slice(source.indexOf('function searchKey('),source.indexOf('function renderCityFilter('));
const ctx = vm.createContext({}); vm.runInContext(funcs,ctx);
const stations = [
 {stationuuid:'a', name:'Radio Nacional de Colombia Bogotá',state:'Bogotá',url:'https://a'},
 {stationuuid:'b', name:'Radio Nacional de Colombia Medellín',state:'Medellín',url:'https://b'},
 {stationuuid:'c', name:'Radio Nacional de Colombia Cali',state:'Cali',url:'https://a'},
 {stationuuid:'a', name:'Radio Nacional de Colombia Bogotá',state:'Bogotá',url:'https://a'},
 {stationuuid:'d', name:'Otro nombre',state:'Bogotá',url:'https://a'}
];
assert.equal(ctx.filterUniqueStations(stations).length,3,'preserve affiliates, remove same-city duplicates');
assert.equal(ctx.searchKey('Bogotá CÚCUTA'), 'bogota cucuta');
const catalog=JSON.parse(fs.readFileSync('stations.json','utf8'));
assert.equal(new Set(catalog.stations.map(s=>s.stationuuid)).size,catalog.stations.length,'unique station IDs');
assert.equal(catalog._meta.total,catalog.stations.length);
assert.ok(catalog.stations.find(s=>s.stationuuid==='co-022' && s.state==='Barrancabermeja'));
console.log('Catalog and deduplication checks passed');
