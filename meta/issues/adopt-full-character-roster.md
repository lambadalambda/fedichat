# Adopt the full character/background roster from microsoft/comic-chat

## Summary

The official microsoft/comic-chat repo ships 9 characters and 4 backgrounds
that the archive.org installer (and therefore our `raw/`) never had:
characters buck, connor, glenda, kirby, pedagog, rainbow, tux, veronica,
waf; backgrounds buckroom, clouds, space, yellow (all in
`v2.5-beta-1/comicart/`). Pulling these in widens the casting pool for
threads with many participants and gives the semantic-background picker
more scenery to choose from.

## Requirements

- Extend the fetch list in `scripts/extract-assets.sh` with the new files.
- Run `scripts/extract_poses.py` over the new `.avb` files and confirm the
  emotion-wheel metadata and neck anchors parse (they are the same AVB v2.5
  format, but these characters were never tested against our parser).
- Add the new characters to the casting pool and the new backgrounds to the
  semantic background mapping in `index.html`.

## Acceptance Criteria

- New characters appear in `assets/chars/` with composited poses.
- A test thread can cast the new characters and render the new backgrounds
  without layout failures.

## Notes

- Blocked on / follows [[repoint-asset-extraction]].
- Related: [[readme-mit-provenance]].

## Outcome (2026-07-16)

All 31 characters and 7 backgrounds adopted. The new 8bpp characters
(buck, kirby, veronica are full-color) exposed a parser bug: the 0x0107
image-pointer bias applies to *mask* pointers too, and equal mask
pointers mean "no mask" (matches deark's found_image). The classic
characters never hit this because they use keyed 2bpp transparency with
zero mask pointers. Semantic entries added for space, clouds and
buckroom; yellow (flat abstract wash) stays random-rotation only.
