#!/usr/bin/env python3
"""선택한 텍스트에 코멘트를 달아 에이전트 입력창에 꽂거나 클립보드로 내보낸다."""
import curses, json, locale, os, sys, termios
from unicodedata import east_asian_width

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import LOCK, PAYLOAD, pbcopy, send_input, submit

locale.setlocale(locale.LC_ALL, "")
# ncurses는 Esc를 시퀀스 시작으로 보고 기본 1초를 기다린다
os.environ.setdefault("ESCDELAY", "25")

QUOTE_LINES = 5
STATUS_ATTR = {"hint": curses.A_DIM}


def width(text):
    return sum(2 if east_asian_width(ch) in "WF" else 1 for ch in text)


def wrap(text, limit):
    """표시 너비 기준으로 접는다. 한글이 섞여도 칸이 어긋나지 않는다."""
    out = []
    for raw in text.split("\n"):
        line, used = "", 0
        for ch in raw:
            w = width(ch)
            if used + w > limit:
                out.append(line)
                line, used = ch, w
            else:
                line += ch
                used += w
        out.append(line)
    return out


class Note:
    def __init__(self, payload):
        self.quote = payload.get("text", "").rstrip("\n")
        self.source = payload.get("source")
        self.agents = payload.get("agents") or []
        self.by_pane = {a["pane_id"]: a for a in self.agents}
        self.target = self.pick_target(payload.get("focused_pane_id"))
        self.lines = [""]
        self.row = 0
        self.col = 0
        self.status = ("type a comment, then ^S or ^E", "hint")
        self.buttons = {}
        self.picking = False
        self.cursor = 0
        self.caret = None

    def say(self, text, kind="hint"):
        self.status = (text, kind)

    def pick_target(self, focused):
        """선택이 나온 pane을 먼저 보고, 없으면 드래그 시점의 포커스 pane을 본다."""
        if self.source and self.source.get("pane_id") in self.by_pane:
            return self.by_pane[self.source["pane_id"]]
        if focused in self.by_pane:
            return self.by_pane[focused]
        return None

    def target_label(self):
        return self.target["name"]

    # --- 입력 -------------------------------------------------------------
    def insert(self, ch):
        line = self.lines[self.row]
        self.lines[self.row] = line[: self.col] + ch + line[self.col :]
        self.col += 1

    def backspace(self):
        if self.col:
            line = self.lines[self.row]
            self.lines[self.row] = line[: self.col - 1] + line[self.col :]
            self.col -= 1
        elif self.row:
            prev = self.lines.pop(self.row)
            self.row -= 1
            self.col = len(self.lines[self.row])
            self.lines[self.row] += prev

    def newline(self):
        line = self.lines[self.row]
        self.lines[self.row] = line[: self.col]
        self.lines.insert(self.row + 1, line[self.col :])
        self.row += 1
        self.col = 0

    def comment(self):
        return "\n".join(self.lines).strip()

    def result(self):
        # 태그로 닫아 두면 선택한 텍스트가 인용이나 코드 블록을 품어도 경계가 흔들리지 않는다
        return "<selection>\n%s\n</selection>\n\n%s" % (self.quote, self.comment())

    # --- 그리기 -----------------------------------------------------------
    def draw(self, scr):
        scr.erase()
        height, cols = scr.getmaxyx()
        inner = max(20, cols - 4)
        self.buttons = {}

        bar = height - 2
        quote_top = 2
        quote_lines = wrap(self.quote, inner - 2)
        quote_show = max(1, min(len(quote_lines), QUOTE_LINES))
        body_top = quote_top + quote_show + 3
        body_show = max(1, bar - body_top - 2)

        self.put(scr, 0, 2, "comment", curses.A_BOLD)
        self.put(scr, 0, 11, "to", curses.A_DIM)
        name = self.target["name"] if self.target else "nowhere"
        self.put(scr, 0, 14, name, curses.A_BOLD if self.target else curses.A_DIM)
        end = 14 + width(name)
        # 목적지를 바꾸는 조작이므로 목적지 옆에 둔다
        if self.agents and (len(self.agents) >= 2 or not self.target):
            pick = "[ ^L  change ]" if self.target else "[ ^L  pick ]"
            self.put(scr, 0, end + 2, pick)
            self.buttons["choose"] = (0, end + 2, end + 2 + width(pick))
            end += 2 + width(pick)
        if self.source:
            origin = "%s row %d" % (self.source["label"], self.source["row"])
            start = cols - 2 - width(origin)
            if start > end + 2:
                self.put(scr, 0, start, origin, curses.A_DIM)

        more = len(quote_lines) - quote_show
        title = "selected" + (" +%d" % more if more > 0 else "")
        self.frame(scr, quote_top, cols, quote_show + 2, title)
        for i, line in enumerate(quote_lines[:quote_show]):
            self.put(scr, quote_top + 1 + i, 3, line, curses.A_DIM)

        if self.picking:
            self.draw_picker(scr, body_top, cols, body_show)
        else:
            self.draw_input(scr, body_top, cols, body_show, height)

        self.draw_bar(scr, bar, inner)
        text, kind = self.status
        self.put(scr, height - 1, 2, text[:inner], STATUS_ATTR.get(kind, curses.A_DIM))
        # 커서는 맨 마지막에 놓는다. 앞에서 놓으면 이후 그리기가 끌고 간다
        curses.curs_set(0 if self.picking else 1)
        if self.caret:
            y, x = self.caret
            try:
                scr.move(max(0, min(y, height - 1)), max(0, min(x, cols - 1)))
            except curses.error:
                pass
        scr.refresh()

    def draw_input(self, scr, top, cols, show, height):
        self.frame(scr, top, cols, show + 2, "comment")
        first = max(0, self.row - show + 1)
        for i, line in enumerate(self.lines[first : first + show]):
            self.put(scr, top + 1 + i, 3, line)
        self.caret = (top + 1 + (self.row - first),
                      3 + width(self.lines[self.row][: self.col]))

    def draw_picker(self, scr, top, cols, show):
        self.frame(scr, top, cols, show + 2, "send to   \u2191\u2193 enter   esc cancel")
        room = max(10, cols - 40)
        for i, agent in enumerate(self.agents[:show]):
            mark = "▸" if i == self.cursor else " "
            title = agent["title"] or "—"
            text = "%s %d. %-22s %-9s %s" % (
                mark, i + 1, agent["name"], agent["status"], title[:room])
            attr = curses.A_BOLD if i == self.cursor else 0
            self.put(scr, top + 1 + i, 3, text, attr)
            self.buttons["pick:%d" % i] = (top + 1 + i, 3, 3 + width(text) + 2)

    def draw_bar(self, scr, bar, inner):
        items = [("close", "[ esc  close ]", 0), ("copy", "[ ^Y  copy ]", 0)]
        if self.target:
            items.append(("send", "[ ^S  insert ]", 0))
            items.append(("send_now", "[ ^E  send ]", curses.A_BOLD))
        x = 2
        for name, text, attr in items:
            self.put(scr, bar, x, text, attr)
            self.buttons[name] = (bar, x, x + width(text))
            x += width(text) + 2

    def put(self, scr, y, x, text, attr=0):
        try:
            scr.addstr(y, x, text, attr)
        except curses.error:
            pass

    def frame(self, scr, top, cols, height, title):
        inner = max(20, cols - 4)
        self.put(scr, top, 2, "┌" + title + "─" * max(0, inner - width(title) - 2) + "┐")
        for i in range(1, height - 1):
            self.put(scr, top + i, 2, "│")
            self.put(scr, top + i, 2 + inner - 1, "│")
        self.put(scr, top + height - 1, 2, "└" + "─" * (inner - 2) + "┘")

    def hit(self, y, x):
        for name, (by, start, end) in self.buttons.items():
            if y == by and start <= x < end:
                return name
        return None

    # --- 동작 -------------------------------------------------------------
    def deliver(self, scr, agent, now=False):
        if not self.comment():
            self.say("nothing yet, the comment is empty", "warn")
            return False
        if now:
            ok, why = submit(agent["pane_id"], self.result())
            # 에이전트가 승인 대기 중이면 herdr가 거절한다. 그대로 보여준다
            self.say("sent \u2192 %s" % agent["name"], "ok") if ok else self.say(why, "warn")
            if not ok:
                self.draw(scr)
                curses.napms(1200)
                return False
        elif send_input(agent["pane_id"], self.result()):
            self.say("inserted \u2192 %s" % agent["name"], "ok")
        else:
            pbcopy(self.result() + "\n")
            self.say("insert failed, copied to clipboard instead", "warn")
        self.draw(scr)
        curses.napms(700)
        return True

    def copy(self):
        """복사는 창을 닫지 않는다. 이어서 목적지를 바꿔 보낼 수 있다."""
        if not self.comment():
            self.say("nothing yet, the comment is empty", "warn")
            return
        pbcopy(self.result() + "\n")
        self.say("copied to clipboard", "ok")


def read_event(scr):
    """마우스는 ncurses에 맡기지 않고 SGR 시퀀스를 직접 읽는다."""
    key = scr.get_wch()
    if key != "\x1b":
        return ("key", key)
    scr.timeout(60)
    seq = ""
    try:
        while True:
            ch = scr.get_wch()
            if not isinstance(ch, str):
                break
            seq += ch
            if ch.isalpha() or len(seq) > 24:
                break
    except curses.error:
        pass
    finally:
        scr.timeout(-1)
    if not seq:
        return ("key", "\x1b")
    if seq.startswith("[<") and seq[-1] in "Mm":
        parts = seq[2:-1].split(";")
        if len(parts) == 3:
            button, col, row = (int(p) for p in parts)
            return ("mouse", (button, col - 1, row - 1, seq[-1]))
    return ("seq", seq)


def run(scr, note):
    if hasattr(curses, "set_escdelay"):
        curses.set_escdelay(25)
    try:
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(1, curses.COLOR_GREEN, -1)
        curses.init_pair(2, curses.COLOR_YELLOW, -1)
        STATUS_ATTR["ok"] = curses.color_pair(1)
        STATUS_ATTR["warn"] = curses.color_pair(2)
    except curses.error:
        pass
    curses.curs_set(1)
    curses.mousemask(curses.ALL_MOUSE_EVENTS)
    scr.keypad(True)
    sys.stdout.write("\x1b[?1000h\x1b[?1006h")
    sys.stdout.flush()
    fd = sys.stdin.fileno()
    saved = termios.tcgetattr(fd)
    flags = termios.tcgetattr(fd)
    flags[0] &= ~(termios.IXON | termios.IXOFF)  # ^S가 XOFF로 먹히지 않게 한다
    # macOS는 ^Y를 VDSUSP로 쓴다. 그대로 두면 프로세스가 중단되고 앱까지 오지 않는다
    disable = b"\xff"
    for index, value in enumerate(flags[6]):
        if value in (b"\x19", b"\x0f"):  # ^Y, ^O
            flags[6][index] = disable
    termios.tcsetattr(fd, termios.TCSANOW, flags)
    try:
        loop(scr, note)
    finally:
        termios.tcsetattr(fd, termios.TCSANOW, saved)
        sys.stdout.write("\x1b[?1006l\x1b[?1000l")
        sys.stdout.flush()


def loop(scr, note):
    while True:
        note.draw(scr)
        try:
            kind, key = read_event(scr)
        except curses.error:
            continue
        action = None
        if kind == "mouse":
            button, x, y, press = key
            if press == "M" and button in (0, 16):
                action = note.hit(y, x)
                # shift+클릭은 WezTerm이 가져가므로 ctrl+클릭을 즉시 제출로 쓴다
                if button == 16 and action == "send":
                    action = "send_now"
        elif kind == "seq":
            continue
        elif isinstance(key, str):
            if key in ("\x1b", "\x11", "\x17"):  # Esc, ^Q, ^W
                action = "cancel" if note.picking else "close"
            elif key == "\x13":  # ^S
                action = "send"
            elif key == "\x05":  # ^E
                action = "send_now"
            elif key == "\x19":  # ^Y
                action = "copy"
            elif key == "\x0c":  # ^L
                action = "choose"
            elif key in ("\n", "\r"):
                action = "pick:%d" % note.cursor if note.picking else None
                if not note.picking:
                    note.newline()
            elif key in ("\x7f", "\b"):
                if not note.picking:
                    note.backspace()
            elif note.picking and key.isdigit() and key != "0":
                action = "pick:%d" % (int(key) - 1)
            elif key >= " " and not note.picking:
                note.insert(key)
        else:
            if note.picking:
                if key == curses.KEY_UP:
                    note.cursor = max(0, note.cursor - 1)
                elif key == curses.KEY_DOWN:
                    note.cursor = min(len(note.agents) - 1, note.cursor + 1)
            elif key == curses.KEY_BACKSPACE:
                note.backspace()
            elif key == curses.KEY_LEFT and note.col:
                note.col -= 1
            elif key == curses.KEY_RIGHT and note.col < len(note.lines[note.row]):
                note.col += 1
            elif key == curses.KEY_UP and note.row:
                note.row -= 1
                note.col = min(note.col, len(note.lines[note.row]))
            elif key == curses.KEY_DOWN and note.row < len(note.lines) - 1:
                note.row += 1
                note.col = min(note.col, len(note.lines[note.row]))

        if action == "close":
            return
        if action == "cancel":
            note.picking = False
        elif action == "copy":
            note.copy()
        elif action == "send":
            if note.target and note.deliver(scr, note.target):
                return
        elif action == "send_now":
            if note.target and note.deliver(scr, note.target, now=True):
                return
        elif action == "choose" and note.agents:
            note.picking = True
            note.cursor = 0
        elif action and action.startswith("pick:"):
            index = int(action.split(":")[1])
            if 0 <= index < len(note.agents):
                # 고르면 보내는 것이 아니라 목적지를 바꾼다
                note.target = note.agents[index]
                note.picking = False
                note.say("target \u2192 %s" % note.target["name"], "ok")


def main():
    try:
        with open(PAYLOAD) as f:
            payload = json.load(f)
    except (OSError, ValueError):
        payload = {"text": "(could not read the copied text)"}
    note = Note(payload)
    try:
        curses.wrapper(run, note)
    finally:
        try:
            os.remove(LOCK)
        except OSError:
            pass


if __name__ == "__main__":
    main()
