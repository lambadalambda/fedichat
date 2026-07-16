# Title panel billing is backwards

## Summary

The cast list reads "lain as Jordan" — but the Comic Chat character is
the actor and the fedi user is the role (the nametags already label the
drawn character with the user's name). Credits should read
"Jordan as lain".

## Requirements

- Swap the order in both rendering backends (DOM title panel and canvas
  export).

## Acceptance Criteria

- Title panel shows `<character> as <user>` in the viewer and in the
  exported PNG.
