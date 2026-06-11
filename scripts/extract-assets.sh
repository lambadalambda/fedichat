#!/bin/sh
# Re-extract Comic Chat graphics from scratch.
# Pipeline: archive.org installer (.exe, old CAB) -> bsdtar -> deark -> PNGs with alpha.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# deark has native support for the Comic Chat .avb/.bgb format ("comicchat" module).
# Built from source because Homebrew is broken on this machine; on macOS the
# st_mtim fields need guarding (upstream sets _POSIX_C_SOURCE but Darwin uses
# st_mtimespec).
git clone --depth 1 https://github.com/jsummers/deark.git "$WORK/deark"
sed -i '' 's/#if _POSIX_C_SOURCE >= 200809L$/#if _POSIX_C_SOURCE >= 200809L \&\& !defined(__APPLE__)/' \
    "$WORK/deark/src/deark-unix.c"
make -C "$WORK/deark" -j8
DEARK="$WORK/deark/deark"

# MS Chat 2.5 installer: a self-extracting CAB that macOS bsdtar reads directly.
curl -sL "https://archive.org/download/tucows_193891_Microsoft_Chat/Mschat25.exe" \
    -o "$WORK/Mschat25.exe"
mkdir -p "$ROOT/raw"
(cd "$WORK" && bsdtar -xf Mschat25.exe)
cp "$WORK"/*.avb "$WORK"/*.bgb "$ROOT/raw/"

for f in "$ROOT"/raw/*.avb "$ROOT"/raw/*.bgb; do
    name="$(basename "${f%.*}")"
    mkdir -p "$ROOT/assets/$name"
    "$DEARK" -od "$ROOT/assets/$name" -o "$name" "$f"
done
