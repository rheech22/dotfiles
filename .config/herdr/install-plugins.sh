#!/bin/sh
#
# Install the Herdr plugins this configuration binds keys for. Plugin state
# lives in ~/.config/herdr/plugins.json, which Herdr rewrites and this
# repository therefore does not link.
#
#   Collie   phone bridge for Herdr panes  (github.com/AltanS/collie)
#   Annotate comment on panes and documents (github.com/plannotator/herdr-annotate)
#
# Comment on Copy is maintained in a separate checkout under ~/Projects.
# Override its location with COMMENT_ON_COPY_PLUGIN_DIR.
#
# Collie also needs a config file it owns; see .config/herdr/collie.env.example.

set -eu

command -v herdr >/dev/null 2>&1 || {
  printf '%s\n' "install-plugins.sh: herdr is not on PATH" >&2
  exit 1
}

comment_on_copy_dir=${COMMENT_ON_COPY_PLUGIN_DIR:-"$HOME/Projects/herdr-comment-on-copy"}
if [ ! -f "$comment_on_copy_dir/herdr-plugin.toml" ]; then
  printf '%s\n' "install-plugins.sh: Comment on Copy is missing: $comment_on_copy_dir" >&2
  printf '%s\n' "Clone the standalone plugin there, or set COMMENT_ON_COPY_PLUGIN_DIR to its checkout." >&2
  exit 1
fi

sh "$comment_on_copy_dir/scripts/run.sh" install

herdr plugin install AltanS/collie "$@"
herdr plugin install plannotator/herdr-annotate "$@"

herdr plugin link "$comment_on_copy_dir"

herdr config check
herdr server reload-config
