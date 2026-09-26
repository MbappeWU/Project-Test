#!/usr/bin/env sh
# Downloads the SIL Open Font License fonts used for inscriptions, seals and captions.
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/fonts"
BASE="https://raw.githubusercontent.com/google/fonts/main/ofl"
mkdir -p "$DIR"
fetch() {
  [ -s "$DIR/$2" ] && return 0
  echo "fetching $2"
  curl -fsSL -o "$DIR/$2" "$BASE/$1"
}
fetch "zhimangxing/ZhiMangXing-Regular.ttf" "ZhiMangXing-Regular.ttf"
fetch "mashanzheng/MaShanZheng-Regular.ttf" "MaShanZheng-Regular.ttf"
fetch "cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf" "CormorantGaramond.ttf"
fetch "cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf" "CormorantGaramond-Italic.ttf"
fetch "zhimangxing/OFL.txt" "OFL.txt"
echo "fonts ready in $DIR"
