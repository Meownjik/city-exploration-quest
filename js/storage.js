/* Safe localStorage wrapper with in-memory fallback (storage may be blocked). */
(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});
  var mem = {};
  var persistent = true;
  try {
    var k = '__cq_test__';
    root.localStorage.setItem(k, '1');
    root.localStorage.removeItem(k);
  } catch (e) {
    persistent = false;
  }
  function getRaw(key) {
    if (persistent) {
      try { return root.localStorage.getItem(key); } catch (e) { persistent = false; }
    }
    return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
  }
  function setRaw(key, val) {
    mem[key] = val;
    if (persistent) {
      try { root.localStorage.setItem(key, val); } catch (e) { persistent = false; }
    }
  }
  function remove(key) {
    delete mem[key];
    if (persistent) {
      try { root.localStorage.removeItem(key); } catch (e) { persistent = false; }
    }
  }
  function load(key) {
    var raw = getRaw(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function save(key, obj) { setRaw(key, JSON.stringify(obj)); }

  Q.storage = {
    getRaw: getRaw, setRaw: setRaw, remove: remove, load: load, save: save,
    isPersistent: function () { return persistent; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
