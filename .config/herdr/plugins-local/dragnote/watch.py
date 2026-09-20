#!/usr/bin/env python3
"""드래그 모드가 켜져 있는 동안 클립보드를 지켜보다 코멘트 창을 띄운다."""
import json, os, signal, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import LOCK, PAYLOAD, PID, agents, focused_pane_id, locate, mark, notify, pbpaste

POLL_SECONDS = 0.35
MARK_SECONDS = 5
HERDR = os.environ.get("HERDR_BIN_PATH", "herdr")


def frontmost():
    try:
        return subprocess.run(
            ["osascript", "-e",
             'tell application "System Events" to name of first process whose frontmost is true'],
            capture_output=True, text=True, timeout=3).stdout.strip()
    except Exception:
        return ""


def open_popup():
    subprocess.run([HERDR, "plugin", "pane", "open", "--plugin", "dragnote",
                    "--entrypoint", "note", "--focus"], capture_output=True)


def main():
    # SIGTERM은 기본 동작이 즉시 종료라 finally가 돌지 않는다
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    with open(PID, "w") as f:
        f.write(str(os.getpid()))
    last = pbpaste()
    was_open = False
    marked_at = 0.0
    try:
        while True:
            time.sleep(POLL_SECONDS)
            if time.time() - marked_at > MARK_SECONDS:
                mark(True)
                marked_at = time.time()
            if os.path.exists(LOCK):
                was_open = True
                continue
            current = pbpaste()
            if was_open:
                # 코멘트 결과가 클립보드에 올라온 것이므로 다시 띄우지 않는다
                was_open = False
                last = current
                continue
            if current == last or not current.strip():
                last = current
                continue
            last = current
            # 터미널 바깥에서 복사한 것은 무시한다
            if "wezterm" not in frontmost().lower():
                continue
            # 포커스는 팝업이 뜨는 순간 팝업으로 넘어가므로 지금 찍어 둔다
            payload = {
                "text": current,
                "source": locate(current),
                "focused_pane_id": focused_pane_id(),
                "agents": agents(),
            }
            with open(PAYLOAD, "w") as f:
                json.dump(payload, f)
            open(LOCK, "w").close()
            open_popup()
    finally:
        mark(False)
        for path in (PID, LOCK):
            try:
                os.remove(path)
            except OSError:
                pass


if __name__ == "__main__":
    main()
