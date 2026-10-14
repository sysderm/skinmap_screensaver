"""Shared image readiness; stores only ephemeral slot and opaque image IDs."""
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

DELAY_MS = 15000
states = {}
lock = threading.Lock()


def readiness(slot, key, announce=False, now=None):
    now = time.time() if now is None else now
    if abs(slot - int(now // 60)) > 1:
        raise ValueError("expired slot")
    if not re.fullmatch(r"(?:neighbour|random):[A-Za-z0-9_-]{1,80}", key):
        raise ValueError("invalid key")
    with lock:
        for old in list(states):
            if old[0] < int(now // 60) - 1:
                del states[old]
        identity = (slot, key)
        if announce:
            states.setdefault(identity, now)
        ready_at = states.get(identity)
    if ready_at is None:
        return {"ready": False}
    return {"ready": True, "remaining_ms": max(0, DELAY_MS - (now-ready_at)*1000)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def handle_state(self, announce):
        try:
            url = urlparse(self.path)
            if url.path != "/api/display-ready":
                self.send_error(404)
                return
            params = parse_qs(url.query)
            result = readiness(int(params["slot"][0]), params["key"][0], announce)
            body = json.dumps(result).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ValueError, KeyError, IndexError):
            self.send_error(400)

    def do_GET(self):
        self.handle_state(False)

    def do_POST(self):
        self.handle_state(True)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
