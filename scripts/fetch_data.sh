#!/usr/bin/env bash
# Download the raw datasets used by build_data.py into raw/ (not committed to git).
#   1. Sumitro Datta, "NBA Stats (1947-present)" on Kaggle (team/player/award tables)
#   2. DomSamangy/NBA_Shots_04_25 on GitHub (every regular-season shot, 2003-04 to 2024-25)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw/kaggle raw/shots

echo "Downloading Kaggle NBA Stats dataset..."
curl -fsSL -o raw/nba-aba-baa-stats.zip \
  https://www.kaggle.com/api/v1/datasets/download/sumitrodatta/nba-aba-baa-stats
unzip -oq raw/nba-aba-baa-stats.zip -d raw/kaggle

echo "Downloading shot location files (2004-2025)..."
for y in $(seq 2004 2025); do
  curl -fsSL -o "raw/shots/NBA_${y}_Shots.csv.zip" \
    "https://raw.githubusercontent.com/DomSamangy/NBA_Shots_04_25/main/NBA_${y}_Shots.csv.zip" &
done
wait
for f in raw/shots/*.zip; do unzip -oq "$f" -d raw/shots -x '__MACOSX/*'; done
echo "Done. Now run: python3 scripts/build_data.py"
