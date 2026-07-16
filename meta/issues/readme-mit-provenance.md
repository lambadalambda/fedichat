# Update README art provenance for the MIT-licensed microsoft/comic-chat release

## Summary

On 2026-07-16 Microsoft open-sourced Comic Chat at
<https://github.com/microsoft/comic-chat> under the MIT License
(announcement: <https://opensource.microsoft.com/blog/2026/07/16/microsoft-comic-chat-is-now-open-source/>).
The release includes the v2.5-beta-1 source tree with the actual art assets:
`comicart/` and `artpack1/` together contain every `.avb`/`.bgb` file this
project uses. The README's "abandonware extracted from the archive.org
installer, if you're Microsoft and mind, open an issue" stance is now
obsolete and undersells the project's legal footing.

## Requirements

- Rewrite the provenance paragraph in `README.md` to cite the official
  microsoft/comic-chat repository and its MIT License as the source of the
  art, replacing the abandonware disclaimer.
- Keep the Jim Woodring attribution and the Microsoft copyright line.
- Note honestly that the MIT LICENSE sits at the repo root with no separate
  asset carve-out, but the announcement does not explicitly discuss the
  artwork licensing.
- Update the `scripts/extract-assets.sh` description line in the Layout
  section if the extraction source changes (see
  [repoint-asset-extraction](repoint-asset-extraction.md)).

## Acceptance Criteria

- `README.md` no longer contains the "spirit of abandonware preservation"
  disclaimer.
- `README.md` links to <https://github.com/microsoft/comic-chat> and states
  the MIT License provenance.

## Notes

- Related: [[repoint-asset-extraction]], [[adopt-full-character-roster]].
