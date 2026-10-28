(function () {
  'use strict';
  window.RJCreateTicker = function (section) {
    section.textContent = ''; section.classList.add('rj-led');
    var badge = document.createElement('span'); badge.className = 'rj-led-badge'; badge.textContent = '📻 SALUDOS';
    var viewport = document.createElement('div'); viewport.className = 'rj-led-viewport';
    var track = document.createElement('div'); track.className = 'rj-led-track'; track.setAttribute('aria-hidden', 'true');
    var accessible = document.createElement('span'); accessible.className = 'rj-sr-only';
    var pause = document.createElement('button'); pause.type = 'button'; pause.className = 'rj-led-pause';
    var paused = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function toggle() { track.style.animationPlayState = paused ? 'paused' : 'running'; pause.textContent = paused ? '▶' : 'Ⅱ'; pause.setAttribute('aria-label', paused ? 'Reanudar mensajes' : 'Pausar mensajes'); pause.setAttribute('aria-pressed', String(paused)); }
    pause.addEventListener('click', function () { paused = !paused; toggle(); }); toggle();
    viewport.appendChild(track); section.appendChild(badge); section.appendChild(viewport); section.appendChild(pause); section.appendChild(accessible);
    var signature = '';
    function measure() {
      if (!track.firstChild) return;
      var groups = track.children;
      for (var i = 0; i < groups.length; i++) groups[i].style.minWidth = viewport.clientWidth + 'px';
      track.style.animationDuration = Math.max(12, groups[0].getBoundingClientRect().width / 42) + 's';
    }
    window.addEventListener('resize', measure);
    return function (data) {
      var messages = [];
      if (data.showGreeting !== false && data.greeting) messages.push('👋 ' + data.greeting.trim());
      if (data.showThanks !== false && data.thanks) messages.push('💜 ' + data.thanks.trim());
      var text = messages.join('     ✦     ').replace(/\s+/g, ' ');
      section.hidden = !text;
      if (text === signature) { measure(); return; }
      signature = text; accessible.textContent = messages.join(' '); track.textContent = '';
      for (var i = 0; i < 2; i++) { var group = document.createElement('span'); group.className = 'rj-led-group'; group.textContent = text + '     ✦     '; track.appendChild(group); }
      measure();
    };
  };
  var section = document.getElementById('rjCommunity');
  if (!section) return;
  var render = window.RJCreateTicker(section);
  function refresh() {
    if (document.hidden) return;
    fetch('/.netlify/functions/community?_=' + Date.now(), { cache: 'no-store' })
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (payload) { render(payload.data); }).catch(function () {});
  }
  refresh(); setInterval(refresh, 15000); document.addEventListener('visibilitychange', refresh);
})();
