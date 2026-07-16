# Export the strip as a PNG

## Summary

The share loop this project wants: render a thread, save the strip as an
image, post it back to fedi. Rendering currently builds DOM directly and
discards the layout model, so export needs a model/backend split first.

## Requirements

- `render()` splits into: build a panel model (cast, poses, balloons,
  narrations, zoom, backgrounds, title panel), then a DOM backend consuming
  it. Behavior unchanged.
- A canvas backend consumes the same model: backgrounds and character PNGs
  via drawImage, balloon bodies via `Path2D(balloonPath(...))`, tails as
  paths, text via fillText with the same font metrics, title panel included.
- Export button in the header draws all panels into one grid canvas and
  downloads a PNG.
- Remote images (attachments, emoji) are fetched with
  `crossOrigin='anonymous'`; ones that fail draw a gray placeholder so the
  canvas never taints.

## Acceptance Criteria

- Exported PNG of the fixture visually matches the DOM strip.
- Export of a real thread with remote media completes without a tainted
  canvas error.

## Notes

- Blocked by [[testable-module]]. Related: [[media-polish]].

## Outcome (2026-07-16)

Shipped. Verified against the fixture and a 57-post mastodon.social
thread with remote media: 2560x9520 canvas, 15.5 MB PNG, ~340 ms, no
canvas taint. Canvas nametags/title render display names with emoji
shortcodes stripped (plainName) — emoji images in *balloon text* export
fine. The download itself couldn't be observed in the automation browser
(headless profiles drop synthetic anchor clicks); the blob-anchor
download needs a quick manual click to confirm.
