(function () {
  'use strict';
  var Q = window.Quest;
  var t = Q.i18n.t, loc = Q.i18n.loc;
  var ACCEPTED = 'task.accepted';
  var packed = null; // set once the quest from ?questId= is loaded
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var titleEl = document.getElementById('title');
  var langBtn = document.getElementById('lang');

  var state = null;
  var ui = { name: '', notice: null, busy: false, cw: null };
  var taskCache = null;
  var STORE = null;

  // ---------- helpers ----------
  function h(tag, props) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e[k] = v;
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3500);
  }
  function save() { if (state) Q.storage.save(STORE, state); }
  function questTitle() { return loc(packed.title) || 'Quest'; }
  function n() { return packed.stations.length; }
  function settings() { return Q.data.mergeSettings(packed.settings); }
  function scrollTop() { try { window.scrollTo(0, 0); } catch { /* ignore */ } }

  // ---------- state ----------
  function newState(mode) {
    return { v: 1, mode: mode, startedAt: Date.now(), finishedAt: null, idx: 0, curHints: 0,
      results: [], phase: 'quiz', cw: null, cwFill: {} };
  }
  function loadState() {
    var s = Q.storage.load(STORE);
    if (s?.v !== 1 || !s.mode || !Array.isArray(s.results)) return null;
    return s;
  }
  function reset() {
    if (!window.confirm(t('start.confirmReset'))) return;
    Q.storage.remove(STORE);
    state = null; taskCache = null; ui = { name: '', notice: null, busy: false, cw: null };
    render(); scrollTop();
  }

  // ---------- screens ----------
  function render() {
    titleEl.textContent = questTitle();
    langBtn.textContent = t('lang.switch');
    clearInterval(render.timer);
    app.innerHTML = '';
    if (!Q.storage.isPersistent()) app.appendChild(h('div', { class: 'notice warn', text: t('app.storageWarn') }));
    if (!state) renderStart();
    else if (state.phase === 'done') renderResults();
    else if (state.phase === 'crossword') renderCrossword();
    else renderTask();
    if (state) {
      app.appendChild(h('div', { class: 'footer' },
        h('button', { class: 'link', type: 'button', onclick: reset, text: t('start.new') })));
    }
  }

  function renderStart() {
    app.appendChild(h('h2', { text: t('start.choose') }));
    app.appendChild(h('p', { class: 'muted', text: t('start.stations', { n: n() }) }));
    function modeCard(mode, titleKey, descKey) {
      return h('button', { class: 'card mode', type: 'button', onclick: function () {
        state = newState(mode); save(); render(); scrollTop();
      } }, h('strong', { text: t(titleKey) }), h('span', { text: t(descKey) }));
    }
    app.appendChild(modeCard('travel', 'start.travel', 'start.travelDesc'));
    app.appendChild(modeCard('standalone', 'start.standalone', 'start.standaloneDesc'));
  }

  function currentTask() {
    if (!taskCache || taskCache.idx !== state.idx) {
      taskCache = { idx: state.idx, data: Q.data.unpackTask(packed, state.idx) };
    }
    return taskCache.data;
  }

  function renderTask() {
    var task = currentTask();
    var total = n();
    var shown = task.hints.slice(0, state.curHints);

    app.appendChild(h('div', { class: 'bar' },
      h('span', { class: 'badge', text: t('task.station', { i: state.idx + 1, n: total }) }),
      h('span', { class: 'badge alt', text: state.mode === 'travel' ? t('task.modeTravel') : t('task.modeStandalone') }),
      h('span', { class: 'badge timer', id: 'timer', text: '' })));
    app.appendChild(h('div', { class: 'progress' },
      h('div', { class: 'progress-fill', style: 'width:' + Math.round((state.idx / total) * 100) + '%' })));

    app.appendChild(h('section', { class: 'card' },
      h('h2', { text: t('task.prompt') }),
      h('p', { class: 'prompt', text: loc(task.prompt) })));

    var hintsBox = h('section', { class: 'card' }, h('h2', { text: t('task.hints') }));
    shown.forEach(function (hint, i) {
      hintsBox.appendChild(h('div', { class: 'hint' },
        h('strong', { text: t('task.hintNum', { i: i + 1 }) + ': ' }), loc(hint)));
    });
    if (state.curHints < task.hints.length) {
      hintsBox.appendChild(h('button', { class: 'btn', type: 'button', text: t('task.hintBtn', { i: state.curHints + 1, n: task.hints.length }),
        onclick: function () {
          if (!window.confirm(t('task.hintConfirm'))) return;
          state.curHints++; save(); render();
        } }));
    }
    app.appendChild(hintsBox);

    var input = h('input', { class: 'input', type: 'text', value: ui.name, autocomplete: 'off',
      placeholder: t('task.namePlaceholder'), id: 'nameInput' });
    input.addEventListener('input', function () { ui.name = input.value; });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') checkIn(); });

    var box = h('section', { class: 'card' },
      h('h2', { text: t('task.checkin') }),
      h('label', { class: 'label', for: 'nameInput', text: t('task.nameLabel') }),
      input);
    if (ui.notice) box.appendChild(renderNotice());
    box.appendChild(h('button', { class: 'btn primary', type: 'button', disabled: ui.busy ? 'disabled' : null,
      text: ui.busy ? t('task.checking') : t('task.checkinBtn'), onclick: checkIn }));
    box.appendChild(h('p', { class: 'muted small', text: t('task.uploadReminder') }));
    app.appendChild(box);

    app.appendChild(h('button', { class: 'btn ghost', type: 'button', text: t('task.skip'), onclick: function () {
      if (!window.confirm(t('task.skipConfirm'))) return;
      advance('skipped', false, t('task.skipped'));
    } }));

    function tick() {
      var el = document.getElementById('timer');
      if (el) el.textContent = Q.scoring.formatDuration(Date.now() - state.startedAt);
    }
    tick();
    render.timer = setInterval(tick, 1000);
  }

  function renderNotice() {
    var nt = ui.notice;
    var box = h('div', { class: 'notice ' + (nt.kind || 'error') });
    if (nt.title) box.appendChild(h('strong', { text: nt.title }));
    box.appendChild(h('p', { text: nt.text }));
    if (nt.locIssue) {
      box.appendChild(h('button', { class: 'btn', type: 'button', text: t('loc.retry'), onclick: checkIn }));
      box.appendChild(h('button', { class: 'btn', type: 'button', text: t('loc.proceed'), onclick: function () {
        advance('solved', true, t(ACCEPTED));
      } }));
      box.appendChild(h('button', { class: 'btn', type: 'button', text: t('loc.standalone'), onclick: function () {
        state.mode = 'standalone'; ui.notice = null; save(); advance('solved', false, t(ACCEPTED));
      } }));
    }
    return box;
  }

  function checkIn() {
    if (ui.busy) return;
    var ans = Q.data.unpackAnswer(packed, state.idx);
    var typed = Q.text.normalize(ui.name);
    var nameOk = typed && ans.names.some(function (nm) { return Q.text.normalize(nm) === typed; });
    if (!nameOk) {
      ui.notice = { kind: 'error', text: t('task.wrongName') };
      render(); focusName(); return;
    }
    if (state.mode === 'standalone' || ans.lat == null || ans.lng == null) {
      advance('solved', false, t(ACCEPTED)); return;
    }
    ui.busy = true; ui.notice = null; render();
    var idxAtStart = state.idx;
    Q.location.getPosition({ timeout: 15000 }).then(function (pos) {
      ui.busy = false;
      if (!state || state.idx !== idxAtStart || state.phase !== 'quiz') return;
      if (!pos.ok) {
        ui.notice = { kind: 'warn', title: t('loc.title'), text: t('loc.' + pos.reason), locIssue: true };
        render(); return;
      }
      var d = Q.geo.distance(pos.lat, pos.lng, ans.lat, ans.lng);
      var effective = Math.max(0, d - Math.min(pos.accuracy || 0, 100));
      if (effective <= (ans.radius || 75)) {
        advance('solved', false, t(ACCEPTED));
      } else {
        ui.notice = { kind: 'error', text: t('task.tooFar', { d: Math.round(d), r: ans.radius || 75 }) };
        render();
      }
    });
  }
  function focusName() {
    var el = document.getElementById('nameInput');
    if (el) el.focus();
  }

  function advance(status, unverified, msg) {
    state.results.push({ status: status, hints: state.curHints, unverified: !!unverified });
    state.idx++; state.curHints = 0;
    ui.name = ''; ui.notice = null; ui.busy = false; taskCache = null;
    if (state.idx >= n()) endQuiz();
    save(); render(); scrollTop();
    if (msg) toast(msg);
  }

  function crosswordWords() {
    var inc = settings().crossword.includeSkipped;
    var words = [];
    state.results.forEach(function (r, i) {
      if (r.status !== 'solved' && !inc) return;
      var a = Q.data.unpackAnswer(packed, i);
      var letters = Q.text.letters(a.names[0]);
      if (letters.length < 2) return;
      words.push({ id: i, letters: letters, clue: loc(a.clue) || t('cw.defaultClue', { n: i + 1 }) });
    });
    return words;
  }
  function endQuiz() {
    if (settings().crossword.enabled && crosswordWords().length >= 2) state.phase = 'crossword';
    else finish();
  }
  function finish() {
    state.phase = 'done'; state.finishedAt = Date.now();
  }

  function renderCrossword() {
    app.appendChild(h('h2', { text: t('cw.title') }));
    app.appendChild(h('p', { class: 'muted', text: t('cw.desc') }));
    if (!ui.cw) {
      var words = crosswordWords();
      var layout = Q.crossword.generate(words, packed.id + ':' + state.startedAt);
      var clues = {}, bonus = [];
      words.forEach(function (w) { clues[w.id] = w.clue; });
      layout.unplaced.forEach(function (id) {
        words.forEach(function (w) { if (w.id === id) bonus.push({ id: id, letters: w.letters }); });
      });
      ui.cw = { layout: layout, clues: clues, bonus: bonus };
    }
    var r = Q.crossword.render({ layout: ui.cw.layout, bonus: ui.cw.bonus, clues: ui.cw.clues,
      fill: state.cwFill, onFill: save, t: t });
    app.appendChild(r.el);
    app.appendChild(h('button', { class: 'btn primary', type: 'button', text: t('cw.finish'), onclick: function () {
      state.cw = r.check(); finish(); save(); render(); scrollTop();
    } }));
    app.appendChild(h('button', { class: 'btn ghost', type: 'button', text: t('cw.skip'), onclick: function () {
      if (!window.confirm(t('cw.skipConfirm'))) return;
      state.cw = null; finish(); save(); render(); scrollTop();
    } }));
  }

  function renderResults() {
    var s = Q.scoring.compute(state, settings());
    var rows = [
      ['res.time', Q.scoring.formatDuration(s.elapsedMs)],
      ['res.solved', s.solved + ' / ' + n()],
      ['res.skipped', s.skipped],
      ['res.hints', s.hints]
    ];
    if (s.unverified) rows.push(['res.unverified', s.unverified]);
    if (state.cw) rows.push(['res.crossword', s.cwCorrect + ' / ' + s.cwTotal]);
    if (s.timeBonus) rows.push(['res.timeBonus', '+' + s.timeBonus]);
    var table = h('div', { class: 'stats' });
    rows.forEach(function (r) {
      table.appendChild(h('div', { class: 'stat' }, h('span', { text: t(r[0]) }), h('strong', { text: String(r[1]) })));
    });
    app.appendChild(h('section', { class: 'card' },
      h('h2', { text: t('res.title') }),
      table,
      h('div', { class: 'points' }, h('span', { text: t('res.points') }), h('strong', { text: String(s.points) }))));
    var summary = t('res.summary', { title: questTitle(), time: Q.scoring.formatDuration(s.elapsedMs),
      solved: s.solved, skipped: s.skipped, hints: s.hints, points: s.points });
    app.appendChild(h('button', { class: 'btn', type: 'button', text: t('res.copy'), onclick: function () {
      try {
        navigator.clipboard.writeText(summary).then(function () { toast(t('res.copied')); }, function () { window.prompt('', summary); });
      } catch { window.prompt('', summary); }
    } }));
  }

  // ---------- init ----------
  function onError() {
    if (onError.last && Date.now() - onError.last < 5000) return;
    onError.last = Date.now();
    toast(t('app.unexpected'));
  }
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onError);

  langBtn.addEventListener('click', function () {
    Q.i18n.setLang(Q.i18n.getLang() === 'uk' ? 'en' : 'uk');
    if (packed) render();
  });

  function showError(text) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'notice error', text: text }));
  }
  function start(quest) {
    if (!quest || !Array.isArray(quest.stations) || !quest.stations.length) {
      showError(t('app.loadError'));
      return;
    }
    packed = quest;
    STORE = 'cityquest:state:' + packed.id;
    state = loadState();
    if (state && state.idx > n()) state = null;
    render();
  }

  var questId = Q.loader.questIdFromUrl();
  if (!questId) {
    showError(t('app.noQuest'));
  } else if (!Q.data.isValidQuestId(questId)) {
    showError(t('app.badQuest'));
  } else {
    Q.loader.loadQuest(questId).then(start, function () {
      showError(t('app.questNotFound', { id: questId }));
    });
  }
})();
