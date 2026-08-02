#!/bin/zsh

set -euo pipefail
umask 077

raw_transcription="${WV_RAW_TRANSCRIPTION:-${WV_TRANSCRIPTION:-}}"
processed_transcription="${WV_TRANSCRIPTION:-$raw_transcription}"
inbox="${TMPDIR%/}/whisper-voice-router"

/bin/mkdir -p "$inbox"
/bin/chmod 700 "$inbox"

request_file="$(/usr/bin/mktemp "$inbox/request.XXXXXXXX")"
request_token="${request_file:t}"
trap '/bin/rm -f "$request_file"' EXIT HUP INT TERM

print -rn -- "$raw_transcription" > "$request_file"
/usr/bin/printf '\0' >> "$request_file"
print -rn -- "$processed_transcription" >> "$request_file"

if ! /usr/bin/open -g "hammerspoon://whisper-voice?request=$request_token"; then
  exit 1
fi

trap - EXIT HUP INT TERM
(
  /bin/sleep 10
  /bin/rm -f "$request_file"
) >/dev/null 2>&1 &
