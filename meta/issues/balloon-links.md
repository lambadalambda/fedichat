# Clickable links in balloons

## Summary

`plainText()` flattens post HTML to `textContent`: a link becomes its raw
URL, gets force-chunked into line-width pieces, rendered ALL CAPS, and
isn't clickable. Mastodon/Pleroma already ship ellipsized display text
inside the `<a>` (`example.com/foo…`) which is what a balloon should show.

## Requirements

- Post content parsing produces spans that preserve `href`.
- Word tokens carry the href on their segments (the mechanism custom emoji
  already use); balloon rendering emits `<a target="_blank" rel="noopener">`
  for linked segments, underlined, still comic-caps.
- `splitLong` slices word tokens directly instead of round-tripping through
  a raw string, so links (and emoji) survive splitting.
- Hashtag and mention anchors stay plain text (they'd link to the remote
  instance UI; out of scope here).

## Acceptance Criteria

- Unit tests: tokens from spans with links keep href across wrapping and
  splitting; display text is the anchor text, not the full URL.
- In the fixture, a link renders shortened, underlined, and opens in a new
  tab.

## Notes

- Related: [[testable-module]].
