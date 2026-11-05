// Basic checks. Usage: node tools/test.js
const assert = require('assert');
const Q = require('../js/shared/codec.js');
require('../js/shared/geo.js');
require('../js/scoring.js');
require('../js/crossword.js');

// codec round trip
const obj = { a: 'Привіт, світ', n: [1, 2] };
assert.deepStrictEqual(Q.codec.decode(Q.codec.encode(obj, 'k'), 'k'), obj);
assert.notStrictEqual(Q.codec.encode(obj, 'k'), Buffer.from(JSON.stringify(obj)).toString('base64'));

// normalization
const n = Q.text.normalize;
assert.strictEqual(n("Києво-Печерська  Лавра"), n('києво печерська лавра'));
assert.strictEqual(n("Мар’їнський"), n("мар'їнський"));
assert.strictEqual(n('Opera'), n('Оpera')); // latin/cyrillic look-alikes

// geo
const d = Q.geo.distance(50.4501, 30.5234, 50.4501, 30.5334);
assert(d > 650 && d < 750, 'distance ' + d);

// pack/unpack
const src = { id: 'x', title: { uk: 'a', en: 'b' }, stations: [Q.data.emptyStation()] };
src.stations[0].names = ['Місце'];
const back = Q.data.unpackAll(Q.data.pack(src));
assert.deepStrictEqual(back.stations[0].names, ['Місце']);

// crossword
const words = ['МАЙДАННЕЗАЛЕЖНОСТІ', 'ЗОЛОТІВОРОТА', 'КИЄВОПЕЧЕРСЬКАЛАВРА'].map((l, i) => ({ id: i, letters: l }));
const lay = Q.crossword.generate(words, 'seed');
assert.strictEqual(lay.words.length + lay.unplaced.length, 3);
console.log('crossword placed', lay.words.length, 'size', lay.w + 'x' + lay.h);

// scoring
const s = Q.scoring.compute({ startedAt: 0, finishedAt: 60000, results: [{ status: 'solved', hints: 1 }, { status: 'skipped', hints: 0 }] },
  Q.data.mergeSettings());
assert.strictEqual(s.points, 90);
console.log('all ok');
