#!/usr/bin/env bash
# Baut die statische Seite aus einem sauberen Git-Worktree (nur committeter Stand)
# und spielt sie auf den Tabula-Server (ssh-Alias "tabula").
# Konten sind seit 25.10.2026 freigeschaltet (VITE_ACCOUNTS_LIVE=1).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"
if [ -n "$(git status --porcelain)" ]; then
	echo "Hinweis: uncommittete Änderungen werden NICHT ausgeliefert, gebaut wird HEAD."
fi
WT="$(mktemp -d)/tabula-deploy"
git worktree add --detach "$WT" HEAD >/dev/null
trap 'git -C "$REPO" worktree remove --force "$WT"' EXIT
cd "$WT"
ln -s "$REPO/node_modules" node_modules
VITE_ACCOUNTS_LIVE=1 npm run build
rsync -az --delete --rsync-path="sudo rsync" build/ tabula:/opt/tabula/site/
echo "Live: https://www.tabulasql.de ($(git rev-parse --short HEAD))"
