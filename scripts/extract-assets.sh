#!/bin/sh
# Re-extract Comic Chat graphics from scratch.
# Pipeline: microsoft/comic-chat repo (MIT) -> raw .avb/.bgb -> deark -> PNGs with alpha.
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

# Art files come from Microsoft's official MIT-licensed source release
# (github.com/microsoft/comic-chat). The MS Chat 2.5 roster spans two trees
# there: comicart/ (base set) and artpack1/ (Art Pack 1, incl. the den and
# volcano backgrounds). bolo/cro/denise/lynnea exist in both; artpack1's
# variants match the shipped 2.5 release, comicart's are larger pre-release
# builds, so those four are taken from artpack1.
BASE="https://raw.githubusercontent.com/microsoft/comic-chat/main/v2.5-beta-1"
COMICART="anna.avb armando.avb buck.avb connor.avb dan.avb glenda.avb
hugh.avb jordan.avb kirby.avb lance.avb margaret.avb mike.avb pedagog.avb
rainbow.avb susan.avb tiki.avb tongtyed.avb tux.avb veronica.avb waf.avb
xeno.avb
buckroom.bgb clouds.bgb field.bgb pastoral.bgb room.bgb space.bgb yellow.bgb"
ARTPACK1="bolo.avb cro.avb denise.avb kevin.avb kwensa.avb lynnea.avb
maynard.avb rebecca.avb sage.avb scotty.avb den.bgb volcano.bgb"
mkdir -p "$ROOT/raw"
for f in $COMICART; do curl -sfL "$BASE/comicart/$f" -o "$ROOT/raw/$f"; done
for f in $ARTPACK1; do curl -sfL "$BASE/artpack1/$f" -o "$ROOT/raw/$f"; done

# Only backgrounds go through deark; character poses are composited from
# the raw .avb files by extract_poses.py.
for f in "$ROOT"/raw/*.bgb; do
    name="$(basename "${f%.*}")"
    mkdir -p "$ROOT/assets/$name"
    "$DEARK" -od "$ROOT/assets/$name" -o "$name" "$f"
done
