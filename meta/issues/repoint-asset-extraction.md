# Repoint asset extraction from the archive.org installer to microsoft/comic-chat

## Summary

`scripts/extract-assets.sh` downloads the MS Chat 2.5 self-extracting CAB
installer from archive.org and unpacks it with bsdtar to obtain the
`.avb`/`.bgb` files. The official microsoft/comic-chat repository now hosts
the same files directly under `v2.5-beta-1/comicart/` and
`v2.5-beta-1/artpack1/`, MIT-licensed. Fetching them from there is simpler
(no CAB unpacking), more durable, and cleaner provenance.

Verified 2026-07-16: the union of `comicart/` and `artpack1/` contains every
file currently in `raw/` (22 `.avb` + 5 `.bgb`), plus extras we don't ship
yet.

## Requirements

- Replace the archive.org download + bsdtar step in
  `scripts/extract-assets.sh` with fetching the `.avb`/`.bgb` files from
  `https://github.com/microsoft/comic-chat` (raw file URLs or a shallow
  clone).
- Keep the rest of the pipeline (deark → PNGs into `assets/<name>/`)
  unchanged.
- Keep fetching only the current roster (the files already in `raw/`);
  adding the new characters is [[adopt-full-character-roster]].

## Acceptance Criteria

- Running the fetch step yields `.avb`/`.bgb` files whose SHA-256 hashes are
  compared against the current `raw/` contents, and any differences (beta-1
  vs. release bytes) are documented in the issue or DEVLOG.
- The script no longer references archive.org.

## Notes

- The MS repo files come from the *2.5 beta 1* tree while `raw/` came from
  the 2.5 release installer, so byte differences are possible; the AVB
  format version should be the same. If hashes differ, spot-check one
  character through `scripts/extract_poses.py`.
- Related: [[readme-mit-provenance]].

## Verification results (2026-07-16)

- All 27 files differ from the installer versions by hash, but composited
  pose PNGs came out byte-identical for spot-checks (anna, kevin, lynnea)
  and a full re-extraction left `assets/chars/` and `manifest.json`
  unchanged except one pose: the deltas are metadata, not art. Consistent
  sizes: comicart `.avb` +2 bytes, artpack1 `.avb` +79, `.bgb` +28..65.
- bolo/cro/denise/lynnea exist in both trees; the comicart variants are
  2-3x larger pre-release builds, artpack1's match the release, so those
  four are fetched from artpack1.
- Three visible differences, all adopted: `xeno` pose02 has 184 stray
  pixels cleaned in the top rows, and the beta `den.bgb`/`volcano.bgb` are
  alternate colorways of the same paintings (volcano: pink mountain/olive
  sky instead of purple/teal; den: purple chair/blue table instead of
  red/gold). The release colorways exist nowhere in microsoft/comic-chat,
  so keeping them would have meant keeping installer-provenance files; the
  installer versions remain in git history before this change.
