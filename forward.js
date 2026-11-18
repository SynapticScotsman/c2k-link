// Crew link: opens the crew laptop's pages wherever the laptop's tunnel is today.
// where.json holds the laptop's current address, scrambled with the key in this link's # part. Browsers never send the
// # part to GitHub, so GitHub only ever sees a scrambled address. Nothing about the runner or the crew is kept here.
// Links:  #KEY  the crew page,  #KEY/lite  the light page,  #KEY/chief/CODE  the chief page.
(function () {
  'use strict';
  var msg = document.getElementById('msg'), more = document.getElementById('more');
  function say(t, m) { msg.textContent = t; more.textContent = m || ''; more.hidden = !m; }
  window.addEventListener('hashchange', function () { location.reload(); });      // another link opened in this tab: start again

  var frag = location.hash.slice(1);
  try { frag = decodeURIComponent(frag); } catch (e) {}
  var m = /^([A-Za-z0-9_-]{16,64})(\/.*)?$/.exec(frag);
  if (!m) { say('This link is missing its key.', 'Ask the crew chief to send the whole link again.'); return; }
  var key = m[1], path = m[2] || '/';
  if (!/^\/(lite|chief\/[A-Za-z0-9_-]{1,64})?$/.test(path)) { say('This link is not complete.', 'Ask the crew chief to send the whole link again.'); return; }
  if (!window.crypto || !crypto.subtle || !window.fetch || !window.TextEncoder) { say('This browser cannot open the link.', 'Try Chrome or Safari.'); return; }

  var owner = location.hostname.split('.')[0], repo = location.pathname.split('/')[1] || '';

  function bytes(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function getJson(url) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 8000);
    return fetch(url, { cache: 'no-store', signal: c.signal, referrerPolicy: 'no-referrer' }).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  // the same address from two places: this site (can lag a minute or so after a change) and GitHub's API (current)
  var fromSite = getJson('where.json?t=' + Date.now());
  var fromApi = repo ? getJson('https://api.github.com/repos/' + owner + '/' + repo + '/contents/where.json?ref=main').then(function (j) {
    return JSON.parse(new TextDecoder().decode(bytes(j.content.replace(/\s/g, ''))));
  }) : Promise.reject(new Error('no repository'));

  function unscramble(w) {
    var n = bytes(w.n), a = bytes(w.a), k = new TextEncoder().encode(key), parts = [];
    for (var i = 0; i * 32 < a.length; i++) {      // block i of the key stream: SHA-256(key, nonce, i as 4 bytes)
      var buf = new Uint8Array(k.length + n.length + 4);
      buf.set(k, 0); buf.set(n, k.length);
      new DataView(buf.buffer).setUint32(k.length + n.length, i);
      parts.push(crypto.subtle.digest('SHA-256', buf));
    }
    return Promise.all(parts).then(function (ds) {
      var out = new Uint8Array(a.length);
      for (var j = 0; j < a.length; j++) out[j] = a[j] ^ new Uint8Array(ds[j >> 5])[j & 31];
      return new TextDecoder().decode(out);
    });
  }

  Promise.allSettled([fromSite, fromApi]).then(function (rs) {
    var w = rs.filter(function (r) { return r.status === 'fulfilled' && r.value && r.value.v === 1 && r.value.n && r.value.a; })
      .map(function (r) { return r.value; })
      .sort(function (x, y) { return (y.t || 0) - (x.t || 0); })[0];      // the newer of the two
    if (!w) throw new Error('no address');
    return unscramble(w);
  }).then(function (base) {
    if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(base)) { say('This link’s key does not match.', 'Ask the crew chief to send the whole link again.'); return; }
    say('Opening the crew page…');
    location.replace(base + path);
  }).catch(function () {
    say('Cannot find the crew page just now.', 'Check you have signal, then reload this page.');
  });
})();
