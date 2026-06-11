# Comic Chat fediverse thread viewer

Renders Pleroma/Mastodon threads as Microsoft Comic Chat strips, using the
original character and background art (Jim Woodring, 1996-98) extracted from
the MS Chat 2.5 installer on archive.org, and the composition algorithms from
the SIGGRAPH '96 paper ([Kurlander, Skelly & Salesin, "Comic Chat"](https://grail.cs.washington.edu/wp-content/uploads/2015/08/comics.pdf)).

## Run

```sh
python3 -m http.server 8742
open http://localhost:8742/
```

Paste any `https://instance/notice/<id>` URL (works against the public
Mastodon-compatible API; the instance must serve CORS, Pleroma does).
Type `test` instead of a URL for the dev fixture.

## Layout

- `index.html` — the whole viewer: thread fetching, character casting,
  emotion/gesture text analysis, panel composition, routing-channel balloon
  layout, camera zoom, balloon styles, title panel, semantic elements.
- `scripts/extract_poses.py` — AVB parser: decodes the chunk format, the
  emotion-wheel metadata and neck anchors, composites head+body poses into
  `assets/chars/` (run with the Pillow venv: `.venv/bin/python`).
- `scripts/extract-assets.sh` — re-downloads the installer from archive.org
  and unpacks the raw `.avb`/`.bgb` files into `raw/`.
- `raw/` — original AVB/BGB files (kept: they contain metadata we may still
  want, e.g. balloon/mouth anchors).
- `meta/issues.md` — repo-local issue tracker.

## Format notes

AVB v2.5 chunk layout and the decoded emotion codes (1 happy, 2 coy,
3 bored, 4 scared, 5 sad, 6 angry, 7 shouting, 8 laughing, 9 neutral;
gestures: 10 wave, 11 point at other, 12 point at self, 14 open arms) are
documented in `scripts/extract_poses.py`. The character art is Microsoft
copyright — don't ship `assets/` publicly; run the extraction scripts
instead.
