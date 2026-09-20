#!/usr/bin/env python3
"""드래그 모드가 켜져 있는 동안 클립보드를 지켜보다 코멘트 창을 띄운다."""
import hashlib, json, os, signal, subprocess, sys, time
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import (LOCK, PAYLOAD, PID, agents, build_context, focused_pane_id, locate,
                 mark, notify, pbpaste)

POLL_SECONDS = 0.35
MARK_SECONDS = 5
HERE = os.path.dirname(os.path.abspath(__file__))
TRACE = os.path.join(os.path.dirname(PID), "trace.log")
SEEN_LIMIT = 60
HERDR = os.environ.get("HERDR_BIN_PATH", "herdr")


def trace(line):
    """왜 띄웠고 왜 안 띄웠는지 남긴다. 오탐을 눈으로 확인하려면 이게 필요하다."""
    try:
        with open(TRACE, "a") as f:
            f.write("%s %s\n" % (time.strftime("%H:%M:%S"), line))
    except OSError:
        pass


def is_terminal(name):
    return "wezterm" in (name or "").lower()


def stamp():
    """플러그인 소스의 최신 수정 시각."""
    newest = 0.0
    for name in os.listdir(HERE):
        if name.endswith(".py"):
            newest = max(newest, os.path.getmtime(os.path.join(HERE, name)))
    return newest


def frontmost():
    """최전면 앱 이름. osascript는 한 번에 200ms 가까이 걸려 매 틱 쓰기에 무겁다."""
    try:
        asn = subprocess.run(["lsappinfo", "front"], capture_output=True, text=True,
                             timeout=2).stdout.strip()
        if not asn:
            return ""
        out = subprocess.run(["lsappinfo", "info", "-only", "name", asn],
                             capture_output=True, text=True, timeout=2).stdout
    except Exception:
        return ""
    _, _, rest = out.partition("=")
    return rest.strip().strip('"')


def open_popup():
    subprocess.run([HERDR, "plugin", "pane", "open", "--plugin", "comment_on_copy",
                    "--entrypoint", "note", "--focus"], capture_output=True)


def main():
    # SIGTERM은 기본 동작이 즉시 종료라 finally가 돌지 않는다
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    with open(PID, "w") as f:
        f.write(str(os.getpid()))
    last = pbpaste()
    was_open = False
    marked_at = 0.0
    source_stamp = stamp()
    front = ""
    # 클립보드 도구가 히스토리에서 되돌린 값을 사람이 새로 복사한 것과 구분한다
    seen = deque(maxlen=SEEN_LIMIT)
    seen.append(hashlib.md5(last.encode()).hexdigest())
    try:
        while True:
            time.sleep(POLL_SECONDS)
            if time.time() - marked_at > MARK_SECONDS:
                mark(True)
                marked_at = time.time()
                # 코드를 고쳤는데 옛 코드가 계속 도는 일이 잦아 스스로 다시 뜬다
                if stamp() != source_stamp and not os.path.exists(LOCK):
                    os.execv(sys.executable, [sys.executable, os.path.abspath(__file__)])
            if os.path.exists(LOCK):
                was_open = True
                continue
            before, front = front, frontmost()
            current = pbpaste()
            if was_open:
                # 코멘트 결과가 클립보드에 올라온 것이므로 다시 띄우지 않는다.
                # 나중에 히스토리에서 되돌아와도 새 값으로 보이지 않게 기억해 둔다
                was_open = False
                last = current
                seen.append(hashlib.md5(current.encode()).hexdigest())
                continue
            if current == last or not current.strip():
                last = current
                continue
            last = current
            # Raycast 같은 클립보드 도구는 고른 항목을 클립보드에 쓴 뒤 붙여넣는다.
            # 그 순간의 최전면은 그 도구이므로, 복사 직전에도 터미널이 앞에 있었을
            # 때만 사람이 복사한 것으로 본다.
            mark_id = hashlib.md5(current.encode()).hexdigest()
            repeat = mark_id in seen
            seen.append(mark_id)
            taken = is_terminal(front) and is_terminal(before) and not repeat
            why = "열음"
            if repeat:
                why = "무시(이미 본 값)"
            elif not taken:
                why = "무시(터미널 밖)"
            trace("before=%s front=%s %s %r" % (before or "-", front or "-", why, current[:40]))
            if not taken:
                continue
            # 포커스는 팝업이 뜨는 순간 팝업으로 넘어가므로 지금 찍어 둔다
            focused = focused_pane_id()
            source = locate(current)
            payload = {
                "text": current,
                "source": source,
                "focused_pane_id": focused,
                "agents": agents(),
                # 복사 시점의 주변 정보. 창이 뜬 뒤에 물어보면 이미 달라져 있다
                "context": build_context(source["pane_id"] if source else focused, current, source),
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
