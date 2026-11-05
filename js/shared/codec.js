/* global module */
/* Shared codec: obfuscation (UTF-8 -> XOR -> base64), data pack/unpack, text normalization.
   Works in browsers (classic script, file:// safe) and in Node (require). */
(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});

  // ---------- obfuscation ----------
  function keyBytes(key) {
    return new TextEncoder().encode('cq:' + key);
  }
  function xor(bytes, key) {
    var k = keyBytes(key);
    var out = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k[i % k.length];
    return out;
  }
  function toB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromB64(str) {
    var bin = atob(str);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function encode(obj, key) {
    return toB64(xor(new TextEncoder().encode(JSON.stringify(obj)), key));
  }
  function decode(str, key) {
    return JSON.parse(new TextDecoder().decode(xor(fromB64(str), key)));
  }

  // ---------- data model ----------
  var DEFAULT_SETTINGS = {
    scoring: {
      perSolved: 100,
      perHint: 10,
      perSkip: 0,
      perUnverified: 20,
      timeBonusMax: 0,
      timeParMinutes: 0,
      perCrosswordWord: 20
    },
    crossword: { enabled: true, includeSkipped: false }
  };

  function emptyStation() {
    return {
      prompt: { uk: '', en: '' },
      hints: [{ uk: '', en: '' }, { uk: '', en: '' }],
      names: [''],
      lat: null,
      lng: null,
      radius: 75,
      clue: { uk: '', en: '' }
    };
  }

  function mergeSettings(s) {
    s = s || {};
    var d = DEFAULT_SETTINGS;
    return {
      scoring: Object.assign({}, d.scoring, s.scoring || {}),
      crossword: Object.assign({}, d.crossword, s.crossword || {})
    };
  }

  // source: { id, title:{uk,en}, settings, stations:[ {prompt,hints,names,lat,lng,radius,clue} ] }
  function pack(src) {
    var id = String(src.id);
    return {
      v: 1,
      id: id,
      title: src.title,
      settings: mergeSettings(src.settings),
      stations: src.stations.map(function (s) {
        return {
          t: encode({ prompt: s.prompt, hints: s.hints }, id),
          a: encode({ names: s.names, lat: s.lat, lng: s.lng, radius: s.radius, clue: s.clue }, id)
        };
      })
    };
  }
  function unpackTask(packed, i) {
    return decode(packed.stations[i].t, packed.id);
  }
  function unpackAnswer(packed, i) {
    return decode(packed.stations[i].a, packed.id);
  }
  function unpackAll(packed) {
    return {
      id: packed.id,
      title: packed.title,
      settings: mergeSettings(packed.settings),
      stations: packed.stations.map(function (_, i) {
        return Object.assign({}, unpackTask(packed, i), unpackAnswer(packed, i));
      })
    };
  }

  // ---------- text ----------
  var LOOKALIKE = { a: 'а', c: 'с', e: 'е', i: 'і', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в' };
  // Case-insensitive, ignores spaces/punctuation/apostrophes, unifies Latin look-alikes with Cyrillic.
  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/ґ/g, 'г')
      .replace(/[a-z]/g, function (c) { return LOOKALIKE[c] || c; })
      .replace(/[^\p{L}\p{N}]/gu, '');
  }
  // Uppercase letters only (for crossword).
  function letters(s) {
    return String(s == null ? '' : s)
      .replace(/[^\p{L}\p{N}]/gu, '')
      .toLocaleUpperCase('uk')
      .replace(/Ё/g, 'Е');
  }

  Q.codec = { encode: encode, decode: decode };
  Q.data = {
    pack: pack,
    unpackTask: unpackTask,
    unpackAnswer: unpackAnswer,
    unpackAll: unpackAll,
    mergeSettings: mergeSettings,
    emptyStation: emptyStation
  };
  Q.text = { normalize: normalize, letters: letters };

  if (typeof module !== 'undefined' && module.exports) module.exports = Q;
})(typeof window !== 'undefined' ? window : globalThis);
