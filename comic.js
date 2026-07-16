// Pure logic for the Comic Chat thread viewer: text analysis, casting,
// panel arrangement (paper §4.3), balloon layout (§5.2) and outlines (§5.3).
// No DOM access; text measurement is injected via setMeasure().

export const NEUTRAL = 9; // emotion code for the wheel's center

export const PANEL_W = 320, PANEL_H = 280;
export const CHAR_H = Math.round(0.58 * PANEL_H);
export const BALLOON_ZONE = PANEL_H - CHAR_H - 8; // balloons live above the heads
export const LINE_H = 15, PAD_X = 8, PAD_Y = 5;
export const TAIL_T = 16; // routing channel corridor width
export const EMOJI_W = 13;
export const SPLIT_LINES = 5;
// Widest possible text line: balloon at max width, minus padding/border.
export const INNER_W = PANEL_W - 12 - 2 * PAD_X - 2;

// measure(text) -> pixel width in balloon font; the browser injects a canvas
// measurer, tests a fixed-width fake.
let measure = () => { throw new Error('setMeasure() first'); };
export function setMeasure(fn) { measure = fn; }

// ---------- data ----------

// Status permalink forms: Pleroma notice/object URLs and Mastodon-style
// @user (possibly @user@domain) or /statuses/ permalinks.
const URL_FORMS = [
  /^https?:\/\/([^/]+)\/(?:notice|objects)\/([A-Za-z0-9-]+)/,
  /^https?:\/\/([^/]+)\/@[^/]+\/([A-Za-z0-9]+)/,
  /^https?:\/\/([^/]+)\/users\/[^/]+\/statuses\/([A-Za-z0-9]+)/,
  /^https?:\/\/([^/]+)\/statuses\/([A-Za-z0-9]+)/,
];

// Mastodon caps unauthenticated /context responses (40 ancestors, 60
// descendants) with no truncation signal; hitting a cap exactly is our
// only hint. Pleroma returns full context and never trips this.
export function contextMaybeTruncated(ctx) {
  return ctx.ancestors.length >= 40 || ctx.descendants.length >= 60;
}

export function parseStatusUrl(u) {
  for (const re of URL_FORMS) {
    const m = u.trim().match(re);
    if (m) return { host: m[1], id: m[2] };
  }
  throw new Error('Expected a status URL like ' +
    'https://instance/notice/<id> or https://instance/@user/<id>');
}

// ---------- comic mapping ----------

export function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministically assign one character per account, avoiding collisions
// until the cast is exhausted.
export function makeCast(statuses, characters) {
  const cast = new Map();
  const taken = new Set();
  for (const st of statuses) {
    const acct = st.account.acct;
    if (cast.has(acct)) continue;
    let i = hash(acct) % characters.length;
    for (let n = 0; n < characters.length && taken.has(i); n++)
      i = (i + 1) % characters.length;
    taken.add(i);
    cast.set(acct, characters[i]);
  }
  return cast;
}

// Pick a pose via the character's emotion map: entries matching the wanted
// code, else neutral; `seed` breaks ties between same-emotion variants.
export function pickPose(character, code, intensity, seed) {
  let entries = character.map.filter(e => e.code === code);
  if (!entries.length) entries = character.map.filter(e => e.code === NEUTRAL);
  if (!entries.length) entries = character.map;
  entries.sort((a, b) => Math.abs(a.intensity - intensity) -
                         Math.abs(b.intensity - intensity));
  const best = entries.filter(e => e.intensity === entries[0].intensity);
  return character.poses[best[(seed >>> 0) % best.length].pose];
}

// Emotion wheel codes, identified by inspecting the standard characters'
// expressions: 1 happy, 2 coy, 3 bored, 4 scared, 5 sad, 6 angry,
// 7 shouting, 8 laughing, 9 neutral.
export const EMOTION_RULES = [
  [8, /\b(lo+l\w*|lmao+|rofl|a?ha(ha)+|hehe+|kek\w*|jaja(ja)*)\b|😂|🤣|:D|x[dD]\b/],
  [7, /(^|\s)[A-Z'!?.]{4,}(\s|$)|!{2,}/],
  [6, /\b(angry|furious|wtf|fuck\w*|shit|hate|goddamn|damn\w*|grr+)\b|>:\(|😠|😡|🖕/i],
  [4, /\b(scared|afraid|terrified|yikes|eek|spooky|creepy|horror)\b|😱|😨|D:/i],
  [5, /\b(sad|sigh|alas|cry\w*|crying|sorry|rip|miss (you|him|her))\b|:'?\(|☹|😢|😭/i],
  [2, /;[)3]|😉|😏|\b(secret\w*|tease|wink|sneak\w*)\b|~$/i],
  [3, /\b(bored|boring|meh|whatever|eh|zzz+|yawn)\b|🥱|🙄|shrug/i],
  [1, /\b(nice|cool|great|good|love\w*|awesome|thanks|thank you|happy|yay|congrats)\b|:[)3]|😊|❤|♥/i],
];

// Gesture codes live on bodies: 10 wave, 11 point at other, 12 point at
// self, 14 open arms. Text cues from the paper (§4.1).
export const GESTURE_RULES = [
  [10, /^(hi+|hiya|hello+|hey+|yo|bye+|goodbye|cya|see ya|welcome|greetings|o\/)\b|\bbrb\b/i],
  [12, /^(i|i'm|i'll|i'd|i've|imho|imo)\b/i],
  [11, /^(you|you're|you'll|are you|will you|did you|do you|don't you|u)\b/i],
];

// Stand-in for Comic Chat's text analysis: keyword/emoticon rules pick the
// wheel emotion, sentence-start cues pick gestures. A strong (exclaimed)
// emotion beats a gesture; a gesture beats a calm emotion (the paper found
// gestures read better in comics than subtle expressions). Bare "!" shouts,
// a trailing "?" gets the shrug.
export function emotionFor(text) {
  const emo = EMOTION_RULES.find(([, re]) => re.test(text));
  const loud = /!/.test(text);
  if (emo && loud) return { code: emo[0], intensity: 0xff };
  const gest = GESTURE_RULES.find(([, re]) => re.test(text));
  if (gest) return { code: gest[0], intensity: 0xff };
  if (emo) return { code: emo[0], intensity: 0x99 };
  if (/!$/.test(text)) return { code: 7, intensity: 0x99 };
  if (/\?$/.test(text)) return { code: 3, intensity: 0x66 };
  return { code: NEUTRAL, intensity: 0 };
}

// Who is this post talking to? First mention that's a thread participant,
// else the previous distinct speaker.
export function addresseeOf(st, statuses, i, participants) {
  const m = (st.mentions || []).find(
    x => participants.has(x.acct) && x.acct !== st.account.acct);
  if (m) return m.acct;
  for (let j = i - 1; j >= 0; j--) {
    if (statuses[j].account.acct !== st.account.acct)
      return statuses[j].account.acct;
  }
  return null;
}

// ---------- panel arrangement (paper §4.3) ----------
// An arrangement is an ordered list of {acct, facing}. The art faces right
// by default, so facing 'left' means mirrored.

const faces = (arr, ai, bi) =>
  bi < ai ? arr[ai].facing === 'left' : arr[ai].facing === 'right';

// The paper's evaluation function: Facing penalties over ordered pairs,
// plus Neighbors penalties against the previous panel's arrangement.
// addrMap: speaker acct -> addressee acct (or null) for this panel.
export function panelCost(arr, addrMap, prevNeighbors) {
  let cost = 0;
  for (let ai = 0; ai < arr.length; ai++) {
    for (let bi = 0; bi < arr.length; bi++) {
      if (ai === bi) continue;
      const target = addrMap.get(arr[ai].acct);
      if (!target) {
        if (!faces(arr, ai, bi)) cost += 4;
        if (!faces(arr, bi, ai)) cost += 2;
      } else if (arr[bi].acct === target) {
        if (!faces(arr, bi, ai)) cost += 4;
        if (!faces(arr, ai, bi)) cost += 40;
        cost += 4 * (Math.abs(ai - bi) - 1);
      }
    }
  }
  arr.forEach((m, k) => {
    const prev = prevNeighbors.get(m.acct);
    if (!prev) return;
    if ((k > 0 ? arr[k - 1].acct : null) !== prev.left) cost += 1;
    if ((k < arr.length - 1 ? arr[k + 1].acct : null) !== prev.right) cost += 1;
  });
  return cost;
}

// Greedy placement: insert each character at the position/orientation that
// minimizes the running cost (paper §4.3).
export function arrange(members, addrMap, prevNeighbors) {
  let arr = [];
  for (const acct of members) {
    let best = null;
    for (let p = 0; p <= arr.length; p++) {
      for (const facing of ['right', 'left']) {
        const cand = [...arr.slice(0, p), { acct, facing }, ...arr.slice(p)];
        const c = panelCost(cand, addrMap, prevNeighbors);
        if (!best || c < best.c) best = { cand, c };
      }
    }
    arr = best.cand;
  }
  return arr;
}

// ---------- balloon outlines (paper §5.3) ----------

// Woodring-style balloon outline: a rounded box whose long edges get
// small low-frequency waves, deterministic per balloon. Shout balloons
// (§5.1) get a jagged outline instead -- the type the original never shipped.
export function balloonPath(x0, y0, w, h, seed, type) {
  const r = 8, step = 13;
  const edges = [
    [x0 + r, y0, x0 + w - r, y0, 0, -1],
    [x0 + w, y0 + r, x0 + w, y0 + h - r, 1, 0],
    [x0 + w - r, y0 + h, x0 + r, y0 + h, 0, 1],
    [x0, y0 + h - r, x0, y0 + r, -1, 0],
  ];
  const pts = [];
  let i = seed % 5;
  for (const [x1, y1, x2, y2, nx, ny] of edges) {
    const nseg = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let s = 0; s <= nseg; s++, i++) {
      const fx = x1 + (x2 - x1) * s / nseg;
      const fy = y1 + (y2 - y1) * s / nseg;
      const off = (s === 0 || s === nseg) ? 0
        : type === 'shout' ? (i % 2 ? 7 : -3)
        : 1.3 * Math.sin(i * 1.1 + seed % 7) + 0.8 * Math.sin(i * .37 + seed % 13);
      pts.push((fx + nx * off).toFixed(1) + ',' + (fy + ny * off).toFixed(1));
    }
  }
  return 'M' + pts.join('L') + 'Z';
}

// ---------- balloon text (paper §5.2) ----------

// Balloon text is a list of word tokens: plain text (displayed all-caps)
// mixed with custom emoji (fixed width) and link text (carries href).
// `raw` preserves the original spelling (incl. :shortcodes:).

export function mkword(segs) {
  const w = segs.reduce((a, s) =>
    a + (s.emoji ? EMOJI_W : measure(s.text.toUpperCase())), 0);
  const raw = segs.map(s => s.emoji ? s.code : s.text).join('');
  return { w, raw, segs };
}

// Break a too-wide word into fitting chunks (URLs), keeping `href`.
function chunkWord(text, href, innerW, out) {
  while (measure(text.toUpperCase()) > innerW && text.length > 1) {
    let cut = text.length - 1;
    while (cut > 1 && measure(text.slice(0, cut).toUpperCase()) > innerW)
      cut--;
    out.push(mkword([{ text: text.slice(0, cut), href }]));
    text = text.slice(cut);
  }
  out.push(mkword([{ text, href }]));
}

// Spans are the post's content in order: {text} or {text, href} for links.
// Link display text tokenizes without emoji parsing; plain spans get the
// :shortcode: treatment.
export function spanTokens(spans, emojis, innerW) {
  const out = [];
  for (const span of spans) {
    for (const word of span.text.split(/\s+/).filter(Boolean)) {
      if (span.href) {
        chunkWord(word, span.href, innerW, out);
        continue;
      }
      const segs = [];
      const re = /:([\w-]+):/g;
      let last = 0, m;
      while ((m = re.exec(word))) {
        const e = (emojis || []).find(x => x.shortcode === m[1]);
        if (!e) continue;
        if (m.index > last) segs.push({ text: word.slice(last, m.index) });
        segs.push({ emoji: e.static_url || e.url, code: m[0] });
        last = m.index + m[0].length;
      }
      if (last < word.length) segs.push({ text: word.slice(last) });
      if (segs.length === 1 && segs[0].text !== undefined) {
        chunkWord(segs[0].text, undefined, innerW, out);
      } else if (segs.length) {
        out.push(mkword(segs));
      }
    }
  }
  return out;
}

export function wordTokens(text, emojis, innerW) {
  return spanTokens([{ text }], emojis, innerW);
}

export function wrapTokens(words, innerW) {
  const SP = measure(' ');
  const lines = [];
  let cur = [], curW = 0;
  for (const wd of words) {
    if (cur.length && curW + SP + wd.w > innerW) {
      lines.push(cur);
      cur = []; curW = 0;
    }
    curW += (cur.length ? SP : 0) + wd.w;
    cur.push(wd);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// Plain-text wrap (narration boxes): same tokenizer, joined display lines.
export function wrapPlain(text, innerW) {
  return wrapTokens(wordTokens(text, [], innerW), innerW)
    .map(line => line.map(wd => wd.raw).join(' '));
}

// Long posts split into multiple balloons in consecutive panels, with
// ellipsis tokens marking the split (paper §5.2). Operates on the
// utterance's word tokens so links and emoji survive. Media rides on the
// last chunk, the content warning on the first.
export function splitLong(u) {
  const lines = wrapTokens(u.words, INNER_W);
  if (lines.length <= SPLIT_LINES + 1) return [u];
  const out = [];
  for (let i = 0; i < lines.length; i += SPLIT_LINES) {
    const words = lines.slice(i, i + SPLIT_LINES).flat();
    const last = i + SPLIT_LINES >= lines.length;
    const dots = () => mkword([{ text: '…' }]);
    out.push({
      ...u,
      words: [...(i ? [dots()] : []), ...words, ...(last ? [] : [dots()])],
      text: words.map(wd => wd.raw).join(' '),
      seed: (u.seed + i * 7919) >>> 0,
      media: last ? u.media : null,
      cw: i === 0 ? u.cw : null,
    });
  }
  return out;
}

// ---------- semantic backgrounds (paper §6.3) ----------

// Topical keywords swap the scene for one panel. The Woodring backgrounds
// map to rough moods.
export const SEMANTIC_BGS = [
  ['volcano', /\b(fire|burn\w*|flame\w*|hell|war|gulag|explo\w*|rage|destroy\w*)\b/i],
  ['den', /\b(home|cozy|comfy|couch|sleep\w*|bed|tired|night)\b/i],
  ['field', /\b(outside|nature|walk|hik\w*|sunny|weather|park|grass)\b/i],
  ['pastoral', /\b(peace\w*|calm|chill\w*|relax\w*|zen|serene)\b/i],
];

export function semanticBg(texts, backgrounds) {
  for (const [name, re] of SEMANTIC_BGS) {
    if (texts.some(t => re.test(t)))
      return backgrounds.find(b => b.name === name) || null;
  }
  return null;
}

// ---------- balloon layout (paper §5.2) ----------

// PlaceBalloons with routing channels: each balloon keeps a clear vertical
// corridor for its tail; later balloons' channels are trimmed so earlier
// corridors survive (MaxAllowable), and placing a balloon shrinks earlier
// channels away from its extent (ReduceChannel). Returns null if a balloon
// can't be placed (panel break), unless `relax` (single-utterance panels).
export function layoutBalloons(utts, relax, yStart = 0) {
  const placed = [];
  const channels = [];
  for (const u of utts) {
    const maxW = PANEL_W - 12;
    const SP = measure(' ');
    const words = u.words;
    const totalW = words.reduce((a, wd, i) => a + wd.w + (i ? SP : 0), 0);
    const lineW = totalW + 2 * PAD_X + 4;
    const minWordW = Math.min(maxW, 2 * PAD_X + 6 +
      words.reduce((a, wd) => Math.max(a, wd.w), 0));
    let w = Math.min(lineW, maxW);
    if (u.media) w = Math.min(maxW, Math.max(w, 110));
    if (lineW > maxW) {
      // Multi-line: width from text area over allowable height (paper),
      // with a seeded nudge standing in for the paper's randomness.
      const bottom = placed.length ? Math.max(...placed.map(p => p.b)) : 0;
      const allowH = Math.max(LINE_H, BALLOON_ZONE - bottom - 4);
      const area = lineW * LINE_H * 4 / 3;
      w = Math.max(minWordW, Math.min(maxW, area / allowH));
      w = Math.min(maxW, w + (u.seed % 40));
    }

    // Routing channel: widest extent passing over the speaker's face.
    const ch = {
      l: Math.max(6, u.faceX - w),
      r: Math.min(PANEL_W - 6, u.faceX + w),
    };
    channels.forEach((c, k) => {
      const xi = utts[k].faceX;
      if (xi < u.faceX) ch.l = Math.max(ch.l, xi + TAIL_T / 2);
      else ch.r = Math.min(ch.r, xi - TAIL_T / 2);
    });
    if (ch.r - ch.l < minWordW) {
      if (!relax) return null;
      ch.l = 6; ch.r = PANEL_W - 6;
    }
    w = Math.min(w, ch.r - ch.l);

    const lines = words.length ? wrapTokens(words, w - 2 * PAD_X - 2) : [];
    let imgW = 0, imgH = 0;
    if (u.media) {
      imgH = 64;
      imgW = imgH * u.media.ar;
      const availW = w - 2 * PAD_X - 2;
      if (imgW > availW) { imgW = availW; imgH = imgW / u.media.ar; }
    }
    let h = lines.length * LINE_H + 2 * PAD_Y + 2
      + (imgH ? imgH + (lines.length ? 4 : 0) + 2 : 0);
    const l = Math.min(Math.max(u.faceX - w / 2, ch.l), ch.r - w);

    // Vertical: as high as possible, but reading order requires staying
    // below the bottom of balloons to the right, and no higher than the
    // top of balloons to the left; never overlap an earlier balloon.
    let t = yStart + 4;
    for (const p of placed) {
      const overlap = p.l < l + w && l < p.l + p.w;
      if (p.l + p.w / 2 > l + w / 2 || overlap) t = Math.max(t, p.b + 4);
      else t = Math.max(t, p.t);
    }
    // A single-utterance panel must always lay out: shrink the image and,
    // failing that, accept a balloon that covers part of the scene.
    const limit = BALLOON_ZONE + yStart + (relax ? 60 : 16);
    if (t + h > limit) {
      if (!relax) return null;
      if (imgH > 24) {
        const shrink = Math.min(imgH - 24, t + h - limit);
        imgH -= shrink;
        imgW = imgH * (imgW / (imgH + shrink));
        h -= shrink;
      }
    }

    placed.push({ l, t, w, h, b: t + h, lines, imgW, imgH,
                  tailX: Math.min(Math.max(u.faceX, l + 10), l + w - 12) });
    channels.forEach((c, k) => {
      if (utts[k].faceX < u.faceX) c.r = Math.min(c.r, l);
      else c.l = Math.max(c.l, l + w);
    });
    channels.push(ch);
  }
  return placed;
}
