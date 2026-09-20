import json, os, socket, subprocess

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
