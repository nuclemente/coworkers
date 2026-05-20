#!/usr/bin/env bash
# transcript-digest-rotate.sh
# Apaga transcrições brutas em TRANSCRIPTS_RAW_DIR com mtime > TRANSCRIPT_RAW_RETENTION_DAYS.
# Invocação:
#   ./bin/transcript-digest-rotate.sh             # apaga e loga
#   ./bin/transcript-digest-rotate.sh --dry-run   # apenas lista os elegíveis

set -euo pipefail

RAW_DIR="${TRANSCRIPTS_RAW_DIR:-./data/notes/transcripts/raw}"
DAYS="${TRANSCRIPT_RAW_RETENTION_DAYS:-90}"
LOG="${TRANSCRIPT_DIGEST_LOG:-./data/logs/transcript-digest.log}"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ ! -d "$RAW_DIR" ]]; then
  echo "transcript-digest-rotate: diretório '$RAW_DIR' não existe — nada a fazer." >&2
  exit 0
fi

mkdir -p "$(dirname "$LOG")"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "transcript-digest-rotate (dry-run): arquivos com mtime > ${DAYS}d em $RAW_DIR:"
  find "$RAW_DIR" -type f ! -name '.gitkeep' -mtime +"$DAYS" -print
else
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  find "$RAW_DIR" -type f ! -name '.gitkeep' -mtime +"$DAYS" -print -delete \
    | while IFS= read -r f; do
        printf '{"ts":"%s","event":"raw_rotated","path":"%s"}\n' "$TS" "$f" >> "$LOG"
      done
fi
