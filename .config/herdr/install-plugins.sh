#!/bin/sh
#
# Install the Herdr plugins this configuration binds keys for. Plugin state
# lives in ~/.config/herdr/plugins.json, which Herdr rewrites and this
# repository therefore does not link.
#
#   Collie   phone bridge for Herdr panes  (github.com/AltanS/collie)
#   Annotate comment on panes and documents (github.com/plannotator/herdr-annotate)
#
# Collie also needs a config file it owns; see .config/herdr/collie.env.example.

set -eu

command -v herdr >/dev/null 2>&1 || {
  printf '%s\n' "install-plugins.sh: herdr is not on PATH" >&2
  exit 1
}

herdr plugin install AltanS/collie "$@"
herdr plugin install plannotator/herdr-annotate "$@"

herdr config check
herdr server reload-config
