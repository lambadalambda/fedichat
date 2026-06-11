# Title panel with cast list

## Summary

The paper's Figure 7 opens each comic with a title panel listing the most
active participants and their character icons. Add one as the first panel.

## Requirements

- Extract the 40x40 character icons in `scripts/extract_poses.py` (chunk
  0x0003/0x0100) and add them to the manifest.
- First panel of the strip: thread title ("STARRING"), participants ordered
  by post count with icon + display name + character name.
- Cap the cast list at what fits (paper lists "most active" participants).

## Acceptance Criteria

- Rendering a thread shows a leading title panel with icons and names.
- Icons match each participant's assigned character.
