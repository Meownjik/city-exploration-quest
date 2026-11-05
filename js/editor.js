(function () {
  'use strict';
  var Q = window.Quest;
  var root = document.getElementById('editor');
  var statusEl = document.getElementById('status');
  var DRAFT_PREFIX = 'cityquest:editor:draft:';
  var TEXT_PLAIN = 'text/plain';

  // ?questId= picks the quest to edit (data/quests/<questId>.js). Without it, or if the id is invalid, a new quest.
  var questId = null;
  var model, sel = 0;
  var listEl, formEl, issuesEl;

  // ---------- model ----------
  function draftKey() { return DRAFT_PREFIX + (questId || '(new)'); }
  function defaultModel(id) {
    return { id: id || 'my-quest', title: { uk: 'Квест містом', en: 'City quest' },
      settings: Q.data.mergeSettings(), stations: [Q.data.emptyStation()] };
  }
  // Saved draft first, then data/quests/<questId>.js, then a new quest (with the given id).
  function loadFileModel() {
    if (!questId) return Promise.resolve(normalizeModel(defaultModel()));
    return Q.loader.loadQuest(questId).then(function (packed) {
      statusEl.textContent = 'Loaded from data/quests/' + questId + '.js';
      try {
        return normalizeModel(Q.data.unpackAll(packed));
      } catch (e) {
        alert('Could not decode data/quests/' + questId + '.js: ' + e.message);
        return normalizeModel(defaultModel(questId));
      }
    }, function () {
      statusEl.textContent = 'No data/quests/' + questId + '.js yet: starting a new quest';
      return normalizeModel(defaultModel(questId));
    });
  }
  function normalizeModel(m) {
    m.settings = Q.data.mergeSettings(m.settings);
    m.title = m.title || { uk: '', en: '' };
    m.stations = (m.stations || []).map(function (s) {
      var d = Q.data.emptyStation();
      s = Object.assign(d, s);
      s.prompt = {uk: '', en: '', ...s.prompt};
      s.clue = {uk: '', en: '', ...s.clue};
      s.hints = (s.hints?.length ? s.hints : d.hints).map(function (h) { return Object.assign({ uk: '', en: '' }, h); });
      s.names = s.names?.length ? s.names : [''];
      return s;
    });
    if (!m.stations.length) m.stations.push(Q.data.emptyStation());
    return m;
  }
  function changed() {
    Q.storage.save(draftKey(), model);
    statusEl.textContent = 'Draft autosaved ' + new Date().toLocaleTimeString();
    renderList();
    renderIssues();
  }

  // ---------- validation ----------
  function validStation(s, i) {
    var e = [], p = 'Station ' + (i + 1) + ': ';
    if (!s.prompt.uk.trim()) e.push(p + 'Ukrainian prompt is empty');
    if (s.hints.length < 2 || s.hints.length > 3) e.push(p + 'needs 2-3 hints');
    s.hints.forEach(function (h, k) { if (!h.uk.trim()) e.push(p + 'hint ' + (k + 1) + ' (uk) is empty'); });
    if (!s.names.some(function (n) { return n.trim(); })) e.push(p + 'location name is empty');
    if (typeof s.lat !== 'number' || Number.isNaN(s.lat) || s.lat < -90 || s.lat > 90) e.push(p + 'latitude invalid');
    if (typeof s.lng !== 'number' || Number.isNaN(s.lng) || s.lng < -180 || s.lng > 180) e.push(p + 'longitude invalid');
    if (typeof s.radius !== 'number' || Number.isNaN(s.radius) || s.radius < 10) e.push(p + 'radius must be at least 10 m');
    return e;
  }
  function validate() {
    var errors = [], warnings = [];
    if (!Q.data.isValidQuestId(model.id)) errors.push('Quest id must be letters, digits, - or _');
    if (!model.title.uk.trim()) errors.push('Ukrainian title is empty');
    var seen = {};
    model.stations.forEach(function (s, i) {
      errors = errors.concat(validStation(s, i));
      var k = Q.text.normalize(s.names[0]);
      if (k && seen[k] != null) warnings.push('Stations ' + (seen[k] + 1) + ' and ' + (i + 1) + ' have the same location name');
      if (k) seen[k] = i;
      if (!s.prompt.en.trim()) warnings.push('Station ' + (i + 1) + ': English prompt missing (Ukrainian will be shown)');
    });
    return { errors: errors, warnings: warnings };
  }
  function renderIssues() {
    var v = validate();
    issuesEl.innerHTML = '';
    function box(list, cls, title) {
      if (!list.length) return;
      var d = el('div', 'errs ' + cls);
      d.appendChild(el('strong', null, title));
      var ul = el('ul');
      list.forEach(function (x) { ul.appendChild(el('li', null, x)); });
      d.appendChild(ul); issuesEl.appendChild(d);
    }
    box(v.errors, '', 'Errors (' + v.errors.length + ')');
    box(v.warnings, 'warnings', 'Warnings (' + v.warnings.length + ')');
  }

  // ---------- dom helpers ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(text, cls, fn) {
    var b = el('button', cls || 'btn', text); b.type = 'button'; b.onclick = fn; return b;
  }
  function field(label, input) {
    var l = el('label', 'field'); l.appendChild(el('span', null, label)); l.appendChild(input); return l;
  }
  function textInput(obj, prop, multi, onChange) {
    var i = el(multi ? 'textarea' : 'input', 'input');
    if (!multi) i.type = 'text';
    i.value = obj[prop] == null ? '' : obj[prop];
    i.addEventListener('input', function () { obj[prop] = i.value; (onChange || changed)(); });
    return i;
  }
  function numInput(obj, prop, nullable) {
    var i = el('input', 'input'); i.type = 'text'; i.inputMode = 'decimal';
    i.value = obj[prop] == null ? '' : obj[prop];
    i.addEventListener('input', function () {
      var v = Number.parseFloat(i.value.replace(',', '.'));
      obj[prop] = Number.isNaN(v) ? (nullable ? null : 0) : v; changed();
    });
    return i;
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || TEXT_PLAIN });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- export / import ----------
  function cleanModel() {
    var c = structuredClone(model);
    c.id = c.id.trim();
    c.stations.forEach(function (s) {
      s.names = s.names.map(function (n) { return n.trim(); }).filter(Boolean);
    });
    return c;
  }
  function exportQuest() {
    var v = validate();
    if (v.errors.length && !confirm('There are ' + v.errors.length + ' error(s). Export anyway?')) return;
    var quest = cleanModel();
    var packed = Q.data.pack(quest);
    download(quest.id + '.js', '/* Generated by editor.html. Save as data/quests/' + quest.id + '.js */\nwindow.QUEST_DATA = ' +
      JSON.stringify(packed, null, 1) + ';\n', 'text/javascript');
  }
  function exportSource() {
    var quest = cleanModel();
    download(quest.id + '.source.json', JSON.stringify(quest, null, 2), 'application/json');
  }
  function importSource(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var m = JSON.parse(r.result);
        if (!m.stations) throw new Error('no stations array');
        model = normalizeModel(m); sel = 0; changed(); build();
      } catch (e) { alert('Import failed: ' + e.message); }
    };
    r.readAsText(file);
  }

  // ---------- structure ----------
  function move(from, to) {
    if (to < 0 || to >= model.stations.length || from === to) return;
    var s = model.stations.splice(from, 1)[0];
    model.stations.splice(to, 0, s);
    sel = to; changed(); renderForm();
  }
  function renderList() {
    listEl.innerHTML = '';
    model.stations.forEach(function (s, i) {
      var row = el('div', 'st-row' + (i === sel ? ' sel' : ''));
      row.draggable = true;
      var bad = validStation(s, i).length;
      row.appendChild(el('span', 'grab', '\u2630'));
      row.appendChild(el('span', null, (i + 1) + '.'));
      row.appendChild(el('span', 'lbl', s.names[0] || s.prompt.uk.slice(0, 40) || '(empty)'));
      if (bad) row.appendChild(el('span', 'bad', '!'));
      row.appendChild(btn('\u2191', 'mini', function (e) { e.stopPropagation(); move(i, i - 1); }));
      row.appendChild(btn('\u2193', 'mini', function (e) { e.stopPropagation(); move(i, i + 1); }));
      row.appendChild(btn('\u29C9', 'mini', function (e) {
        e.stopPropagation();
        model.stations.splice(i + 1, 0, structuredClone(s)); sel = i + 1; changed(); renderForm();
      }));
      row.appendChild(btn('\u2715', 'mini', function (e) {
        e.stopPropagation();
        if (!confirm('Remove station ' + (i + 1) + '?')) return;
        model.stations.splice(i, 1);
        if (!model.stations.length) model.stations.push(Q.data.emptyStation());
        sel = Math.min(sel, model.stations.length - 1); changed(); renderForm();
      }));
      row.onclick = function () { sel = i; renderList(); renderForm(); };
      row.addEventListener('dragstart', function (e) { e.dataTransfer.setData(TEXT_PLAIN, String(i)); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', function () { row.classList.remove('over'); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        move(Number.parseInt(e.dataTransfer.getData(TEXT_PLAIN), 10), i);
      });
      listEl.appendChild(row);
    });
  }

  function renderForm() {
    formEl.innerHTML = '';
    var s = model.stations[sel];
    var card = el('section', 'card');
    card.appendChild(el('h2', null, 'Station ' + (sel + 1)));

    card.appendChild(field('Prompt (uk)', textInput(s.prompt, 'uk', true)));
    card.appendChild(field('Prompt (en)', textInput(s.prompt, 'en', true)));

    var hintsBox = el('div', 'sub');
    function drawHints() {
      hintsBox.innerHTML = '';
      hintsBox.appendChild(el('h3', null, 'Hints (2-3)'));
      s.hints.forEach(function (h, k) {
        var g = el('div', 'grid2');
        g.appendChild(field('Hint ' + (k + 1) + ' (uk)', textInput(h, 'uk', true)));
        g.appendChild(field('Hint ' + (k + 1) + ' (en)', textInput(h, 'en', true)));
        hintsBox.appendChild(g);
      });
      if (s.hints.length < 3) hintsBox.appendChild(btn('Add 3rd hint', 'mini', function () {
        s.hints.push({ uk: '', en: '' }); changed(); drawHints();
      }));
      if (s.hints.length > 2) hintsBox.appendChild(btn('Remove last hint', 'mini', function () {
        s.hints.pop(); changed(); drawHints();
      }));
    }
    drawHints(); card.appendChild(hintsBox);

    var namesBox = el('div', 'sub');
    function drawNames() {
      namesBox.innerHTML = '';
      namesBox.appendChild(el('h3', null, 'Accepted location names (first is shown in the crossword)'));
      s.names.forEach(function (n, k) {
        var r = el('div', 'row');
        r.appendChild(textInput(s.names, k, false));
        if (s.names.length > 1) r.appendChild(btn('\u2715', 'mini', function () {
          s.names.splice(k, 1); changed(); drawNames();
        }));
        namesBox.appendChild(r);
      });
      namesBox.appendChild(btn('Add name variant', 'mini', function () { s.names.push(''); changed(); drawNames(); }));
    }
    drawNames(); card.appendChild(namesBox);

    var geo = el('div', 'sub');
    geo.appendChild(el('h3', null, 'Check-in coordinates'));
    var latI = numInput(s, 'lat', true), lngI = numInput(s, 'lng', true);
    var g = el('div', 'grid2');
    g.appendChild(field('Latitude', latI)); g.appendChild(field('Longitude', lngI));
    geo.appendChild(g);
    var paste = el('input', 'input'); paste.type = 'text'; paste.placeholder = 'e.g. 50.4501, 30.5234';
    paste.addEventListener('input', function () {
      var m = paste.value.match(/(-?\d+(?:[.,]\d+)?)[\s,;]+(-?\d+(?:[.,]\d+)?)/);
      if (m) {
        s.lat = Number.parseFloat(m[1].replace(',', '.')); s.lng = parseFloat(m[2].replace(',', '.'));
        latI.value = s.lat; lngI.value = s.lng; changed();
      }
    });
    geo.appendChild(field('Paste "lat, lng" (e.g. from Google Maps)', paste));
    geo.appendChild(field('Radius (m)', numInput(s, 'radius', false)));
    var actions = el('div', 'toolbar');
    actions.appendChild(btn('Use my current location', 'mini', function () {
      if (!navigator.geolocation) return alert('Geolocation not supported');
      navigator.geolocation.getCurrentPosition(function (p) {
        s.lat = +p.coords.latitude.toFixed(6); s.lng = +p.coords.longitude.toFixed(6);
        latI.value = s.lat; lngI.value = s.lng; changed();
      }, function (e) { alert('Location error: ' + e.message); }, { enableHighAccuracy: true, timeout: 15000 });
    }));
    actions.appendChild(btn('Open in map', 'mini', function () {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return alert('Set coordinates first');
      window.open('https://www.openstreetmap.org/?mlat=' + s.lat + '&mlon=' + s.lng + '#map=18/' + s.lat + '/' + s.lng, '_blank', 'noopener');
    }));
    geo.appendChild(actions);
    card.appendChild(geo);

    var cw = el('div', 'sub');
    cw.appendChild(el('h3', null, 'Crossword clue (optional, otherwise generic)'));
    var cg = el('div', 'grid2');
    cg.appendChild(field('Clue (uk)', textInput(s.clue, 'uk', false)));
    cg.appendChild(field('Clue (en)', textInput(s.clue, 'en', false)));
    cw.appendChild(cg); card.appendChild(cw);

    formEl.appendChild(card);
  }

  // ---------- page ----------
  function build() {
    root.innerHTML = '';
    var tb = el('div', 'toolbar');
    tb.appendChild(btn('Export quest file (.js)', 'btn primary', exportQuest));
    tb.appendChild(btn('Export source JSON', 'btn', exportSource));
    var file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.style.display = 'none';
    file.onchange = function () { if (file.files[0]) importSource(file.files[0]); file.value = ''; };
    tb.appendChild(btn('Import source JSON', 'btn', function () { file.click(); }));
    tb.appendChild(btn('Discard draft and reload file', 'btn danger', function () {
      if (!confirm('Discard the current draft and reload the quest file?')) return;
      Q.storage.remove(draftKey());
      loadFileModel().then(function (m) { model = m; sel = 0; changed(); build(); });
    }));
    tb.appendChild(file);
    root.appendChild(tb);
    root.appendChild(el('p', 'muted small',
      'Workflow: edit, export the quest file, save it as data/quests/<id>.js in the repo, commit and push to redeploy. ' +
      'Keep <id>.source.json as an editable backup. Open the editor with ?questId=<id> to edit that quest. ' +
      'Changing the quest id resets players\' saved progress.'));

    issuesEl = el('div'); root.appendChild(issuesEl);

    var set = el('details', 'card');
    set.appendChild(el('summary', null, 'Quest settings'));
    set.appendChild(field('Quest id (also the progress key and obfuscation key)', textInput(model, 'id', false)));
    var tg = el('div', 'grid2');
    tg.appendChild(field('Title (uk)', textInput(model.title, 'uk', false)));
    tg.appendChild(field('Title (en)', textInput(model.title, 'en', false)));
    set.appendChild(tg);
    set.appendChild(el('h3', null, 'Scoring'));
    var labels = { perSolved: 'Points per solved task', perHint: 'Penalty per hint', perSkip: 'Penalty per skipped task',
      perUnverified: 'Penalty per unverified check-in', timeBonusMax: 'Max time bonus (0 = off)',
      timeParMinutes: 'Time bonus decays to 0 at (minutes)', perCrosswordWord: 'Points per crossword word' };
    var sg = el('div', 'grid2');
    Object.keys(labels).forEach(function (k) { sg.appendChild(field(labels[k], numInput(model.settings.scoring, k, false))); });
    set.appendChild(sg);
    function check(label, obj, prop) {
      var l = el('label', 'field'); var c = el('input'); c.type = 'checkbox'; c.checked = !!obj[prop];
      c.onchange = function () { obj[prop] = c.checked; changed(); };
      l.appendChild(c); l.appendChild(document.createTextNode(' ' + label)); return l;
    }
    set.appendChild(check('Enable final crossword', model.settings.crossword, 'enabled'));
    set.appendChild(check('Include skipped stations in crossword', model.settings.crossword, 'includeSkipped'));
    root.appendChild(set);

    var stBox = el('section', 'card');
    stBox.appendChild(el('h2', null, 'Stations'));
    listEl = el('div'); stBox.appendChild(listEl);
    stBox.appendChild(btn('+ Add station', 'btn', function () {
      model.stations.push(Q.data.emptyStation()); sel = model.stations.length - 1; changed(); renderForm();
    }));
    root.appendChild(stBox);
    formEl = el('div'); root.appendChild(formEl);

    renderList(); renderForm(); renderIssues();
  }

  function init() {
    var param = Q.loader.questIdFromUrl();
    if (param != null && !Q.data.isValidQuestId(param)) {
      statusEl.textContent = 'Invalid questId in URL (letters, digits, - and _ only): starting a new quest';
    } else {
      questId = param || null;
    }
    var draft = Q.storage.load(draftKey());
    if (draft && draft.stations) {
      model = normalizeModel(draft);
      statusEl.textContent = 'Draft loaded';
      build();
      return;
    }
    if (!questId) {
      model = normalizeModel(defaultModel());
      build();
      return;
    }
    loadFileModel().then(function (m) { model = m; build(); });
  }
  init();
})();
