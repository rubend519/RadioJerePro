const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync('src/app.js','utf8');
const code = src.slice(src.indexOf('function stationLogoFallback('),src.indexOf('function stationCard('));
const context = vm.createContext({stationLogos:{saved:'/media/stations/test.png'}});
vm.runInContext(code,context);
assert.equal(context.stationLogo({stationuuid:'saved',favicon:'https://old.invalid/logo.png'}),'/media/stations/test.png');
assert.ok(decodeURIComponent(context.stationLogoFallback({name:'Radio Bermeja'})).includes('>RB</text>'));
const markup = context.stationLogoHTML({name:'A "quote"',favicon:'https://example.com/"x'});
assert.ok(markup.includes('&quot;'));
assert.ok(markup.includes('loading="lazy"'));
const stations=JSON.parse(fs.readFileSync('stations.json','utf8')).stations;
let count=0;
for(const s of stations) {
 if(s.favicon && s.favicon.startsWith('/media/stations/')) {
  assert.ok(fs.existsSync('.'+s.favicon),s.name+' asset exists'); count++;
 }
}
console.log('Logo fallback and saved favorites checks passed; local references:',count);
