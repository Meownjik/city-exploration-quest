/* Crossword generator + touch-friendly renderer. */
(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function key(x, y) { return x + ',' + y; }

  function canPlace(grid, letters, x, y, dir) {
    var dx = dir === 'a' ? 1 : 0, dy = 1 - dx, n = letters.length;
    if (grid.has(key(x - dx, y - dy)) || grid.has(key(x + dx * n, y + dy * n))) return false;
    var crosses = 0;
    for (var k = 0; k < n; k++) {
      var cx = x + dx * k, cy = y + dy * k;
      var cell = grid.get(key(cx, cy));
      if (cell) {
        if (cell.ch !== letters[k] || cell.dirs[dir]) return false;
        crosses++;
      } else if (grid.has(key(cx + dy, cy + dx)) || grid.has(key(cx - dy, cy - dx))) {
        return false;
      }
    }
    return crosses > 0;
  }
  function put(grid, w) {
    var dx = w.dir === 'a' ? 1 : 0, dy = 1 - dx;
    for (var k = 0; k < w.letters.length; k++) {
      var kk = key(w.x + dx * k, w.y + dy * k);
      var cell = grid.get(kk);
      if (!cell) { cell = { ch: w.letters[k], dirs: {} }; grid.set(kk, cell); }
      cell.dirs[w.dir] = true;
    }
  }
  function bounds(placed) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    placed.forEach(function (w) {
      var ex = w.dir === 'a' ? w.x + w.letters.length - 1 : w.x;
      var ey = w.dir === 'd' ? w.y + w.letters.length - 1 : w.y;
      x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, ex); y1 = Math.max(y1, ey);
    });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function attempt(words, rng) {
    var order = words.slice().sort(function (a, b) {
      return (b.letters.length - a.letters.length) + (rng() - 0.5) * 3;
    });
    var grid = new Map(), placed = [], unplaced = [];
    var first = { id: order[0].id, letters: order[0].letters, x: 0, y: 0, dir: 'a' };
    placed.push(first); put(grid, first);
    for (var i = 1; i < order.length; i++) {
      var w = order[i], best = null, bestScore = 1e9;
      placed.forEach(function (p) {
        for (var a = 0; a < p.letters.length; a++) {
          for (var b = 0; b < w.letters.length; b++) {
            if (p.letters[a] !== w.letters[b]) continue;
            var dir = p.dir === 'a' ? 'd' : 'a';
            var cx = p.dir === 'a' ? p.x + a : p.x, cy = p.dir === 'a' ? p.y : p.y + a;
            var x = dir === 'a' ? cx - b : cx, y = dir === 'd' ? cy - b : cy;
            if (!canPlace(grid, w.letters, x, y, dir)) continue;
            var cand = { id: w.id, letters: w.letters, x: x, y: y, dir: dir };
            var bb = bounds(placed.concat([cand]));
            var score = (bb.x1 - bb.x0 + 1) * (bb.y1 - bb.y0 + 1) + Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 3 + rng();
            if (score < bestScore) { bestScore = score; best = cand; }
          }
        }
      });
      if (best) { placed.push(best); put(grid, best); } else unplaced.push(w.id);
    }
    var bb = bounds(placed);
    return { placed: placed, unplaced: unplaced, area: (bb.x1 - bb.x0 + 1) * (bb.y1 - bb.y0 + 1) };
  }

  // words: [{id, letters}] -> { w, h, words:[{id,letters,x,y,dir,num}], unplaced:[id] }
  function generate(words, seed) {
    var rng = mulberry32(hashSeed(seed));
    var best = null;
    for (var i = 0; i < 60; i++) {
      var r = attempt(words, rng);
      if (!best || r.placed.length > best.placed.length ||
        (r.placed.length === best.placed.length && r.area < best.area)) best = r;
    }
    var bb = bounds(best.placed);
    var placed = best.placed.map(function (p) {
      return { id: p.id, letters: p.letters, dir: p.dir, x: p.x - bb.x0, y: p.y - bb.y0 };
    });
    var starts = {}, list = [];
    placed.forEach(function (p) { var k = key(p.x, p.y); if (!starts[k]) { starts[k] = true; list.push(p); } });
    list.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var nums = {};
    list.forEach(function (p, i) { nums[key(p.x, p.y)] = i + 1; });
    placed.forEach(function (p) { p.num = nums[key(p.x, p.y)]; });
    return { w: bb.x1 - bb.x0 + 1, h: bb.y1 - bb.y0 + 1, words: placed, unplaced: best.unplaced };
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function upper(s) { return String(s || '').toLocaleUpperCase('uk'); }

  /* opts: { layout, bonus:[{id,letters}], clues:{id:text}, fill:{}, onFill(), t(key,params) }
     returns { el, check() -> {correct,total} } */
  function render(opts) {
    var layout = opts.layout, fill = opts.fill, t = opts.t;
    var wrap = el('div', 'cw');
    var cells = {}; // key -> {ch, dirs, input}
    layout.words.forEach(function (w) {
      var dx = w.dir === 'a' ? 1 : 0, dy = 1 - dx;
      for (var k = 0; k < w.letters.length; k++) {
        var kk = key(w.x + dx * k, w.y + dy * k);
        if (!cells[kk]) cells[kk] = { ch: w.letters[k], dirs: {}, x: w.x + dx * k, y: w.y + dy * k, num: null };
        cells[kk].dirs[w.dir] = true;
      }
      cells[key(w.x, w.y)].num = w.num;
    });

    var dir = 'a';
    var cur = null;
    var dirBtn = el('button', 'btn btn-small');
    dirBtn.type = 'button';
    function updateDirBtn() { dirBtn.textContent = t('cw.dir', { d: dir === 'a' ? t('cw.dirAcross') : t('cw.dirDown') }); }
    dirBtn.onclick = function () { dir = dir === 'a' ? 'd' : 'a'; updateDirBtn(); highlight(); };
    updateDirBtn();

    var gridWrap = el('div', 'cw-scroll');
    var grid = el('div', 'cw-grid');
    grid.style.gridTemplateColumns = 'repeat(' + layout.w + ', var(--cw-cell))';
    for (var y = 0; y < layout.h; y++) {
      for (var x = 0; x < layout.w; x++) {
        var c = cells[key(x, y)];
        var box = el('div', c ? 'cw-cell' : 'cw-blank');
        if (c) {
          if (c.num) box.appendChild(el('span', 'cw-num', c.num));
          var inp = document.createElement('input');
          inp.type = 'text'; inp.maxLength = 2; inp.autocomplete = 'off';
          inp.setAttribute('autocapitalize', 'characters');
          inp.setAttribute('autocorrect', 'off'); inp.spellcheck = false;
          inp.value = fill[key(x, y)] || '';
          c.input = inp; c.box = box;
          bind(c, inp);
          box.appendChild(inp);
        }
        grid.appendChild(box);
      }
    }
    gridWrap.appendChild(grid);

    function cellAt(x, y) { return cells[key(x, y)]; }
    function step(c, d, sign) {
      return d === 'a' ? cellAt(c.x + sign, c.y) : cellAt(c.x, c.y + sign);
    }
    function highlight() {
      Object.keys(cells).forEach(function (k) { cells[k].box.classList.remove('active', 'current'); });
      if (!cur) return;
      var c = cur;
      if (!c.dirs[dir]) return;
      var a = c; while (step(a, dir, -1) && step(a, dir, -1).dirs[dir]) a = step(a, dir, -1);
      while (a && a.dirs[dir]) { a.box.classList.add('active'); a = step(a, dir, 1); }
      cur.box.classList.add('current');
    }
    function bind(c, inp) {
      inp.addEventListener('focus', function () {
        var was = cur === c;
        cur = c;
        var both = c.dirs.a && c.dirs.d;
        if (!both) dir = c.dirs.a ? 'a' : 'd';
        else if (was) dir = dir === 'a' ? 'd' : 'a';
        updateDirBtn(); highlight();
        try { inp.select(); } catch (e) {}
      });
      inp.addEventListener('click', function () {
        if (cur === c && c.dirs.a && c.dirs.d && document.activeElement === inp && c._clicked) {
          dir = dir === 'a' ? 'd' : 'a'; updateDirBtn(); highlight();
        }
        c._clicked = true;
      });
      inp.addEventListener('blur', function () { c._clicked = false; });
      inp.addEventListener('input', function () {
        var chars = Array.from(upper(inp.value).replace(/[^\p{L}\p{N}]/gu, ''));
        var v = chars.length ? chars[chars.length - 1] : '';
        inp.value = v;
        if (v) fill[key(c.x, c.y)] = v; else delete fill[key(c.x, c.y)];
        opts.onFill();
        if (v) { var n = step(c, c.dirs[dir] ? dir : (c.dirs.a ? 'a' : 'd'), 1); if (n) n.input.focus(); }
      });
      inp.addEventListener('keydown', function (e) {
        var d = c.dirs[dir] ? dir : (c.dirs.a ? 'a' : 'd');
        if (e.key === 'Backspace' && !inp.value) {
          var p = step(c, d, -1);
          if (p) { p.input.value = ''; delete fill[key(p.x, p.y)]; opts.onFill(); p.input.focus(); e.preventDefault(); }
        } else if (e.key === 'ArrowRight') { var r = cellAt(c.x + 1, c.y); if (r) r.input.focus(); }
        else if (e.key === 'ArrowLeft') { var l = cellAt(c.x - 1, c.y); if (l) l.input.focus(); }
        else if (e.key === 'ArrowDown') { var dn = cellAt(c.x, c.y + 1); if (dn) dn.input.focus(); }
        else if (e.key === 'ArrowUp') { var up = cellAt(c.x, c.y - 1); if (up) up.input.focus(); }
      });
    }

    wrap.appendChild(gridWrap);
    wrap.appendChild(dirBtn);

    function clueList(titleKey, d) {
      var items = layout.words.filter(function (w) { return w.dir === d; }).sort(function (a, b) { return a.num - b.num; });
      if (!items.length) return null;
      var box = el('div', 'cw-clues');
      box.appendChild(el('h3', null, t(titleKey)));
      var ol = el('ul');
      items.forEach(function (w) {
        var li = el('li', 'cw-clue', w.num + '. ' + (opts.clues[w.id] || '') + ' (' + t('cw.letters', { n: w.letters.length }) + ')');
        li.onclick = function () { dir = d; var c = cells[key(w.x, w.y)]; c.input.focus(); updateDirBtn(); highlight(); };
        ol.appendChild(li);
      });
      box.appendChild(ol);
      return box;
    }
    var a = clueList('cw.across', 'a'), dn = clueList('cw.down', 'd');
    if (a) wrap.appendChild(a);
    if (dn) wrap.appendChild(dn);

    var bonusInputs = {};
    if (opts.bonus.length) {
      var bb = el('div', 'cw-clues');
      bb.appendChild(el('h3', null, t('cw.bonus')));
      opts.bonus.forEach(function (b) {
        var row = el('label', 'cw-bonus');
        row.appendChild(el('span', null, (opts.clues[b.id] || '') + ' (' + t('cw.letters', { n: b.letters.length }) + ')'));
        var inp = document.createElement('input');
        inp.type = 'text'; inp.autocomplete = 'off'; inp.className = 'input';
        inp.setAttribute('autocapitalize', 'characters');
        inp.value = fill['b:' + b.id] || '';
        inp.addEventListener('input', function () {
          fill['b:' + b.id] = inp.value; opts.onFill();
        });
        bonusInputs[b.id] = inp;
        row.appendChild(inp);
        bb.appendChild(row);
      });
      wrap.appendChild(bb);
    }

    function check() {
      var correct = 0;
      layout.words.forEach(function (w) {
        var dx = w.dir === 'a' ? 1 : 0, dy = 1 - dx, ok = true;
        for (var k = 0; k < w.letters.length; k++) {
          if ((fill[key(w.x + dx * k, w.y + dy * k)] || '') !== w.letters[k]) { ok = false; break; }
        }
        if (ok) correct++;
      });
      opts.bonus.forEach(function (b) {
        if (Q.text.letters(fill['b:' + b.id] || '') === b.letters) correct++;
      });
      return { correct: correct, total: layout.words.length + opts.bonus.length };
    }
    return { el: wrap, check: check };
  }

  Q.crossword = { generate: generate, render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = Q;
})(typeof window !== 'undefined' ? window : globalThis);
