#!/usr/bin/env bash
# Baut die statische Seite und spielt sie auf den Tabula-Server (ssh-Alias "tabula").
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
rsync -az --delete --rsync-path="sudo rsync" build/ tabula:/opt/tabula/site/
echo "Live: https://tabulasql.de"
