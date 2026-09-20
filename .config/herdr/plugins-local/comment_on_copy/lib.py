import json, os, re, socket, subprocess

STATE = os.environ.get("HERDR_PLUGIN_STATE_DIR") or os.path.expanduser(
    "~/.local/state/herdr/plugins/comment_on_copy"
)
os.makedirs(STATE, exist_ok=True)
PID = os.path.join(STATE, "watch.pid")
PAYLOAD = os.path.join(STATE, "payload.json")
LOCK = os.path.join(STATE, "popup.lock")


def call(method, params):
    """herdr 소켓 API 한 번 호출."""
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect(os.environ["HERDR_SOCKET_PATH"])
    s.sendall((json.dumps({"id": "comment_on_copy", "method": method, "params": params}) + "\n").encode())
    buf = b""
    while b"\n" not in buf:
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
    s.close()
    return json.loads(buf.decode().strip())


def pbpaste():
    try:
        return subprocess.run(["pbpaste"], capture_output=True, text=True, timeout=2).stdout
    except Exception:
        return ""


def pbcopy(text):
    subprocess.run(["pbcopy"], input=text, text=True, timeout=2)


def notify(title, body=None):
    cmd = [os.environ.get("HERDR_BIN_PATH", "herdr"), "notification", "show", title]
    if body:
        cmd += ["--body", body]
    subprocess.run(cmd, capture_output=True)


def locate(text):
    """클립보드 텍스트가 어느 pane 어느 줄에서 왔는지 되짚는다. 실패하면 None."""
    needle = text.strip().split("\n")[0].strip()
    if len(needle) < 4:
        return None
    try:
        panes = call("pane.list", {})["result"]["panes"]
    except Exception:
        return None
    ordered = sorted(panes, key=lambda p: not p.get("focused"))
    for pane in ordered:
        try:
            body = call(
                "pane.read",
                {"pane_id": pane["pane_id"], "source": "visible", "format": "text"},
            )["result"]["read"]["text"]
        except Exception:
            continue
        for row, line in enumerate(body.split("\n")):
            col = line.find(needle)
            if col >= 0:
                return {"pane_id": pane["pane_id"], "row": row, "col": col,
                        "label": pane.get("label") or pane.get("title") or pane["pane_id"]}
    return None


def _labels(method, key, id_field):
    try:
        rows = call(method, {})["result"][key]
    except Exception:
        return {}
    return {r[id_field]: (r.get("label") or r[id_field]) for r in rows if r.get(id_field)}


def _name(agents):
    """겹칠 때만 꼬리를 붙인다. 구분이 필요 없으면 짧게 둔다."""
    def base(a):
        return "%s \u00b7 %s" % (a["agent"], a["workspace"])

    for agent in agents:
        agent["name"] = base(agent)
    for field in ("tab", "pane_no"):
        seen = {}
        for agent in agents:
            seen.setdefault(agent["name"], []).append(agent)
        for name, group in seen.items():
            if len(group) > 1:
                for agent in group:
                    agent["name"] = "%s \u00b7 %s" % (name, agent[field])
    return agents


def agents():
    """지금 살아 있는 에이전트 pane 목록. 이름은 사람이 읽는 기준으로 만든다."""
    try:
        rows = call("agent.list", {})["result"]["agents"]
    except Exception:
        return []
    spaces = _labels("workspace.list", "workspaces", "workspace_id")
    tabs = _labels("tab.list", "tabs", "tab_id")
    out = []
    for row in rows:
        pane_id = row.get("pane_id")
        if not pane_id:
            continue
        out.append({
            "pane_id": pane_id,
            "pane_no": pane_id.split(":")[-1],
            "workspace_id": row.get("workspace_id"),
            "tab_id": row.get("tab_id"),
            "agent": row.get("agent") or "agent",
            "workspace": spaces.get(row.get("workspace_id"), row.get("workspace_id") or "?"),
            "tab": tabs.get(row.get("tab_id"), ""),
            "status": row.get("agent_status") or "unknown",
            "title": row.get("terminal_title_stripped") or "",
            "cwd": row.get("cwd") or "",
        })
    return _name(out)


def focused_pane_id():
    try:
        return call("pane.current", {})["result"]["pane"]["pane_id"]
    except Exception:
        return None


def submit(pane_id, text):
    """텍스트와 Enter를 한 덩어리로 보낸다. 에이전트가 승인 대기 중이면 herdr가 거절한다."""
    reply = call("agent.prompt", {"target": pane_id, "text": text})
    if "error" in reply:
        return False, reply["error"].get("message", "제출에 실패했습니다")
    return True, ""


def send_input(pane_id, text):
    """제출하지 않고 입력창에 꽂는다. send_text와 달리 개행이 Enter가 되지 않는다."""
    reply = call("pane.send_input", {"pane_id": pane_id, "text": text})
    return "error" not in reply


MARK_TOKEN = "comment_on_copy"
MARK_TEXT = "comment"


def mark(on):
    """모드가 켜져 있다는 표시를 사이드바 workspace 행에 올린다."""
    try:
        spaces = call("workspace.list", {})["result"]["workspaces"]
    except Exception:
        return
    for space in spaces:
        try:
            call("workspace.report_metadata", {
                "workspace_id": space["workspace_id"],
                "source": "comment_on_copy",
                "tokens": {MARK_TOKEN: MARK_TEXT if on else ""},
                # watcher가 갱신을 멈추면 표시가 저절로 사라진다
                "ttl_ms": 15000 if on else 1,
            })
        except Exception:
            pass


def short(path):
    home = os.path.expanduser("~")
    return "~" + path[len(home):] if path.startswith(home) else path


def git_branch(cwd):
    if not cwd:
        return None
    try:
        out = subprocess.run(["git", "-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"],
                             capture_output=True, text=True, timeout=2)
    except Exception:
        return None
    return out.stdout.strip() or None


def running(pane_id):
    """그 pane에서 무엇이 돌고 있었는지. 에러를 뱉은 명령이 여기 남는다."""
    try:
        info = call("pane.process_info", {"pane_id": pane_id})["result"]["process_info"]
    except Exception:
        return None
    procs = info.get("foreground_processes") or []
    if not procs:
        return None
    last = procs[-1]
    name = (last.get("name") or last.get("argv0") or "").lstrip("-")
    args = [a for a in (last.get("argv") or [])[1:] if not a.startswith("-")]
    if name and args:
        return "%s %s" % (name, " ".join(args[:2]))
    return name or None


def files_in(text, cwd):
    """텍스트에 나온 경로 중 실제로 있는 것만 고른다. 없으면 아무것도 붙이지 않는다."""
    found = []
    for token in re.findall(r"[\w./~@+-]+\.[\w]+(?::\d+)?", text):
        path = token.split(":")[0]
        full = os.path.expanduser(path) if path.startswith("~") else os.path.join(cwd or "", path)
        if token not in found and os.path.exists(full):
            found.append(token)
    return found[:5]


def build_context(pane_id, text, source):
    """복사 시점의 주변 정보를 모은다. 값이 없는 항목은 넣지 않는다."""
    rows = []
    pane = {}
    if pane_id:
        try:
            pane = call("pane.get", {"pane_id": pane_id})["result"]["pane"]
        except Exception:
            pane = {}
    spaces = _labels("workspace.list", "workspaces", "workspace_id")
    tabs = _labels("tab.list", "tabs", "tab_id")
    cwd = pane.get("foreground_cwd") or pane.get("cwd")

    if pane.get("workspace_id"):
        rows.append(("workspace", spaces.get(pane["workspace_id"], pane["workspace_id"])))
    if pane.get("tab_id"):
        rows.append(("tab", tabs.get(pane["tab_id"], pane["tab_id"])))
    if pane_id:
        who = pane.get("agent") or running(pane_id) or "shell"
        rows.append(("pane", "%s (%s)" % (pane_id, who)))
    if pane.get("terminal_title_stripped"):
        rows.append(("title", pane["terminal_title_stripped"]))
    if cwd:
        rows.append(("cwd", short(cwd)))
    branch = git_branch(cwd)
    if branch:
        rows.append(("branch", branch))

    body = text.rstrip("\n")
    origin = find_source(body, cwd)
    count = len(body.split("\n"))
    shape = "%d line%s, %d chars" % (count, "" if count == 1 else "s", len(body))
    # 파일 위치를 알아냈으면 화면 좌표까지 둘 이유가 없다
    if source and not origin:
        shape += ", screen row %d" % source["row"]
    rows.append(("selection", shape))
    if origin:
        rows.append(("file", origin))
    files = [f for f in files_in(body, cwd) if not origin or not f.startswith(origin.split(":")[0])]
    if files:
        rows.append(("files", " ".join(files)))
    return rows


def find_source(text, cwd):
    """복사한 내용이 어느 파일에서 왔는지 저장소에서 찾는다.

    편집기 안에서 복사하면 파일 이름이 어디에도 남지 않는다. 가장 긴 줄로
    검색해서 한두 파일로 좁혀질 때만 결과를 쓴다.
    """
    if not cwd or not os.path.isdir(cwd):
        return None
    lines = [l.strip() for l in text.split("\n")]
    needle = max(lines, key=len) if lines else ""
    if len(needle) < 30:
        return None
    try:
        hit = subprocess.run(
            ["rg", "--fixed-strings", "--line-number", "--max-count", "1",
             "--no-messages", "--", needle, cwd],
            capture_output=True, text=True, timeout=3)
    except Exception:
        return None
    rows = [r for r in hit.stdout.split("\n") if r.strip()]
    if not rows or len(rows) > 3:
        return None
    path, _, rest = rows[0].partition(":")
    line = rest.split(":")[0]
    # 검색에 쓴 줄이 아니라 선택 범위가 시작하는 줄을 가리키게 한다
    head = next((l for l in lines if len(l) >= 12), "")
    if head and head != needle:
        try:
            first = subprocess.run(
                ["rg", "--fixed-strings", "--line-number", "--max-count", "1",
                 "--no-messages", "--", head, path],
                capture_output=True, text=True, timeout=2)
            found = first.stdout.partition(":")[0]
            if found.strip().isdigit():
                line = found.strip()
        except Exception:
            pass
    return "%s:%s" % (os.path.relpath(path, cwd), line)


def origin_of(pane_id):
    """복사가 일어난 자리. 목적지를 좁힐 때 탭과 workspace 범위로 쓴다."""
    if not pane_id:
        return None
    try:
        pane = call("pane.get", {"pane_id": pane_id})["result"]["pane"]
    except Exception:
        return None
    return {"pane_id": pane_id,
            "tab_id": pane.get("tab_id"),
            "workspace_id": pane.get("workspace_id")}
