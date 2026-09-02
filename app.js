const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAitElEQVR4nI2beYwk133fP++9uvrunmPn2J29l0sud0VSXK5IUbREHZasw7KU2JFtGImdwHBg/+HAjuM/EgQ5EOREDiAGDEOxFVimLUsgTMuUKculusWKkeK6W597cY3Zmdu6evup67+WPquruofxJeDnTS9VdVe93f3/HE3sO3mWFEAhACImQ2f8Igdj1K5FSAAKEQAox+o6U2S8AY+eEGB5ntynyotwghsJbRy2Z/LDb/H6w12XesJXuzYA3W2vwzgzU2P7bZ9Sa7xhoDWIwdfZ5dn72b/PuSfNnkayseNiRkSES2SJvxJvsz/jt+k/zYFqfGX8IiGradOGOSKAYC1WK1zKeD5K8XiV0WpSKLThJj50mY+ZpTq6m8qWdK8iP43+s5eY9EwZp0AAAAAElFTkSuQmCC';
const audio = document.getElementById('audioPlayer');
let currentStation = null, playing = false;
let favorites = JSON.parse(localStorage.getItem('rjp_favs')||'[]');
let favStore = JSON.parse(localStorage.getItem('rjp_favstore')||'{}');

const COLOMBIA_CURADA = [
  {stationuuid:'co-001',name:'Radioacktiva 97.9 FM',url:'https://16613.live.streamtheworld.com/RADIO_ACTIVAAAC.aac',country:'Colombia',state:'Bogotá',tags:'rock',favicon:'https://www.radioacktiva.com/wp-content/uploads/2020/07/favicon-32x32.png'},
  {stationuuid:'co-002',name:'Tropicana Bogotá 102.9 FM',url:'https://playerservices.streamtheworld.com/api/livestream-redirect/TROPICANAAAC.aac',country:'Colombia',state:'Bogotá',tags:'tropical,salsa'},
  {stationuuid:'co-003',name:'Caracol Radio Bogotá',url:'https://playerservices.streamtheworld.com/api/livestream-redirect/CARACOL_RADIOAAC.aac',country:'Colombia',state:'Bogotá',tags:'news'},
  {stationuuid:'co-019',name:'El Sol Bucaramanga 103.7 FM',url:'https://co-e7-p-e-cl2-audio.cdn.mdstrm.com/live-audio-aw/632cc5d948f73909a614ab93/playlist.m3u8',country:'Colombia',state:'Bucaramanga',tags:'salsa'},
  {stationuuid:'co-fundingue',name:'Fundingue Vallenato',url:'https://s1-ssl.vpsradio.com/listen/fundingue/radio.mp3',country:'Colombia',state:'Nacional',tags:'vallenato'},
  {stationuuid:'co-yariguies',name:'Yariguies Stereo 102.7 FM',url:'https://estructuraweb.com.co:9339/stream',country:'Colombia',state:'Barrancabermeja',tags:'noticias,pop'},
  {stationuuid:'co-guapachosa',name:'La Guapachosa',url:'https://radiolatina.info:8184/stream',country:'Colombia',state:'Bucaramanga',tags:'tropical,popular'}
];

let globalStations = [...COLOMBIA_CURADA];

const CONTINENTS = {
  'América': ['Colombia','Mexico','Argentina','Brazil','United States'],
  'Europa': ['Spain','France','Germany','Italy','United Kingdom'],
  'Asia': ['Japan','South Korea','China','India']
};

document.getElementById('logoImg').src = ICON;
document.getElementById('pLogoImg').src = ICON;

function initApp() {
  renderDestacadas();
  renderContinents();
  renderGlobalStations(COLOMBIA_CURADA);
  fetchRadioBrowser();
}

async function fetchRadioBrowser() {
  try {
    const res = await fetch('https://de1.api.radio-browser.info/json/stations/topvote?limit=100');
    const data = await res.json();
    if(Array.isArray(data)) {
      globalStations = [...COLOMBIA_CURADA, ...data];
      renderGlobalStations(globalStations);
    }
  } catch(e) {}
}

function renderDestacadas() {
  const el = document.getElementById('destacadasScroll');
  el.innerHTML = COLOMBIA_CURADA.map(s => `
    <div class="d-card" onclick="playStation('${s.stationuuid}')">
      <div class="d-logo"><img src="${s.favicon||ICON}" onerror="this.src='${ICON}'"></div>
      <div class="d-name">${s.name}</div>
      <div class="d-sub">${s.state}</div>
    </div>
  `).join('');
}

function renderContinents() {
  const scroll = document.getElementById('contScroll');
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
  grid.innerHTML = countries.map(c => `
    <div class="country-card" onclick="filterByCountry('${c}')">
      <div class="country-name">${c}</div>
      <div class="country-count">Ver emisoras</div>
    </div>
  `).join('');
}

async function filterByCountry(countryName) {
  document.getElementById('stResultTitle').textContent = `Emisoras de ${countryName}`;
  const filtered = globalStations.filter(s => s.country && s.country.toLowerCase() === countryName.toLowerCase());
  renderGlobalStations(filtered.length ? filtered : globalStations);
}

function renderGlobalStations(stations) {
  const el = document.getElementById('globalStationsList');
  el.innerHTML = stations.slice(0, 50).map(s => {
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
          <button class="btn-fav ${isFav?'active':''}" onclick="toggleFav('${s.stationuuid}', this)">${isFav?'★':'☆'}</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterGlobalStations() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = globalStations.filter(s => 
    s.name.toLowerCase().includes(q) || 
    (s.tags && s.tags.toLowerCase().includes(q)) ||
    (s.country && s.country.toLowerCase().includes(q))
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
  audio.play().catch(e => console.log('Autoplay protegido'));

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

function toggleFav(uuid, btn) {
  const idx = favorites.indexOf(uuid);
  if(idx >= 0) {
    favorites.splice(idx, 1);
    btn.textContent = '☆'; btn.classList.remove('active');
    delete favStore[uuid];
  } else {
    favorites.push(uuid);
    btn.textContent = '★'; btn.classList.add('active');
    const s = globalStations.find(x => x.stationuuid === uuid) || COLOMBIA_CURADA.find(x => x.stationuuid === uuid);
    if(s) favStore[uuid] = s;
  }
  localStorage.setItem('rjp_favs', JSON.stringify(favorites));
  localStorage.setItem('rjp_favstore', JSON.stringify(favStore));
  if(document.getElementById('page-favglobal').classList.contains('active')) renderFavGlobal();
}

function renderFavGlobal() {
  const el = document.getElementById('favGlobalList');
  const favs = favorites.map(id => favStore[id]).filter(Boolean);
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
        <button class="btn-fav active" onclick="toggleFav('${s.stationuuid}', this)">★</button>
      </div>
    </div>
  `).join('');
}

function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  if(btn) btn.classList.add('active');
  if(pageId === 'favglobal') renderFavGlobal();
}

initApp();