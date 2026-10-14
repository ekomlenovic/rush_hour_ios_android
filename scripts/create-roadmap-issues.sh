#!/usr/bin/env bash
# Crée une issue GitHub par fichier de docs/roadmap/ (hors README).
# Format attendu : ligne 1 « # Titre », ligne 2 « labels: a, b », puis le corps.
# Usage : ./scripts/create-roadmap-issues.sh [--dry-run]
set -euo pipefail

cd "$(dirname "$0")/.."
DRY_RUN="${1:-}"

for file in docs/roadmap/[0-9]*.md; do
  title=$(sed -n '1s/^# //p' "$file")
  labels=$(sed -n '2s/^labels: *//p' "$file" | tr -d ' ')
  body=$(tail -n +3 "$file")

  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo "[$labels] $title"
    continue
  fi

  IFS=',' read -ra label_list <<< "$labels"
  for label in "${label_list[@]}"; do
    gh label create "$label" --force >/dev/null 2>&1 || true
  done

  gh issue create --title "$title" --label "$labels" --body "$body"
done
