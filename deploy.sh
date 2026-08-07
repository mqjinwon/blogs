#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Rendering Quarto site..."
quarto render

echo "Staging changes..."
git add _quarto.yml index.qmd custom.scss listing-fix.html deploy.sh .gitignore README.md
git add papers.qmd papers.js papers-include.html post-graph-include.html graph.js post-meta.js scripts/ data/
git add posts/ docs/

# Drop deleted tracked files (e.g. removed about/profile)
git add -u

if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi

msg="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"
git commit -m "$msg"

echo "Pushing..."
git push

echo "Done."
