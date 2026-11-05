(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});
  Q.locales = Q.locales || {};
  var KEY = 'cityquest:lang';
  var lang = 'uk';
  var stored = Q.storage?.getRaw(KEY);
  if (stored === 'uk' || stored === 'en') lang = stored;

  function t(key, params) {
    var dict = Q.locales[lang] || {};
    var s = dict[key];
    if (s == null) s = Q.locales.uk?.[key];
    if (s == null) s = key;
    if (params) s = s.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ''; });
    return s;
  }
  // Pick localized value from {uk,en}
  function loc(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.uk || obj.en || '';
  }
  function setLang(l) {
    lang = l === 'en' ? 'en' : 'uk';
    if (Q.storage) Q.storage.setRaw(KEY, lang);
    try { document.documentElement.lang = lang; } catch { /* ignore */ }
  }
  try { document.documentElement.lang = lang; } catch { /* ignore */ }
  Q.i18n = { t: t, loc: loc, setLang: setLang, getLang: function () { return lang; } };
})(window);
