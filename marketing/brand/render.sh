#!/bin/sh
# Render the brand SVGs into the app's icon assets. Needs rsvg-convert
# (brew install librsvg).
#
#   sh marketing/brand/render.sh        # the two Android launcher layers
#   sh marketing/brand/render.sh all    # those plus the store icon and splash
#
# The Android layers are the ones that change: the foreground has to sit in
# the launcher mask's safe zone and the monochrome layer has to read as the
# pie with nothing but negative space. icon.png and splash-icon.png are
# already in both stores, so they are only re-rendered on request.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="$here/../../app/assets"

render() {
  rsvg-convert -w 1024 -h 1024 "$here/$1" -o "$out/$2"
  echo "  $1 → assets/$2"
}

render icon-foreground.svg android-icon-foreground.png
render icon-monochrome.svg android-icon-monochrome.png
if [ "$1" = all ]; then
  render icon.svg icon.png
  render splash.svg splash-icon.png
fi
