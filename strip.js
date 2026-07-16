// Thread-strip rendering shared by the viewer (index.html) and the client
// (client.html): fetch a whole thread, render it as a comic strip, and
// redraw the same panel model onto a canvas for PNG export.

import {
  NEUTRAL, PANEL_W, PANEL_H, CHAR_H, LINE_H, PAD_X, PAD_Y,
  hash, makeCast, pickPose, addresseeOf, arrange, balloonPath,
  wrapPlain, splitLong, layoutBalloons, semanticBg, contextMaybeTruncated,
} from './comic.js';
import {
  ASSETS, el, plainName, nameFrag, addChar, mksvg, drawBalloon,
  statusToUtt, ensureManifest,
} from './panel.js';

// ---------- data ----------

async function api(host, path) {
  let r;
  try {
    r = await fetch(`https://${host}/api/v1/${path}`);
  } catch {
    throw new Error(`Could not reach ${host} — the instance may not ` +
      'allow cross-origin API requests (CORS), or the network is down.');
  }
  if (!r.ok) throw new Error(`API ${path}: HTTP ${r.status}`);
  return r.json();
}

// Fetch the whole thread: walk up to the root, then take the root's
// descendants. `truncated` flags context responses that hit Mastodon's
// unauthenticated caps.
export async function fetchThread(host, id) {
  const ctx = await api(host, `statuses/${id}/context`);
  const rootId = ctx.ancestors.length ? ctx.ancestors[0].id : id;
  if (rootId === id) {
    const root = await api(host, `statuses/${id}`);
    return { statuses: [root, ...ctx.descendants],
             truncated: contextMaybeTruncated(ctx) };
  }
  const root = ctx.ancestors[0];
  const rootCtx = await api(host, `statuses/${rootId}/context`);
  return { statuses: [root, ...rootCtx.descendants],
           truncated: contextMaybeTruncated(ctx) ||
                      contextMaybeTruncated(rootCtx) };
}

// ---------- strip rendering ----------

// Renders the thread into `strip` and returns the panel model the canvas
// backend consumes.
export async function renderStrip(strip, statuses, title) {
  const manifest = await ensureManifest();
  strip.innerHTML = '';
  const cast = makeCast(statuses, manifest.characters);
  const bg = manifest.backgrounds[hash(statuses[0].id) % manifest.backgrounds.length];

  // Title panel with the most active participants (paper Fig. 7).
  const counts = new Map();
  statuses.forEach(s =>
    counts.set(s.account.acct, (counts.get(s.account.acct) || 0) + 1));
  const stars = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([acct]) => {
      const ch = cast.get(acct);
      const who = statuses.find(s => s.account.acct === acct).account;
      return { icon: ch.icon ? `${ASSETS}${ch.dir}/${ch.icon}` : null,
               account: who, name: plainName(who), charName: ch.name };
    });
  {
    const tp = el('div', 'panel title-panel', strip);
    el('div', 'sub', tp).textContent = title || 'a comic chat';
    el('h1', null, tp).textContent = 'COMIC CHAT';
    el('div', 'sub', tp).textContent = 'STARRING';
    for (const s of stars) {
      const row = el('div', 'star', tp);
      if (s.icon) {
        const img = el('img', 'cast-icon', row);
        img.src = s.icon;
      }
      const span = el('span', null, row);
      span.append(`${s.charName} as `);
      span.appendChild(nameFrag(s.account));
    }
  }

  const participants = new Set(statuses.map(s => s.account.acct));
  const names = new Map(statuses.map(s => [s.account.acct, s.account]));
  const prevNeighbors = new Map();

  const utts = statuses.map((st, i) => ({
    ...statusToUtt(st),
    acct: st.account.acct,
    addressee: addresseeOf(st, statuses, i, participants),
  })).flatMap(splitLong);

  // Arrangement + balloon layout for one panel's utterances; null = no fit.
  function tryLayout(us) {
    const members = [];
    for (const u of us) {
      if (!members.includes(u.acct)) members.push(u.acct);
      if (u.addressee && !members.includes(u.addressee))
        members.push(u.addressee);
    }
    if (members.length > 4) return null;
    const addrMap = new Map(us.map(u => [u.acct, u.addressee]));
    const arr = arrange(members, addrMap, prevNeighbors);
    const xs = new Map(arr.map(
      (m, k) => [m.acct, (k + 0.5) * PANEL_W / arr.length]));
    // Content warnings become narration boxes at the top of the panel;
    // balloons go below them (paper §8).
    const narrations = [];
    let yStart = 0;
    for (const u of us) {
      if (!u.cw) continue;
      const lines = wrapPlain(('CW: ' + u.cw).toUpperCase(), PANEL_W - 24);
      const h = lines.length * 13 + 6;
      narrations.push({ t: yStart + 3, h, lines });
      yStart += h + 5;
    }
    const balloons = layoutBalloons(
      us.map(u => ({ ...u, faceX: xs.get(u.acct) })), us.length === 1, yStart);
    return balloons && { arr, balloons, narrations };
  }

  // Panel breaks (§6.1): same speaker again, a 5th character, balloons not
  // fitting, or (15%) right after a longer opening utterance.
  const panels = [];
  let cur = null;
  const commit = () => {
    if (!cur) return;
    cur.layout.arr.forEach((m, k, a) => prevNeighbors.set(m.acct, {
      left: k > 0 ? a[k - 1].acct : null,
      right: k < a.length - 1 ? a[k + 1].acct : null,
    }));
  };
  for (const u of utts) {
    if (cur && !cur.closed && !cur.utts.some(p => p.acct === u.acct)) {
      const layout = tryLayout([...cur.utts, u]);
      if (layout) {
        cur.utts.push(u);
        cur.layout = layout;
        continue;
      }
    }
    commit();
    cur = {
      utts: [u],
      layout: tryLayout([u]),
      closed: u.text.split(' ').length > 6 && u.seed % 100 < 15,
    };
    panels.push(cur);
  }
  commit();

  panels.forEach((p, pi) => {
    if (!p.layout) {
      console.warn('panel layout failed, skipping', p.utts);
      return;
    }
    const panel = el('div', 'panel', strip);
    const scene = el('div', 'scene', panel);
    const pbg = semanticBg(p.utts.map(u => u.text), manifest.backgrounds) || bg;
    scene.style.backgroundImage = `url(${ASSETS}${pbg.file})`;
    p.bg = pbg;
    const { arr, balloons, narrations } = p.layout;

    // Camera zoom (§6.2): pull in as far as the shot allows -- outermost
    // characters must stay in frame, nobody gets cut at the neck (z<=2 keeps
    // the cut at the waist) or at the ankles (skip the 1.05-1.3 band).
    // Establishing shot for the first panel and every ~15th.
    const n = arr.length;
    const zFrame = n > 1
      ? (PANEL_W / 2 - 38) / (PANEL_W / 2 - PANEL_W / (2 * n)) : 2;
    let z = [1, 1.45, 1.7, 1.95][p.utts[0].seed % 4];
    z = Math.max(1, Math.min(z, zFrame, 2));
    if (z > 1.05 && z < 1.3) z = 1.3;
    if (pi % 15 === 0) z = 1;
    const charTop = PANEL_H - CHAR_H;
    scene.style.transform = `scale(${z})`;
    scene.style.transformOrigin = `50% ${charTop}px`;
    p.z = z;

    p.members = arr.map((m, k) => {
      const ch = cast.get(m.acct);
      const u = p.utts.find(x => x.acct === m.acct);
      const pose = u
        ? pickPose(ch, u.emo.code, u.emo.intensity, u.seed)
        : pickPose(ch, NEUTRAL, 0, (p.utts[0].seed ^ hash(m.acct)) >>> 0);
      return { acct: m.acct, flip: m.facing === 'left', char: ch, pose,
               x: (k + 0.5) * 100 / arr.length,
               name: plainName(names.get(m.acct)) };
    });
    for (const m of p.members)
      addChar(scene, panel, m.char, m.pose, m.x, m.flip,
              names.get(m.acct), z);

    const shapes = mksvg('shapes'); // balloon bodies, under the text divs
    panel.appendChild(shapes);
    const svg = mksvg('tails');     // tails, over everything

    for (const nb of narrations) {
      const div = el('div', 'narration', panel);
      div.style.top = nb.t + 'px';
      div.style.height = nb.h + 'px';
      div.textContent = nb.lines.join('\n');
    }

    p.utts.forEach((u, j) => {
      const k = arr.findIndex(m => m.acct === u.acct);
      const fx = (k + 0.5) * PANEL_W / arr.length;
      drawBalloon(panel, shapes, svg, u, balloons[j], {
        x: PANEL_W / 2 + (fx - PANEL_W / 2) * z,
        y: charTop + 14 * z,
      });
    });
    panel.appendChild(svg);
  });

  return {
    title: { sub: title || 'a comic chat', stars },
    panels: panels.filter(p => p.layout),
  };
}

// ---------- PNG export ----------
// A second rendering backend over the same panel model, drawing into a
// canvas. Geometry mirrors the DOM/CSS rules above.

const FONT = '"Comic Sans MS", "Comic Neue", cursive';

const imgCache = new Map();
function loadImage(url) {
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise(res => {
      const im = new Image();
      // Remote media/emoji must come back CORS-clean or the canvas taints;
      // failures fall through to a placeholder.
      if (/^https?:/.test(url)) im.crossOrigin = 'anonymous';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = url;
    }));
  }
  return imgCache.get(url);
}

function drawPlaceholder(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#ddd';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'black';
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y); ctx.lineTo(x, y + h);
  ctx.stroke();
  ctx.restore();
}

function drawTitlePanel(ctx, t, loaded) {
  ctx.save();
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(t.sub, PANEL_W / 2, 32);
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('COMIC CHAT', PANEL_W / 2, 62);
  ctx.font = `11px ${FONT}`;
  ctx.fillText('STARRING', PANEL_W / 2, 84);
  ctx.textAlign = 'left';
  let y = 108;
  for (const s of t.stars) {
    const icon = s.icon && loaded.get(s.icon);
    if (icon) {
      ctx.drawImage(icon, 24, y - 18, 28, 28);
      ctx.strokeStyle = 'black';
      ctx.strokeRect(24.5, y - 17.5, 27, 27);
    }
    ctx.fillText(`${s.charName} as ${s.name}`, 60, y);
    y += 34;
  }
  ctx.strokeStyle = 'black';
  ctx.strokeRect(.5, .5, PANEL_W - 1, PANEL_H - 1);
  ctx.restore();
}

function drawBalloonContent(ctx, u, b, loaded) {
  const path = new Path2D(balloonPath(b.l, b.t, b.w, b.h, u.seed, u.type));
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  if (u.type === 'whisper') ctx.setLineDash([4, 3]);
  ctx.fill(path);
  ctx.stroke(path);
  ctx.setLineDash([]);

  ctx.fillStyle = 'black';
  ctx.font = `${u.type === 'whisper' ? 'italic ' : ''}11px ${FONT}`;
  const SP = ctx.measureText(' ').width;
  b.lines.forEach((line, li) => {
    let x = b.l + PAD_X;
    const y = b.t + PAD_Y + 11 + li * LINE_H;
    for (const wd of line) {
      for (const s of wd.segs) {
        if (s.emoji) {
          const im = loaded.get(s.emoji);
          if (im) ctx.drawImage(im, x, y - 10, 13, 13);
          else drawPlaceholder(ctx, x, y - 10, 13, 13);
          x += 13;
        } else {
          const txt = s.text.toUpperCase();
          ctx.fillText(txt, x, y);
          const tw = ctx.measureText(txt).width;
          if (s.href) {
            ctx.beginPath();
            ctx.moveTo(x, y + 1.5);
            ctx.lineTo(x + tw, y + 1.5);
            ctx.stroke();
          }
          x += tw;
        }
      }
      x += SP;
    }
  });

  if (u.media.length && b.row) {
    const rowW = b.row.widths.reduce((a, w) => a + w, 0)
      + 4 * (u.media.length - 1);
    let x = b.l + (b.w - rowW) / 2;
    const y = b.t + PAD_Y + 1 + b.lines.length * LINE_H
      + (b.lines.length ? 4 : 0);
    u.media.forEach((m, mi) => {
      const w = b.row.widths[mi], h = b.row.h;
      const im = loaded.get(m.url);
      if (im) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.filter = m.sensitive ? 'grayscale(1) blur(8px)'
                                 : 'grayscale(1) contrast(1.05)';
        ctx.drawImage(im, x, y, w, h);
        ctx.restore();
      } else drawPlaceholder(ctx, x, y, w, h);
      ctx.strokeStyle = 'black';
      ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
      if (m.video) {
        ctx.save();
        ctx.font = `16px ${FONT}`;
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.fillText('▶', x + w / 2, y + h / 2 + 6);
        ctx.restore();
      }
      x += w + 4;
    });
  }
  ctx.restore();
}

function drawTail(ctx, u, b, p) {
  const k = p.members.findIndex(m => m.acct === u.acct);
  const fx = (k + 0.5) * PANEL_W / p.members.length;
  const faceX = PANEL_W / 2 + (fx - PANEL_W / 2) * p.z;
  const faceY = (PANEL_H - CHAR_H) + 14 * p.z;
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  if (u.type === 'thought') {
    [0.25, 0.55, 0.82].forEach((f, q) => {
      ctx.beginPath();
      ctx.arc(b.tailX + (faceX - b.tailX) * f,
              b.b - 2 + (faceY - b.b + 2) * f, 4.5 - q * 1.4, 0, 7);
      ctx.fill();
      ctx.stroke();
    });
  } else {
    ctx.beginPath();
    ctx.moveTo(b.tailX - 6, b.b - 2);
    ctx.lineTo(b.tailX + 8, b.b - 2);
    ctx.lineTo(faceX, faceY);
    ctx.closePath();
    if (u.type === 'whisper') ctx.setLineDash([4, 3]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.tailX - 5, b.b - 2);
    ctx.lineTo(b.tailX + 7, b.b - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPanel(ctx, p, loaded) {
  const charTop = PANEL_H - CHAR_H;
  const { balloons, narrations } = p.layout;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, PANEL_W, PANEL_H);
  ctx.clip();
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, PANEL_W, PANEL_H);

  // Scene (background + characters) under the camera zoom.
  ctx.save();
  ctx.translate(PANEL_W / 2, charTop);
  ctx.scale(p.z, p.z);
  ctx.translate(-PANEL_W / 2, -charTop);
  const bg = loaded.get(ASSETS + p.bg.file);
  if (bg) { // cover, center bottom -- like the CSS
    const s = Math.max(PANEL_W / bg.width, PANEL_H / bg.height);
    ctx.drawImage(bg, (PANEL_W - bg.width * s) / 2, PANEL_H - bg.height * s,
                  bg.width * s, bg.height * s);
  }
  for (const m of p.members) {
    const img = loaded.get(`${ASSETS}${m.char.dir}/${m.pose.file}`);
    if (!img) continue;
    const h = CHAR_H, w = img.width * h / img.height;
    ctx.save();
    ctx.translate(m.x / 100 * PANEL_W, PANEL_H);
    if (m.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }
  ctx.restore();

  // Nametags at the characters' zoomed positions.
  ctx.font = `10px ${FONT}`;
  for (const m of p.members) {
    let name = m.name;
    while (ctx.measureText(name).width > PANEL_W * 0.3 - 8 && name.length > 1)
      name = name.slice(0, -1);
    const tw = ctx.measureText(name).width + 8;
    const cx = (50 + (m.x - 50) * p.z) / 100 * PANEL_W;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(cx - tw / 2, PANEL_H - 16, tw, 14);
    ctx.strokeStyle = 'black';
    ctx.strokeRect(cx - tw / 2 + .5, PANEL_H - 15.5, tw - 1, 13);
    ctx.fillStyle = 'black';
    ctx.fillText(name, cx - tw / 2 + 4, PANEL_H - 5.5);
  }

  ctx.font = `10px ${FONT}`;
  for (const nb of narrations) {
    ctx.fillStyle = 'white';
    ctx.fillRect(4, nb.t, PANEL_W - 8, nb.h);
    ctx.strokeStyle = 'black';
    ctx.strokeRect(4.5, nb.t + .5, PANEL_W - 9, nb.h - 1);
    ctx.fillStyle = 'black';
    nb.lines.forEach((line, li) =>
      ctx.fillText(line, 10, nb.t + 11 + li * 13));
  }

  p.utts.forEach((u, j) => drawBalloonContent(ctx, u, balloons[j], loaded));
  p.utts.forEach((u, j) => drawTail(ctx, u, balloons[j], p));

  ctx.restore();
  ctx.strokeStyle = 'black';
  ctx.strokeRect(.5, .5, PANEL_W - 1, PANEL_H - 1);
}

export async function renderCanvas(model) {
  const SCALE = 2;
  const n = model.panels.length + 1; // + title panel
  const cols = Math.min(4, n);
  const rows = Math.ceil(n / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * PANEL_W * SCALE;
  canvas.height = rows * PANEL_H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, cols * PANEL_W, rows * PANEL_H);

  const urls = new Set();
  for (const s of model.title.stars) s.icon && urls.add(s.icon);
  for (const p of model.panels) {
    urls.add(ASSETS + p.bg.file);
    p.members.forEach(m => urls.add(`${ASSETS}${m.char.dir}/${m.pose.file}`));
    p.utts.forEach(u => {
      u.media.forEach(m => urls.add(m.url));
      u.words.forEach(wd =>
        wd.segs.forEach(s => s.emoji && urls.add(s.emoji)));
    });
  }
  const loaded = new Map(await Promise.all(
    [...urls].map(async u => [u, await loadImage(u)])));

  drawTitlePanel(ctx, model.title, loaded);
  model.panels.forEach((p, i) => {
    ctx.save();
    ctx.translate(((i + 1) % cols) * PANEL_W,
                  Math.floor((i + 1) / cols) * PANEL_H);
    drawPanel(ctx, p, loaded);
    ctx.restore();
  });
  return canvas;
}

export async function downloadPNG(model, filename = 'comic-chat.png') {
  const canvas = await renderCanvas(model);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
