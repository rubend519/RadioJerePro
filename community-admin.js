(function () {
  'use strict';
  var original = null;
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
  function preview() {
    var data = read();
    document.getElementById('communityGreetingPreview').textContent = data.greeting || 'Tu saludo aparecerá aquí.';
    document.getElementById('communityThanksPreview').textContent = data.thanks || 'Tu nota aparecerá aquí.';
    document.getElementById('communityGreetingRow').hidden = !data.showGreeting;
    document.getElementById('communityThanksRow').hidden = !data.showThanks;
  }
  async function load() {
    save.disabled = true;
    status.textContent = 'Cargando mensajes publicados…';
    try {
      var response = await fetch('/community.json?_=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudieron cargar los mensajes.');
      original = normalize(await response.json());
      greeting.value = original.greeting;
      thanks.value = original.thanks;
      document.getElementById('communityShowGreeting').checked = original.showGreeting;
      document.getElementById('communityShowThanks').checked = original.showThanks;
      preview();
      status.textContent = 'Listo para editar. Los cambios se publican al guardarlos en GitHub.';
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
    var token = ghConfig.token;
    if (!token) { status.textContent = 'Configura tu acceso de GitHub en la pestaña ⚙ GitHub y vuelve a guardar.'; return; }
    save.disabled = true;
    status.textContent = 'Verificando tu acceso y guardando…';
    var headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
    var endpoint = 'https://api.github.com/repos/rubend519/RadioJerePro/contents/community.json';
    try {
      var userResponse = await fetch('https://api.github.com/user', { headers: headers });
      if (!userResponse.ok || String((await userResponse.json()).login).toLowerCase() !== 'rubend519') throw new Error('Solo la cuenta del dueño puede publicar estos mensajes.');
      var currentResponse = await fetch(endpoint + '?ref=main', { headers: headers, cache: 'no-store' });
      if (!currentResponse.ok) throw new Error('No se pudo leer el archivo en GitHub. Revisa los permisos del acceso.');
      var current = await currentResponse.json();
      var remote = normalize(JSON.parse(decodeURIComponent(escape(atob(current.content.replace(/\s/g, ''))))));
      if (JSON.stringify(remote) !== JSON.stringify(original)) throw new Error('Los mensajes cambiaron en otro dispositivo. Pulsa Recargar antes de publicar.');
      var result = await fetch(endpoint, {
        method: 'PUT', headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: 'admin: actualiza saludos y agradecimiento', branch: 'main', sha: current.sha, content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2) + '\n'))) })
      });
      if (!result.ok) throw new Error(result.status === 409 ? 'Hubo otro cambio mientras guardabas. Recarga antes de publicar.' : 'GitHub no permitió guardar. Verifica que tu acceso tenga permiso de escritura en el repositorio.');
      original = normalize(data);
      status.textContent = '✓ Guardado en GitHub. La web se actualizará cuando Netlify termine de publicar, normalmente en un minuto.';
    } catch (error) { status.textContent = error.message || 'No se pudo guardar. Intenta de nuevo.'; }
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
