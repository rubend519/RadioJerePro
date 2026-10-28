(function () {
  'use strict';
  var original = null;
  var revision = null;
  var save = document.getElementById('communitySave');
  var status = document.getElementById('communityStatus');
  var greeting = document.getElementById('communityGreeting');
  var thanks = document.getElementById('communityThanks');
  function normalize(data) {
    return { greeting: typeof data.greeting === 'string' ? data.greeting : '', thanks: typeof data.thanks === 'string' ? data.thanks : '', showGreeting: data.showGreeting !== false, showThanks: data.showThanks !== false };
  }
  function read() {
    return { greeting: greeting.value.trim(), thanks: thanks.value.trim(), showGreeting: document.getElementById('communityShowGreeting').checked, showThanks: document.getElementById('communityShowThanks').checked };
  }
  var renderPreview = window.RJCreateTicker(document.getElementById('communityLedPreview'));
  function preview() {
    renderPreview(read());
    [greeting, thanks].forEach(function (field) { document.getElementById(field.id + 'Count').textContent = field.value.length + ' / ' + field.maxLength; });
  }
  var activeField = greeting;
  var picker = document.getElementById('communityEmojiPicker');
  var target = document.getElementById('communityEmojiTarget');
  [greeting, thanks].forEach(function (field) {
    field.addEventListener('focus', function () { activeField = field; target.textContent = 'Insertar en: ' + (field === greeting ? 'Saludos generales y personalizados' : 'Agradecimiento'); });
  });
  [greeting, thanks].forEach(function (field) {
    document.getElementById(field.id + 'Emojis').addEventListener('click', function () {
      activeField = field;
      target.textContent = 'Insertar en: ' + (field === greeting ? 'Saludos generales y personalizados' : 'Agradecimiento');
      picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('communityEmojiSearch').focus({ preventScroll: true });
    });
  });
  var categories = {
    'Favoritos': [['👋','saludo hola'],['📻','radio'],['🎶','música'],['💜','corazón morado'],['✨','brillo'],['🥳','fiesta'],['🙏','gracias'],['🫶','cariño'],['🌎','mundo'],['🔥','fuego'],['😎','cool'],['⭐','estrella']],
    'Banderas': [['🇨🇴','Colombia'],['🇪🇸','España'],['🇻🇪','Venezuela'],['🇪🇨','Ecuador'],['🇵🇪','Perú'],['🇲🇽','México'],['🇦🇷','Argentina'],['🇨🇱','Chile'],['🇧🇷','Brasil'],['🇺🇸','Estados Unidos'],['🇨🇦','Canadá'],['🇬🇧','Reino Unido'],['🇫🇷','Francia'],['🇩🇪','Alemania'],['🇮🇹','Italia'],['🇵🇹','Portugal'],['🇵🇦','Panamá'],['🇨🇷','Costa Rica'],['🇩🇴','República Dominicana'],['🇵🇷','Puerto Rico'],['🇺🇾','Uruguay'],['🇧🇴','Bolivia'],['🇵🇾','Paraguay'],['🇦🇺','Australia']],
    'Música': [['🎵','nota'],['🎶','notas'],['🎧','audífonos'],['🎤','micrófono'],['🎸','guitarra'],['🥁','tambor'],['🎹','piano'],['🎷','saxofón'],['🎺','trompeta'],['💃','baile mujer'],['🕺','baile hombre'],['📡','señal']],
    'Cariño': [['❤️','amor rojo'],['💜','corazón morado'],['💛','corazón amarillo'],['💙','corazón azul'],['💚','corazón verde'],['💕','corazones'],['😍','enamorado'],['🥰','cariño'],['🤗','abrazo'],['😘','beso'],['🌹','rosa'],['🙏','gracias']],
    'Fiesta': [['🎉','celebración'],['🎊','confeti'],['🎂','cumpleaños'],['🎁','regalo'],['🎈','globo'],['🥳','fiesta'],['🍰','pastel'],['🥂','brindis'],['👏','aplausos'],['🙌','celebrar'],['🏆','trofeo'],['🚀','cohete']],
    'Símbolos': [['✨','brillos'],['⭐','estrella'],['🌟','estrella brillante'],['🔥','fuego'],['✅','verificado'],['💯','cien'],['🌎','mundo'],['☀️','sol'],['🌙','luna'],['🌈','arcoíris'],['⚡','rayo'],['✦','separador']]
  };
  var category = 'Favoritos';
  var tabs = document.getElementById('communityEmojiTabs');
  var grid = document.getElementById('communityEmojiGrid');
  var search = document.getElementById('communityEmojiSearch');
  function drawEmojis() {
    grid.textContent = '';
    var query = search.value.toLocaleLowerCase();
    var items = query ? Object.keys(categories).reduce(function (all, key) { return all.concat(categories[key]); }, []) : categories[category];
    var seen = {};
    items.forEach(function (item) {
      if (seen[item[0]] || (query && item[1].toLocaleLowerCase().indexOf(query) < 0)) return;
      seen[item[0]] = true;
      var button = document.createElement('button'); button.type = 'button'; window.RJEmojiText(button, item[0]); button.title = item[1]; button.setAttribute('aria-label', 'Insertar ' + item[1]);
      // Keep the text selection while clicking an emoji.
      button.addEventListener('mousedown', function (event) { event.preventDefault(); });
      button.addEventListener('click', function () {
        var start = activeField.selectionStart, end = activeField.selectionEnd;
        if (activeField.value.length - (end - start) + item[0].length > activeField.maxLength) { status.textContent = 'No queda espacio para este emoji. Acorta el mensaje.'; return; }
        activeField.setRangeText(item[0], start, end, 'end'); activeField.focus(); preview();
        status.textContent = 'Emoji añadido al borrador. Pulsa Publicar mensajes para compartirlo.';
      });
      grid.appendChild(button);
    });
    if (!grid.childNodes.length) grid.textContent = 'Sin resultados. Prueba otra palabra.';
    Array.prototype.forEach.call(tabs.children, function (button) { button.setAttribute('aria-pressed', String(button.textContent === category && !query)); });
  }
  Object.keys(categories).forEach(function (name) {
    var button = document.createElement('button'); button.type = 'button'; button.textContent = name;
    button.addEventListener('click', function () { category = name; search.value = ''; drawEmojis(); }); tabs.appendChild(button);
  });
  search.addEventListener('input', drawEmojis); drawEmojis();
  async function load() {
    save.disabled = true;
    status.textContent = 'Cargando mensajes publicados…';
    try {
      var response = await fetch('/.netlify/functions/community?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('No se pudieron cargar los mensajes.');
      var payload = await response.json();
      original = normalize(payload.data);
      revision = payload.revision;
      greeting.value = original.greeting;
      thanks.value = original.thanks;
      document.getElementById('communityShowGreeting').checked = original.showGreeting;
      document.getElementById('communityShowThanks').checked = original.showThanks;
      preview();
      status.textContent = 'Listo para editar. Solo se publicará lo que escribas cuando pulses Publicar mensajes.';
      save.disabled = false;
    } catch (error) { status.textContent = error.message + ' Pulsa Recargar para intentar de nuevo.'; }
  }
  async function publish() {
    var data = read();
    if ((data.showGreeting && !data.greeting) || (data.showThanks && !data.thanks)) {
      status.textContent = 'Escribe el mensaje o desmarca su casilla para ocultarlo.'; return;
    }
    if (data.greeting.length > 280 || data.thanks.length > 1000) {
      status.textContent = 'El saludo admite 280 caracteres y la nota, 1000.'; return;
    }
    save.disabled = true;
    status.textContent = 'Publicando mensaje…';
    try {
      var result = await fetch('/.netlify/functions/community', {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: data, revision: revision })
      });
      var saved = await result.json();
      if (!result.ok) throw new Error(saved.error || 'No se pudo publicar.');
      original = normalize(saved.data);
      revision = saved.revision;
      status.textContent = '✓ Mensajes publicados. Ya están disponibles en Inicio.';
    } catch (error) { status.textContent = error.message || 'No se pudo publicar. Intenta de nuevo.'; }
    save.disabled = false;
  }
  greeting.addEventListener('input', preview);
  thanks.addEventListener('input', preview);
  document.getElementById('communityShowGreeting').addEventListener('change', preview);
  document.getElementById('communityShowThanks').addEventListener('change', preview);
  document.getElementById('communityReload').addEventListener('click', load);
  save.addEventListener('click', publish);
  load();
})();
