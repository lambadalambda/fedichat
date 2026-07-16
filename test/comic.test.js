import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hash, makeCast, pickPose, emotionFor, panelCost, arrange, balloonPath,
  wordTokens, spanTokens, wrapTokens, wrapPlain, splitLong, layoutBalloons,
  semanticBg, addresseeOf, parseStatusUrl, contextMaybeTruncated, setMeasure,
  NEUTRAL, PANEL_W, BALLOON_ZONE, SPLIT_LINES, EMOJI_W, INNER_W,
} from '../comic.js';

// Fixed-width fake: every char 6px, so widths are predictable.
setMeasure(t => t.length * 6);

const CHARS = Array.from({ length: 4 }, (_, i) => ({
  name: `C${i}`, dir: `c${i}`, icon: null,
  poses: [{ file: 'pose00.png', w: 100, h: 200, mouth: null },
          { file: 'pose01.png', w: 100, h: 200, mouth: null }],
  map: [{ code: NEUTRAL, intensity: 0, pose: 0 },
        { code: 1, intensity: 0x99, pose: 1 }],
}));

const status = (acct, extra = {}) => ({ account: { acct }, ...extra });

test('hash is deterministic and 32-bit', () => {
  assert.equal(hash('alice'), hash('alice'));
  assert.notEqual(hash('alice'), hash('bob'));
  assert.ok(hash('x') >= 0 && hash('x') <= 0xffffffff);
});

test('makeCast avoids collisions until the cast is exhausted', () => {
  const sts = ['a', 'b', 'c', 'd'].map(a => status(a));
  const cast = makeCast(sts, CHARS);
  const dirs = [...cast.values()].map(c => c.dir);
  assert.equal(new Set(dirs).size, 4);
  assert.deepEqual(makeCast(sts, CHARS), cast); // deterministic
});

test('pickPose matches emotion code, falls back to neutral', () => {
  const c = CHARS[0];
  assert.equal(pickPose(c, 1, 0x99, 0).file, 'pose01.png');
  assert.equal(pickPose(c, 6, 0xff, 0).file, 'pose00.png'); // no angry art
});

test('emotionFor: rules from the paper stand-in', () => {
  assert.equal(emotionFor('lol what').code, 8);
  assert.equal(emotionFor('THIS IS FINE!!').code, 7);
  assert.equal(emotionFor('hi everyone').code, 10);       // wave gesture
  assert.equal(emotionFor("I think so").code, 12);        // point at self
  assert.equal(emotionFor('you must be new').code, 11);   // point at other
  assert.equal(emotionFor('really?').code, 3);            // shrug
  assert.equal(emotionFor('the sky is blue').code, NEUTRAL);
  // exclaimed emotion beats gesture
  assert.equal(emotionFor('hi this is great!').code, 1);
});

test('wordTokens: plain words, emoji segments, URL chunking', () => {
  const words = wordTokens('hello world', [], 300);
  assert.equal(words.length, 2);
  assert.equal(words[0].raw, 'hello');
  assert.equal(words[0].w, 30);

  const emojis = [{ shortcode: 'flag', url: 'u.png' }];
  const [w] = wordTokens('a:flag:b', emojis, 300);
  assert.equal(w.segs.length, 3);
  assert.equal(w.segs[1].emoji, 'u.png');
  assert.equal(w.w, 12 + EMOJI_W);
  assert.equal(w.raw, 'a:flag:b');

  const long = wordTokens('x'.repeat(50), [], 60); // 10 chars fit per chunk
  assert.ok(long.length >= 5);
  assert.ok(long.every(t => t.w <= 60));
});

test('wrapTokens keeps lines within width', () => {
  const words = wordTokens('aa bb cc dd ee ff', [], 300);
  const lines = wrapTokens(words, 40); // 2 words of 12px + space fit
  for (const line of lines) {
    const w = line.reduce((a, t, i) => a + t.w + (i ? 6 : 0), 0);
    assert.ok(w <= 40, `line too wide: ${w}`);
  }
  assert.equal(lines.flat().length, 6);
});

test('wrapPlain returns joined display lines', () => {
  const lines = wrapPlain('CW: LONG WARNING TEXT', 60);
  assert.ok(Array.isArray(lines) && lines.length >= 2);
  assert.equal(lines.join(' ').replace(/\s+/g, ' '), 'CW: LONG WARNING TEXT');
});

const utt = (text, extra = {}) => ({
  text, emojis: [], seed: 1, media: null, cw: null,
  words: wordTokens(text, extra.emojis || [], INNER_W), ...extra,
});

test('spanTokens: link spans carry href through words and chunks', () => {
  const spans = [
    { text: 'check this' },
    { text: 'example.com/thing…', href: 'https://example.com/thing?full=1' },
    { text: 'out' },
  ];
  const words = spanTokens(spans, [], 300);
  assert.deepEqual(words.map(w => w.raw),
                   ['check', 'this', 'example.com/thing…', 'out']);
  assert.equal(words[2].segs[0].href, 'https://example.com/thing?full=1');
  assert.ok(!words[0].segs[0].href && !words[3].segs[0].href);

  // display text wider than a line: every chunk keeps the href
  const long = spanTokens([{ text: 'x'.repeat(40), href: 'https://x.org' }],
                          [], 60);
  assert.ok(long.length >= 4);
  assert.ok(long.every(w => w.segs[0].href === 'https://x.org'));
});

test('spanTokens: emoji still parse in plain spans, not in links', () => {
  const emojis = [{ shortcode: 'flag', url: 'u.png' }];
  const words = spanTokens(
    [{ text: 'hi :flag:' }, { text: ':flag:', href: 'https://x.org' }],
    emojis, 300);
  assert.equal(words[1].segs[0].emoji, 'u.png');
  assert.equal(words[2].segs[0].href, 'https://x.org');
  assert.equal(words[2].segs[0].emoji, undefined);
});

test('splitLong: short passes through, long splits with ellipses', () => {
  const short = utt('hi there');
  assert.deepEqual(splitLong(short), [short]);

  const long = utt(
    Array.from({ length: 120 }, (_, i) => 'word' + i).join(' '),
    { seed: 42, media: { url: 'm.png' }, cw: 'long post' });
  const parts = splitLong(long);
  assert.ok(parts.length > 1);
  assert.equal(parts[0].words.at(-1).raw, '…');
  assert.equal(parts.at(-1).words[0].raw, '…');
  assert.equal(parts[0].cw, 'long post');
  assert.ok(parts.slice(1).every(p => p.cw === null));
  assert.equal(parts.at(-1).media?.url, 'm.png');
  assert.ok(parts.slice(0, -1).every(p => p.media === null));
  // no words lost or duplicated by the split
  const rejoined = parts.flatMap(p => p.words.map(w => w.raw))
    .filter(r => r !== '…').join(' ');
  assert.equal(rejoined, long.text);
});

test('splitLong: links survive splitting', () => {
  const words = spanTokens([
    { text: Array.from({ length: 100 }, (_, i) => 'w' + i).join(' ') },
    { text: 'example.com', href: 'https://example.com' },
  ], [], INNER_W);
  const parts = splitLong({ text: 'x', emojis: [], seed: 1, media: null,
                            cw: null, words });
  assert.ok(parts.length > 1);
  const linked = parts.at(-1).words.filter(w => w.segs.some(s => s.href));
  assert.equal(linked.length, 1);
});

test('arrange: speaker and addressee end up facing each other', () => {
  const addr = new Map([['a', 'b'], ['b', 'a']]);
  const arr = arrange(['a', 'b'], addr, new Map());
  assert.equal(arr.length, 2);
  const [l, r] = arr;
  assert.equal(l.facing, 'right');
  assert.equal(r.facing, 'left');
  assert.equal(panelCost(arr, addr, new Map()), 0);
});

test('arrange respects previous-panel neighbors', () => {
  const prev = new Map([
    ['a', { left: null, right: 'b' }],
    ['b', { left: 'a', right: null }],
  ]);
  const arr = arrange(['a', 'b'], new Map([['a', 'b'], ['b', null]]), prev);
  assert.deepEqual(arr.map(m => m.acct), ['a', 'b']);
});

test('layoutBalloons: places within zone, no overlaps, reading order', () => {
  const utts = [
    utt('first balloon here', { seed: 3, faceX: 80 }),
    utt('second one', { seed: 9, faceX: 240 }),
  ];
  const placed = layoutBalloons(utts, false);
  assert.ok(placed);
  assert.equal(placed.length, 2);
  for (const b of placed) {
    assert.ok(b.t >= 0 && b.b <= BALLOON_ZONE + 16);
    assert.ok(b.l >= 0 && b.l + b.w <= PANEL_W);
  }
  const [a, b] = placed;
  const overlap = a.l < b.l + b.w && b.l < a.l + a.w &&
                  a.t < b.b && b.t < a.b;
  assert.ok(!overlap, 'balloons overlap');
});

test('layoutBalloons: relax mode never returns null for one utterance', () => {
  const u = utt(Array.from({ length: 80 }, () => 'blah').join(' '),
                { seed: 5, faceX: 160, media: { ar: 1.5 } });
  assert.ok(layoutBalloons([u], true));
});

test('balloonPath: deterministic closed path', () => {
  const p = balloonPath(10, 10, 100, 40, 7, 'speech');
  assert.equal(p, balloonPath(10, 10, 100, 40, 7, 'speech'));
  assert.ok(p.startsWith('M') && p.endsWith('Z'));
  assert.notEqual(p, balloonPath(10, 10, 100, 40, 8, 'speech'));
});

test('semanticBg picks by keyword, null otherwise', () => {
  const bgs = ['volcano', 'den', 'field', 'pastoral'].map(n => ({ name: n }));
  assert.equal(semanticBg(['burn it all down'], bgs).name, 'volcano');
  assert.equal(semanticBg(['nothing topical'], bgs), null);
});

test('addresseeOf: mention wins, else previous distinct speaker', () => {
  const sts = [
    status('a'), status('b'),
    status('a', { mentions: [{ acct: 'b' }] }),
    status('c', { mentions: [{ acct: 'nobody' }] }),
  ];
  const parts = new Set(['a', 'b', 'c']);
  assert.equal(addresseeOf(sts[2], sts, 2, parts), 'b');
  assert.equal(addresseeOf(sts[3], sts, 3, parts), 'a'); // prev speaker
  assert.equal(addresseeOf(sts[0], sts, 0, parts), null);
});

test('parseStatusUrl: Pleroma notice/objects forms', () => {
  assert.deepEqual(parseStatusUrl('https://lain.com/notice/Ab3xYz'),
                   { host: 'lain.com', id: 'Ab3xYz' });
  assert.equal(parseStatusUrl('https://x.org/objects/123abc').host, 'x.org');
  assert.equal(
    parseStatusUrl('https://x.org/objects/9a5b6c7d-1234-abcd-9876-aabbccddeeff').id,
    '9a5b6c7d-1234-abcd-9876-aabbccddeeff');
});

test('parseStatusUrl: Mastodon permalink forms', () => {
  assert.deepEqual(parseStatusUrl('https://mastodon.social/@Gargron/12345'),
                   { host: 'mastodon.social', id: '12345' });
  assert.deepEqual(
    parseStatusUrl('https://masto.example/@user@remote.tld/998877'),
    { host: 'masto.example', id: '998877' });
  assert.equal(
    parseStatusUrl('https://m.example/users/alice/statuses/42').id, '42');
  assert.equal(parseStatusUrl('https://m.example/statuses/42').id, '42');
  // trailing junk tolerated
  assert.equal(
    parseStatusUrl('https://mastodon.social/@Gargron/12345/embed').id,
    '12345');
});

test('contextMaybeTruncated flags Mastodon caps only', () => {
  const ctx = (a, d) => ({ ancestors: Array(a), descendants: Array(d) });
  assert.equal(contextMaybeTruncated(ctx(0, 59)), false);
  assert.equal(contextMaybeTruncated(ctx(0, 60)), true);
  assert.equal(contextMaybeTruncated(ctx(40, 0)), true);
  assert.equal(contextMaybeTruncated(ctx(3, 12)), false);
});

test('parseStatusUrl rejects garbage', () => {
  assert.throws(() => parseStatusUrl('ftp://lain.com/notice/1'));
  assert.throws(() => parseStatusUrl('hello'));
  assert.throws(() => parseStatusUrl('https://x.org/@user'));
});
