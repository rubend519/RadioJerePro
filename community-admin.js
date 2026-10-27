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
