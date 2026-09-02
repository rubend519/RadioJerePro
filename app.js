const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAitElEQVR4nI2beYwk133fP++9uvrunmPn2J29l0sud0VSXK5IUbREHZasw7KU2JFtGImdwHBg/+HAjuM/EgQ5EOREDiAGDEOxFVimLUsgTMuUKculusWKkeK6W597cY3Zmdu6evup67+WPquruofxJeDnTS9VdVe93f3/HE3sO3mWFEAhACImQ2f8Igdj1K5FSAAKEQAox+o6U2S8AY+eEGB5ntynyotwghsJbRy2Z/LDb/H6w12XesJXuzYA3W2vwzgzU2P7bZ9Sa7xhoDWIwdfZ5dn72b/PuSfNnkayseNiRkSES2SJvxJvsz/jt+k/zYFqfGX8IiGradOGOSKAYC1WK1zKeD5K8XiV0WpSKLThJj50mY+ZpTq6m8qWdK8iP43+s5eY9EwZp0AAAAAElFTkSuQmCC';
const audio = document.getElementById('audioPlayer');
let currentStation = null, playing = false;
let favorites = JSON.parse(localStorage.getItem('rjp_favs')||'[]');
let favStore = JSON.parse(localStorage.getItem('rjp_favstore')||'{}');

// Enlaces nuevos y emisoras principales solicitadas
const COLOMBIA_CURADA = [
  {stationuuid:'el-sol-med', name:'El Sol 107.9 FM Medellín', url:'https://co-e7-p-e-cl2-audio.cdn.mdstrm.com/live-audio-aw/632c9d30aa9ace684913b853/playlist.m3u8', country:'Colombia', state:'Medellín', tags:'salsa,tropical'},
  {stationuuid:'el-sol-cali', name:'El Sol 106.5 FM Cali', url:'https://co-e7-p-e-cl2-audio.cdn.mdstrm.com/live-audio-aw/632c9d30aa9ace684913b853/playlist.m3u8', country:'Colombia', state:'Cali', tags:'salsa,tropical'},
  {stationuuid:'el-sol-sma', name:'El Sol Santa Marta', url:'https://co-e7-p-e-cl2-audio.cdn.mdstrm.com/live-audio-aw/632ce8986d2e8108b23d249f/playlist.m3u8', country:'Colombia', state:'Santa Marta', tags:'salsa'},
  {stationuuid:'el-sol-bga', name:'El Sol Bucaramanga 103.7 FM', url:'https://co-e7-p-e-cl2-audio.cdn.mdstrm.com/live-audio-aw/632cc5d948f73909a614ab93/playlist.m3u8', country:'Colombia', state:'Bucaramanga', tags:'salsa'},
  {stationuuid:'fundingue', name:'Fundingue Vallenato', url:'https://s1-ssl.vpsradio.com/listen/fundingue/radio.mp3', country:'Colombia', state:'Nacional', tags:'vallenato'},
  {stationuuid:'yariguies', name:'Yariguies Stereo 102.7 FM', url:'https://estructuraweb.com.co:9339/stream', country:'Colombia', state:'Barrancabermeja', tags:'noticias,pop'},
  {stationuuid:'guapachosa', name:'La Guapachosa', url:'https://radiolatina.info:8184/stream', country:'Colombia', state:'Bucaramanga', tags:'tropical,popular'},
  {stationuuid:'co-001', name:'Radioacktiva 97.9 FM', url:'https://16613.live.streamtheworld.com/RADIO_ACTIVAAAC.aac', country:'Colombia', state:'Bogotá', tags:'rock'},
  {stationuuid:'co-002', name:'Tropicana Bogotá 102.9 FM', url:'https://playerservices.streamtheworld.com/api/livestream-redirect/TROPICANAAAC.aac', country:'Colombia', state:'Bogotá', tags:'tropical,salsa'},
  {stationuuid:'co-003', name:'Caracol Radio Bogotá', url:'https://playerservices.streamtheworld.com/api/livestream-redirect/CARACOL_RADIOAAC.aac', country:'Colombia', state:'Bogotá', tags:'news'}
];

let globalStations = [...COLOMBIA_CURADA];

const CONTINENTS = {
  'América': ['Colombia','Mexico','Argentina','Brazil','United States'],
  'Europa': ['Spain','France','Germany','Italy','United Kingdom'],
  'Asia': ['Japan','South Korea','China','India']
};

const THEMES = {
  'Noche Azul':{emoji:'🌙',bg:'#0a0a12',bg2:'#12121e',bg3:'#1a1a2e',bg4:'#1f1f35',accent:'#e94560',text:'#f0f0f8',text2:'#8899bb',text3:'#4a5070',card:'#161625'},
  'Océano':    {emoji:'🌊',bg:'#060d1a',bg2:'#0a1628',bg3:'#0f2040',bg4:'#142850',accent:'#00bcd4',text:'#e8f4f8',text2:'#7baabf',text3:'#3a607a',card:'#0c1830'},
  'Bosque':    {emoji:'🌲',bg:'#060f06',bg2:'#0d180d',bg3:'#142414',bg4:'#1a2e1a',accent:'#4caf50',text:'#d4e8d4',text2:'#7aaa7a',text3:'#3a6a3a',card:'#0f1a0f'},
  'Carbón':    {emoji:'🔥',bg:'#0e0e0e',bg2:'#1a1a1a',bg3:'#222',bg4:'#2a2a2a',accent:'#ff3d00',text:'#f0f0f0',text2:'#999',text3:'#555',card:'#161616'},
  'Rosa':      {emoji:'🌸',bg:'#0e040e',bg2:'#180a18',bg3:'#220e22',bg4:'#2e142e',accent:'#e040fb',text:'#f8e8f8',text2:'#c080c0',text3:'#7a4a7a',card:'#140a14'},
  'Día Claro': {emoji:'☀️',bg:'#f0f2f5',bg2:'#ffffff',bg3:'#e8eaf0',bg4:'#dde0ea',accent:'#1565c0',text:'#1a1a2e',text2:'#556080',text3:'#8896b0',card:'#ffffff'},
};
let currentTheme = localStorage.getItem('rjp_theme') || 'Noche Azul';

function applyTheme(n){
  const t = THEMES[n]; if(!t) return;
  currentTheme = n; localStorage.setItem('rjp_theme', n);
  const r = document.documentElement.style;
  ['bg','bg2','bg3','bg4','accent','text','text2','text3','card'].forEach(k => r.setProperty('--'+k, t[k]));
  document.querySelectorAll('.theme-opt').forEach(o => o.classList.toggle('active', o.dataset.theme===n));
}

function buildThemeGrid(){
  const grid = document.getElementById('themeGrid');
  if(!grid) return;
  grid.innerHTML = Object.entries(THEMES).map(([n,t]) =>
    `<div class="theme-opt${n===currentTheme?' active':''}" data-theme="${n}" onclick="applyTheme('${n}')">
      <div class="theme-swatch" style="background:${t.bg};border:2px solid ${t.accent}">${t.emoji}</div>
      <div class="theme-label">${n}</div></div>`).join('');
}
function openTheme(){ buildThemeGrid(); document.getElementById('themePanel').classList.add('open'); }
function closeTheme(){ document.getElementById('themePanel').classList.remove('open'); }

document.getElementById('logoImg').src = ICON;
document.getElementById('pLogoImg').src = ICON;

function initApp() {
  applyTheme(currentTheme);
  renderDestacadas();
  renderContinents();
  renderGlobalStations(COLOMBIA_CURADA);
  fetchRadioBrowser();
}

// Carga masiva gratuita de miles de emisoras mundiales desde Radio Browser API
async function fetchRadioBrowser() {
  try {
    const res = await fetch('https://de1.api.radio-browser.info/json/stations/topvote?limit=500');
    const data = await res.json();
    if(Array.isArray(data)) {
      // Unificamos las curadas prioritarias con las globales de la API
      globalStations = [...COLOMBIA_CURADA, ...data];
      renderGlobalStations(globalStations);
    }
  } catch(e) {
    console.log('Usando emisoras locales de respaldo');
  }
}

function renderDestacadas() {
  const el = document.getElementById('destacadasScroll');
  if(!el) return;
  el.innerHTML = COLOMBIA_CURADA.map(s => `
    <div class="d-card" onclick="playStation('${s.stationuuid}')" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px;width:130px;text-align:center;cursor:pointer;flex-shrink:0">
      <div class="d-logo" style="width:45px;height:45px;border-radius:50%;background:var(--bg3);margin:0 auto 6px;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${s.favicon||ICON}" onerror="this.src='${ICON}'" style="width:100%;height:100%;object-fit:cover"></div>
      <div class="d-name" style="font-family:'Syne',sans-serif;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
      <div class="d-sub" style="font-size:9px;color:var(--text2)">${s.state}</div>
    </div>
  `).join('');
}

function renderContinents() {
  const scroll = document.getElementById('contScroll');
  if(!scroll) return;
  scroll.innerHTML = Object.keys(CONTINENTS).map((c, idx) => `
    <button class="cont-btn ${idx===0?'active':''}" onclick="selectContinent('${c}', this)">${c}</button>
  `).join('');
  selectContinent('América', scroll.querySelector('.cont-btn'));
}

function selectContinent(continent, btn) {
  document.querySelectorAll('.cont-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const countries = CONTINENTS[continent] || [];
  const grid = document.getElementById('countryGrid');
  if(!grid) return;
  grid.innerHTML = countries.map(c => `
    <div class="country-card" onclick="filterByCountry('${c}')">
      <div class="country-name">${c}</div>
      <div class="country-count">Ver emisoras</div>
    </div>
  `).join('');
}

async function filterByCountry(countryName) {
  const title = document.getElementById('stResultTitle');
  if(title) title.textContent = `Emisoras de ${countryName}`;
  const filtered = globalStations.filter(s => s.country && s.country.toLowerCase() === countryName.toLowerCase());
  renderGlobalStations(filtered.length ? filtered : globalStations);
}

function renderGlobalStations(stations) {
  const el = document.getElementById('globalStationsList');
  if(!el) return;
  el.innerHTML = stations.slice(0, 100).map(s => {
    const isFav = favorites.includes(s.stationuuid);
    return `
      <div class="scard" id="card-${s.stationuuid}">
        <div class="scard-logo"><img src="${s.favicon||ICON}" onerror="this.src='${ICON}'"></div>
        <div class="scard-info" onclick="playStation('${s.stationuuid}')">
          <div class="scard-name">${s.name}</div>
          <div class="scard-meta">${s.country || 'Global'} · ${s.state || ''}</div>
        </div>
        <div class="scard-actions">
          <button class="btn-play" onclick="playStation('${s.stationuuid}')">▶</button>
          <button class="btn-fav ${isFav?'active':''}" onclick="toggleFav('${s.stationuuid}', event)">${isFav?'★':'☆'}</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterGlobalStations() {
  const input = document.getElementById('searchInput');
  if(!input) return;
  const q = input.value.toLowerCase();
  const filtered = globalStations.filter(s => 
    s.name.toLowerCase().includes(q) || 
    (s.tags && s.tags.toLowerCase().includes(q)) ||
    (s.country && s.country.toLowerCase().includes(q)) ||
    (s.state && s.state.toLowerCase().includes(q))
  );
  renderGlobalStations(filtered);
}

function playStation(uuid) {
  let s = globalStations.find(x => x.stationuuid === uuid) || COLOMBIA_CURADA.find(x => x.stationuuid === uuid);
  if(!s) return;
  currentStation = s;
  playing = true;
  
  audio.src = s.url_resolved || s.url;
  audio.load();
  audio.play().catch(e => console.log('Autoplay bloqueado por navegador'));

  document.getElementById('pName').textContent = s.name;
  document.getElementById('pStatus').textContent = `🔴 EN VIVO · ${s.state || s.country || 'Radio'}`;
  const img = document.getElementById('pLogoImg');
  img.src = s.favicon || ICON;
}

function stopRadio() {
  audio.pause();
  playing = false;
  document.getElementById('pName').textContent = 'Selecciona una emisora';
  document.getElementById('pStatus').textContent = 'Radio Jere Pro · En vivo';
}

function toggleFav(uuid, event) {
  if(event) event.stopPropagation();
  const idx = favorites.indexOf(uuid);
  
  // Buscamos la emisora en la lista global o curada para asegurarnos de guardarla en el almacén
  let s = globalStations.find(x => x.stationuuid === uuid) || COLOMBIA_CURADA.find(x => x.stationuuid === uuid);
  
  if(idx >= 0) {
    favorites.splice(idx, 1);
    delete favStore[uuid];
  } else {
    if(s) {
      favorites.push(uuid);
      favStore[uuid] = s;
    }
  }
  localStorage.setItem('rjp_favs', JSON.stringify(favorites));
  localStorage.setItem('rjp_favstore', JSON.stringify(favStore));
  
  // Actualizamos vistas de listas actuales y favoritos
  renderGlobalStations(globalStations);
  if(document.getElementById('page-favglobal').classList.contains('active')) {
    renderFavGlobal();
  }
}

function renderFavGlobal() {
  const el = document.getElementById('favGlobalList');
  if(!el) return;
  const favs = favorites.map(id => favStore[id]).filter(Boolean);
  const countEl = document.getElementById('favGlobalCount');
  if(countEl) countEl.textContent = favs.length + ' emisoras';
  
  if(!favs.length) {
    el.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">No tienes favoritos guardados aún. Toca ☆ en cualquier emisora.</div>';
    return;
  }
  el.innerHTML = favs.map(s => `
    <div class="scard">
      <div class="scard-logo"><img src="${s.favicon||ICON}" onerror="this.src='${ICON}'"></div>
      <div class="scard-info" onclick="playStation('${s.stationuuid}')">
        <div class="scard-name">${s.name}</div>
        <div class="scard-meta">${s.state || s.country || ''}</div>
      </div>
      <div class="scard-actions">
        <button class="btn-play" onclick="playStation('${s.stationuuid}')">▶</button>
        <button class="btn-fav active" onclick="toggleFav('${s.stationuuid}', event)">★</button>
      </div>
    </div>
  `).join('');
}

function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  if(btn) btn.classList.add('active');
  if(pageId === 'favglobal') renderFavGlobal();
}

initApp();