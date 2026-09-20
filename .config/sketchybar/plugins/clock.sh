#!/bin/bash
# The launch agent runs sketchybar with LANG=en_US.UTF-8, so the weekday comes
# out as "Sun" unless the locale is set here.
export LC_TIME=ko_KR.UTF-8

sketchybar --set "$NAME" label="$(date '+%-m월 %-d일 (%a) %H:%M')"
