/* Safe geolocation wrapper. Never throws / rejects. */
(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});

  function supported() {
    try { return !!(root.navigator && root.navigator.geolocation); } catch (e) { return false; }
  }

  // Resolves { ok:true, lat, lng, accuracy } or { ok:false, reason }
  // reason: unsupported | insecure | denied | unavailable | timeout | error
  function getPosition(opts) {
    var timeout = (opts && opts.timeout) || 15000;
    return new Promise(function (resolve) {
      var done = false;
      function finish(r) { if (!done) { done = true; clearTimeout(guard); resolve(r); } }
      var guard = setTimeout(function () { finish({ ok: false, reason: 'timeout' }); }, timeout + 3000);
      try {
        if (!supported()) return finish({ ok: false, reason: 'unsupported' });
        if (root.isSecureContext === false) return finish({ ok: false, reason: 'insecure' });
        root.navigator.geolocation.getCurrentPosition(
          function (p) {
            finish({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy || 0 });
          },
          function (err) {
            var reason = 'error';
            if (err) {
              if (err.code === 1) reason = 'denied';
              else if (err.code === 2) reason = 'unavailable';
              else if (err.code === 3) reason = 'timeout';
            }
            finish({ ok: false, reason: reason });
          },
          { enableHighAccuracy: true, timeout: timeout, maximumAge: 5000 }
        );
      } catch (e) {
        finish({ ok: false, reason: 'error' });
      }
    });
  }

  Q.location = { getPosition: getPosition, supported: supported };
})(typeof window !== 'undefined' ? window : globalThis);
