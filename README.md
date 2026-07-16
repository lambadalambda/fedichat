# fedichat — Comic Chat fediverse thread viewer

**Live: <https://lambadalambda.github.io/fedichat/>**

Renders Pleroma/Mastodon threads as Microsoft Comic Chat strips, using the
original character and background art (Jim Woodring, 1996-98) from the
MIT-licensed [microsoft/comic-chat](https://github.com/microsoft/comic-chat)
repository, and the composition algorithms from the SIGGRAPH '96 paper
([Kurlander, Skelly & Salesin, "Comic Chat"](https://grail.cs.washington.edu/wp-content/uploads/2015/08/comics.pdf)).

## Run

```sh
python3 -m http.server 8742
open http://localhost:8742/
node --test   # unit tests, no dependencies
```

Paste a Pleroma `https://instance/notice/<id>` or Mastodon
`https://instance/@user/<id>` URL (the public Mastodon-compatible API must
serve CORS; Pleroma and Mastodon both do). Type `test` instead of a URL
for the dev fixture. **Save PNG** exports the strip as an image.

`client.html` is a client prototype: local/federated timelines of any
instance render as one comic panel per post (no account needed), OAuth
sign-in (PKCE, in-browser — the Pinafore pattern) unlocks the home
timeline, boosting, faving, replying and posting. Clicking a panel opens
the thread as a strip.

## Layout

- `index.html` — the thread viewer: thread fetching, strip rendering,
  and the canvas/PNG export backend.
- `client.html` — the client prototype: timelines, OAuth, posting.
- `comic.js` — the pure logic (ES module, tested): character casting,
  emotion/gesture text analysis, panel composition, routing-channel balloon
  layout, long-post splitting, balloon outlines, semantic backgrounds,
  status-URL parsing.
- `panel.js` — shared DOM rendering (post parsing, balloons, characters).
- `auth.js` — OAuth 2 + PKCE helpers (tested).
- `test/` — `node --test` suites.
- `mockups/` — static design mockups for the client.
- `scripts/extract_poses.py` — AVB parser: decodes the chunk format, the
  emotion-wheel metadata and neck anchors, composites head+body poses into
  `assets/chars/` (run with the Pillow venv: `.venv/bin/python`).
- `scripts/extract-assets.sh` — re-downloads the raw `.avb`/`.bgb` files
  from [microsoft/comic-chat](https://github.com/microsoft/comic-chat)
  into `raw/`.
- `raw/` — original AVB/BGB files (kept: they contain metadata we may still
  want, e.g. balloon/mouth anchors).
- `meta/issues.md` — repo-local issue tracker.

## Format notes

AVB v2.5 chunk layout and the decoded emotion codes (1 happy, 2 coy,
3 bored, 4 scared, 5 sad, 6 angry, 7 shouting, 8 laughing, 9 neutral;
gestures: 10 wave, 11 point at other, 12 point at self, 14 open arms) are
documented in `scripts/extract_poses.py`.

The character and background art is © Microsoft 1996-1998, drawn by Jim
Woodring. Microsoft open-sourced Comic Chat in July 2026
([announcement](https://opensource.microsoft.com/blog/2026/07/16/microsoft-comic-chat-is-now-open-source/));
the `.avb`/`.bgb` art files ship in the
[microsoft/comic-chat](https://github.com/microsoft/comic-chat) repository
under its root MIT LICENSE with no separate asset carve-out (though the
announcement doesn't explicitly discuss artwork licensing).
