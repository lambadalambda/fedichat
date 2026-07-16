// Shared DOM-side rendering for the thread viewer (index.html) and the
// client (client.html): post-HTML parsing, balloon/character DOM, hover
// previews. Pure logic lives in comic.js.

import {
  PANEL_W, PANEL_H, CHAR_H, INNER_W,
  spanTokens, emotionFor, balloonPath, hash, setMeasure,
} from './comic.js';

export const ASSETS = 'assets/chars/';

// Balloon-font measurer injected into the layout module.
const measurer = document.createElement('canvas').getContext('2d');
measurer.font = '11px "Comic Sans MS", "Comic Neue", cursive';
setMeasure(t => measurer.measureText(t).width);

export function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent && parent.appendChild(e);
  return e;
}

// An attachment we can draw in the balloon: an image, or a video/gifv
// with a poster frame.
export function balloonMedia(a) {
  return a.type === 'image' ||
    ((a.type === 'video' || a.type === 'gifv') && a.preview_url);
}

// Post content as ordered spans: {text} or {text, href}. Real links keep
// their href and their server-side ellipsized display text; mention and
// hashtag anchors stay plain words.
export function contentSpans(st) {
  const doc = new DOMParser().parseFromString(st.content, 'text/html');
  // Drop leading @mentions, Comic Chat speech shouldn't start with handles.
  for (const a of doc.querySelectorAll('a.mention, span.h-card')) {
    const prev = a.previousSibling;
    if (!prev || !prev.textContent.trim()) a.remove(); else break;
  }
  const spans = [];
  let buf = '';
  const flush = () => {
    const text = buf.replace(/\s+/g, ' ').trim();
    if (text) spans.push({ text });
    buf = '';
  };
  const isLink = n => n.tagName === 'A' && n.href &&
    !n.classList.contains('mention') && !n.classList.contains('hashtag') &&
    n.rel !== 'tag';
  (function walk(node) {
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) buf += n.textContent;
      else if (isLink(n)) {
        flush();
        const text = n.textContent.replace(/\s+/g, ' ').trim();
        if (text) spans.push({ text, href: n.href });
      } else walk(n);
    }
  })(doc.body);
  // Images and video stills render inside the balloon; audio/unknown
  // attachments get a marker.
  if (st.media_attachments.some(a => !balloonMedia(a)))
    buf += ' [attachment]';
  flush();
  // Long posts get split over panels; this cap is just a sanity bound.
  let budget = 1200;
  return spans.filter(s => {
    if (budget <= 0) return false;
    if (s.text.length > budget) s.text = s.text.slice(0, budget) + '…';
    budget -= s.text.length;
    return true;
  });
}

// Everything a balloon needs to know about one status. Callers add
// thread-level fields (acct, addressee) themselves.
export function statusToUtt(st) {
  const spans = contentSpans(st);
  const text = spans.map(s => s.text).join(' ');
  const emo = emotionFor(text);
  return {
    text, emo,
    words: spanTokens(spans, st.emojis || [], INNER_W),
    media: st.media_attachments.filter(balloonMedia).map(a => {
      const dims = a.meta?.original || a.meta?.small;
      return {
        url: a.preview_url || a.url,
        full: a.url || a.preview_url,
        ar: dims && dims.width && dims.height
          ? dims.width / dims.height : 4 / 3,
        video: a.type !== 'image',
        sensitive: !!st.sensitive,
      };
    }),
    cw: st.spoiler_text || null,
    emojis: st.emojis || [],
    seed: hash(st.id),
    // Balloon vocabulary (§5.1): non-public posts whisper, *actions*
    // think, shouting emotion shouts.
    type: st.visibility === 'private' || st.visibility === 'direct'
      ? 'whisper'
      : /^\*[^*]+\*$/.test(text) ? 'thought'
      : emo.code === 7 ? 'shout' : 'speech',
  };
}

// Floating full-size preview for balloon pictures, shown on hover. Lives on
// <body> so it isn't clipped by the panel.
let previewEl = null;
export function bindPreview(img, media) {
  if (!previewEl) {
    previewEl = document.createElement('img');
    previewEl.id = 'preview';
    document.body.appendChild(previewEl);
  }
  img.addEventListener('mousemove', e => {
    // No peeking at unrevealed sensitive media via the hover preview.
    if (img.classList.contains('sens') && !img.classList.contains('revealed'))
      return;
    previewEl.src = media.full;
    previewEl.style.display = 'block';
    previewEl.style.left =
      Math.max(4, Math.min(e.clientX + 14,
        innerWidth - previewEl.offsetWidth - 8)) + 'px';
    previewEl.style.top =
      Math.max(4, Math.min(e.clientY + 14,
        innerHeight - previewEl.offsetHeight - 8)) + 'px';
  });
  img.addEventListener('mouseleave', () => {
    previewEl.style.display = 'none';
  });
}

// Display name with :shortcodes: stripped, for contexts that can't show
// emoji images (canvas export, nametag measurement).
export function plainName(account) {
  return (account.display_name || account.acct)
    .replace(/:[\w-]+:/g, ' ').replace(/\s+/g, ' ').trim() || account.acct;
}

// Display name with :shortcode: custom emoji replaced by inline images
// (resolved against the account's emojis list).
export function nameFrag(account) {
  const frag = document.createDocumentFragment();
  const name = account.display_name || account.acct;
  const emojis = account.emojis || [];
  const re = /:([\w-]+):/g;
  let last = 0, m;
  while ((m = re.exec(name))) {
    const e = emojis.find(e => e.shortcode === m[1]);
    if (!e) continue;
    frag.append(name.slice(last, m.index));
    const img = document.createElement('img');
    img.className = 'emoji';
    img.src = e.static_url || e.url;
    img.alt = m[0];
    frag.append(img);
    last = m.index + m[0].length;
  }
  frag.append(name.slice(last));
  return frag;
}

// Character goes in the (zoomable) scene; the nametag stays on the panel at
// the character's zoomed position.
export function addChar(scene, panel, character, pose, xPct, flip, account, z) {
  const c = el('div', 'char' + (flip ? ' flip' : ''), scene);
  c.style.left = xPct + '%';
  const img = el('img', null, c);
  img.src = `${ASSETS}${character.dir}/${pose.file}`;
  img.alt = character.name;
  const tag = el('div', 'nametag', panel);
  tag.style.left = (50 + (xPct - 50) * z) + '%';
  tag.appendChild(nameFrag(account));
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function mksvg(cls) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('viewBox', `0 0 ${PANEL_W} ${PANEL_H}`);
  return s;
}

// One balloon: body path into `shapes`, text/media div onto `panel`,
// tail (or thought circles) into `tails`, pointing at face {x, y}.
export function drawBalloon(panel, shapes, tails, u, b, face) {
  const body = document.createElementNS(SVG_NS, 'path');
  body.setAttribute('d', balloonPath(b.l, b.t, b.w, b.h, u.seed, u.type));
  body.setAttribute('fill', 'white');
  body.setAttribute('stroke', 'black');
  if (u.type === 'whisper') body.setAttribute('stroke-dasharray', '4 3');
  shapes.appendChild(body);

  const div = el('div',
    'balloon' + (u.type === 'whisper' ? ' whisper' : ''), panel);
  div.style.left = b.l + 'px';
  div.style.top = b.t + 'px';
  div.style.width = b.w + 'px';
  div.style.height = b.h + 'px';
  b.lines.forEach((line, li) => {
    if (li) div.append('\n');
    line.forEach((wd, wi) => {
      if (wi) div.append(' ');
      for (const s of wd.segs) {
        if (s.emoji) {
          const em = el('img', 'bemoji', div);
          em.src = s.emoji;
          em.alt = s.code;
        } else if (s.href) {
          const a = el('a', null, div);
          a.href = s.href;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = s.text.toUpperCase();
        } else {
          div.append(s.text.toUpperCase());
        }
      }
    });
  });
  if (u.media.length && b.row) {
    const rowDiv = el('div', 'attachrow', div);
    u.media.forEach((m, mi) => {
      const wrap = el('span', 'att' + (m.video ? ' video' : ''), rowDiv);
      const im = el('img', 'attach' + (m.sensitive ? ' sens' : ''), wrap);
      im.src = m.url;
      im.width = Math.round(b.row.widths[mi]);
      im.height = Math.round(b.row.h);
      im.loading = 'lazy';
      if (m.sensitive)
        im.addEventListener('click', () => im.classList.toggle('revealed'));
      bindPreview(im, m);
    });
  }

  if (u.type === 'thought') {
    [0.25, 0.55, 0.82].forEach((f, q) => {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', b.tailX + (face.x - b.tailX) * f);
      c.setAttribute('cy', b.b - 2 + (face.y - b.b + 2) * f);
      c.setAttribute('r', 4.5 - q * 1.4);
      c.setAttribute('fill', 'white');
      c.setAttribute('stroke', 'black');
      tails.appendChild(c);
    });
  } else {
    const tail = document.createElementNS(SVG_NS, 'polygon');
    tail.setAttribute('points',
      `${b.tailX - 6},${b.b - 2} ${b.tailX + 8},${b.b - 2} ${face.x},${face.y}`);
    tail.setAttribute('fill', 'white');
    tail.setAttribute('stroke', 'black');
    if (u.type === 'whisper') tail.setAttribute('stroke-dasharray', '4 3');
    tails.appendChild(tail);
    const gap = document.createElementNS(SVG_NS, 'line');
    gap.setAttribute('x1', b.tailX - 5); gap.setAttribute('y1', b.b - 2);
    gap.setAttribute('x2', b.tailX + 7); gap.setAttribute('y2', b.b - 2);
    gap.setAttribute('stroke', 'white'); gap.setAttribute('stroke-width', 3);
    tails.appendChild(gap);
  }
}
