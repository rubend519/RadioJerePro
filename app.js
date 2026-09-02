const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAitElEQVR4nI2beYwk133fP++9uvrunmPn2J29l0sud0VSXK5IUbREHZasw7KU2JFtGImdwHBg/+HAjuM/EgQ5EOREDiAGDEOxFVimLUsgTMuUKculusWKkeK6W597cY3Zmdu6evup67+WPquruofxJeDnTS9VdVe93f3/HE3sO3mWFEAhACImQ2f8Igdj1K5FSAAKEQAox+o6U2S8AY+eEGB5ntynyotwghsJbRy2Z/LDb/H6w12XesJXuzYA3W2vwzgzU2P7bZ9Sa7xhoDWIwdfZ5dn72b/PuSfNnkayseNiRkSES2SJvxJvsz/jt+k/zYFqfGX8IiGradOGOSKAYC1WK1zKeD5K8XiV0WpSKLThJj50mY+ZpTq6m8qWdK8iP43+s5eY9EwZp0AAAAAElFTkSuQmCC';
const audio = document.getElementById('audioPlayer');
let currentStation = null, playing = false;
let favorites = JSON.parse(localStorage.getItem('rjp_favs')||'[]');
let favStore = JSON.parse(localStorage.getItem('rjp_favstore')||'{}');

const CONTINENTS = {
  'América': ['Colombia','Mexico','Argentina','Brazil','United States','Chile','Peru'],
  'Europa': ['Spain','France','Germany','Italy','United Kingdom','Portugal'],
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
  renderContinents();
  searchStationsApi('', 'Colombia'); // Carga inicial por defecto con Colombia
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
      <div class="country-count">Explorar</div>
    </div>
  `).join('');
}

function filterByCountry(countryName) {
  const title = document.getElementById('stResultTitle');
  if(title) title.textContent = `Emisoras de ${countryName}`;
  searchStationsApi('', countryName);
}

// Barrido directo a la API gratuita de Radio Browser por nombre, país o género
async function searchStationsApi(query = '', country = '') {
  const el = document.getElementById('globalStationsList');
  if(el) el.innerHTML = '<div class="loading-box"><div class="spinner"></div>Buscando emisoras...</div>';
  
  try {
    let url = 'https://de1.api.radio-browser.info/json/stations/search?limit=100';
    if(query) url += `&name=${encodeURIComponent(query)}`;
    if(country) url += `&country=${encodeURIComponent(country)}`;

    const res = await fetch(url);
    const data = await res.json();
    
    if(Array.isArray(data)) {
      renderStations(data);
    } else {
      if(el) el.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">No se encontraron emisoras.</div>';
    }
  } catch(e) {
    if(el) el.innerHTML = '<div style="color:var(--accent);padding:20px;text-align:center">Error al conectar con la API gratuita.</div>';
  }
}

// Búsqueda en tiempo real con retraso (debounce)
let searchTimer;
function filterGlobalStations() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = document.getElementById('searchInput').value.trim();
    if(q.length > 0) {
      document.getElementById('stResultTitle').textContent = `Resultados para: "${q}"`;
      searchStationsApi(q, '');
    } else {
      searchStationsApi('', 'Colombia');
    }
  }, 400);
}

function renderStations(stations) {
  const el = document.getElementById('globalStationsList');
  if(!el) return;
  
  if(!stations.length) {
    el.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">Sin resultados.</div>';
    return;
  }

  el.innerHTML = stations.map(s => {
    const isFav = favorites.includes(s.stationuuid);
    return `
      <div class="scard" id="card-${s.stationuuid}">
        <div class="scard-logo"><img src="${s.favicon||ICON}" onerror="this.src='${ICON}'"></div>
        <div class="scard-info" onclick="playStation('${s.stationuuid}')">
          <div class="scard-name">${s.name}</div>
          <div class="scard-meta">${s.country || ''} ${s.state ? '· '+s.state : ''} ${s.tags ? '· '+s.tags.split(',')[0] : ''}</div>
        </div>
        <div class="scard-actions">
          <button class="btn-play" onclick="playStation('${s.stationuuid}')">▶</button>
          <button class="btn-fav ${isFav?'active':''}" onclick="toggleFav('${s.stationuuid}', event, ${JSON.stringify(s).replace(/"/g, '&quot;')})">${isFav?'★':'☆'}</button>
        </div>
      </div>
    `;
  }).join('');
}

// Almacenamos temporalmente las emisoras cargadas para reproducción y favoritos
let activeStationsMap = {};

function playStation(uuid) {
  // Intentamos obtener la emisora del mapa actual o favoritos
  let s = activeStationsMap[uuid] || favStore[uuid];
  if(!s) {
    // Si no está en memoria, la buscamos directamente haciendo una petición rápida a la API por UUID
    fetch(`https://de1.api.radio-browser.info/json/stations/byuuid?uuids=${uuid}`)
      .then(res => res.json())
      .then(data => {
        if(data && data[0]) {
          playAudioData(data[0]);
        }
      });
    return;
  }
  playAudioData(s);
}

function playAudioData(s) {
  currentStation = s;
  playing = true;
  
  audio.src = s.url_resolved || s.url;
  audio.load();
  audio.play().catch(e => console.log('Reproducción bloqueada'));

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

function toggleFav(uuid, event, stationObj) {
  if(event) event.stopPropagation();
  const idx = favorites.indexOf(uuid);
  
  if(idx >= 0) {
    favorites.splice(idx, 1);
    delete favStore[uuid];
  } else {
    if(stationObj) {
      favorites.push(uuid);
      favStore[uuid] = stationObj;
      activeStationsMap[uuid] = stationObj;
    }
  }
  localStorage.setItem('rjp_favs', JSON.stringify(favorites));
  localStorage.setItem('rjp_favstore', JSON.stringify(favStore));
  
  // Refrescar vistas
  if(document.getElementById('page-explorar').classList.contains('active')) {
    // Re-renderizamos para actualizar estrellas
    const q = document.getElementById('searchInput').value;
    if(!q) searchStationsApi('', 'Colombia');
  }
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
        <button class="btn-fav active" onclick="toggleFav('${s.stationuuid}', event, ${JSON.stringify(s).replace(/"/g, '&quot;')})">★</button>
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