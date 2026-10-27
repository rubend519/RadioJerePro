(function () {
  'use strict';
  var section = document.getElementById('rjCommunity');
  if (!section) return;
  function render(data) {
    [['Greeting', 'greeting', 'showGreeting'], ['Thanks', 'thanks', 'showThanks']].forEach(function (item) {
      var text = typeof data[item[1]] === 'string' ? data[item[1]].trim() : '';
      document.getElementById('rjCommunity' + item[0] + 'Text').textContent = text;
      document.getElementById('rjCommunity' + item[0]).hidden = data[item[2]] === false || !text;
    });
    section.hidden = document.getElementById('rjCommunityGreeting').hidden && document.getElementById('rjCommunityThanks').hidden;
  }
  fetch('/community.json?_=' + Date.now(), { cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(render)
    .catch(function () { section.hidden = true; });
})();
