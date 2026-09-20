#!/bin/bash
# Turns paneru's event stream into a single SketchyBar event.
#
# paneru already coalesces duplicate events per ECS tick, so every line is a
# real state change and can be forwarded as-is. If the daemon restarts the
# stream ends; the loop waits and reattaches rather than dying silently.
while true; do
	paneru subscribe --json 2>/dev/null | while read -r _line; do
		sketchybar --trigger paneru_change
	done
	sleep 2
done
