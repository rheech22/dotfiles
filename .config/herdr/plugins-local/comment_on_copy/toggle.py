#!/usr/bin/env python3
"""드래그 모드를 켜고 끈다. watcher가 살아 있으면 켜진 상태다."""
import os, signal, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import LOCK, PID, mark, notify

HERE = os.path.dirname(os.path.abspath(__file__))


def running_pid():
    try:
        with open(PID) as f:
            pid = int(f.read().strip())
    except (OSError, ValueError):
        return None
    try:
        os.kill(pid, 0)
    except OSError:
        return None
    return pid


def main():
    pid = running_pid()
    if pid:
        os.kill(pid, signal.SIGTERM)
        mark(False)  # watcher가 신호를 못 받고 죽는 경우까지 덮는다
        for path in (PID, LOCK):
            try:
                os.remove(path)
            except OSError:
                pass
        notify("comment on copy: off", "Copying no longer opens the comment window.")
        return
    subprocess.Popen(
        [sys.executable, os.path.join(HERE, "watch.py")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    notify("comment on copy: on", "Copy anything to open the comment window.")


if __name__ == "__main__":
    main()
