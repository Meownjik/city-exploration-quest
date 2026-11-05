(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});

  // state: { startedAt, finishedAt, results:[{status,hints,unverified}], cw:{correct,total} }
  function compute(state, settings, now) {
    var sc = settings.scoring;
    var solved = 0, skipped = 0, hints = 0, unverified = 0;
    (state.results || []).forEach(function (r) {
      if (r.status === 'solved') solved++; else skipped++;
      hints += r.hints || 0;
      if (r.unverified) unverified++;
    });
    var end = state.finishedAt || now || Date.now();
    var elapsedMs = Math.max(0, end - (state.startedAt || end));
    var cwCorrect = state.cw ? state.cw.correct : 0;
    var timeBonus = 0;
    if (sc.timeBonusMax > 0 && sc.timeParMinutes > 0) {
      var ratio = 1 - elapsedMs / (sc.timeParMinutes * 60000);
      timeBonus = Math.round(sc.timeBonusMax * Math.min(1, Math.max(0, ratio)));
    }
    var points = solved * sc.perSolved - skipped * sc.perSkip - hints * sc.perHint -
      unverified * sc.perUnverified + cwCorrect * sc.perCrosswordWord + timeBonus;
    return {
      solved: solved, skipped: skipped, hints: hints, unverified: unverified,
      elapsedMs: elapsedMs, cwCorrect: cwCorrect, cwTotal: state.cw ? state.cw.total : 0,
      timeBonus: timeBonus, points: Math.max(0, Math.round(points))
    };
  }
  function formatDuration(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return (h ? h + ':' : '') + p(m) + ':' + p(sec);
  }
  Q.scoring = { compute: compute, formatDuration: formatDuration };
  if (typeof module !== 'undefined' && module.exports) module.exports = Q;
})(typeof window !== 'undefined' ? window : globalThis);
