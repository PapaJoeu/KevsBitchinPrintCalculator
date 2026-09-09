#!/usr/bin/env python3
"""Screenshot / inspect the app at a REAL viewport, via the Chrome DevTools protocol.

Why this exists: `chrome --headless --window-size=390,844 --screenshot` does NOT
give a 390px mobile viewport. Chrome lays the page out at ~500px and then crops
the image to 390, so narrow-viewport bugs are invented and real ones are hidden.
Only Emulation.setDeviceMetricsOverride sets a true viewport.

Dependency-free on purpose (matches this project): raw sockets, no pip installs.

Usage:
  python shoot.py <url> <width> <height> <out.png> [--clip SELECTOR] [--eval JS]...
  python shoot.py http://localhost:8080/ 390 844 shot.png
  python shoot.py http://localhost:8080/ 390 844 seq.png --clip "#sequence"
  python shoot.py http://localhost:8080/ 390 844 out.png \
      --eval "document.querySelector('#foldControls button[data-style=\\"bifold\\"]').click()" \
      --print "document.querySelectorAll('li.step').length"

--eval runs JS before the shot (repeatable, in order). --print evaluates and
prints the result (repeatable) — use it to read live state instead of guessing
from pixels. --full captures the whole scrollable page.
"""
import base64, json, os, shutil, socket, subprocess, sys, tempfile, time
from urllib.request import urlopen

DEBUG_PORT = int(os.environ.get("CDP_PORT", "9432"))


def find_chrome():
    env = os.environ.get("CHROME")
    if env and os.path.exists(env):
        return env
    for name in ("google-chrome", "chromium", "chromium-browser", "chrome", "msedge"):
        p = shutil.which(name)
        if p:
            return p
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    sys.exit("Chrome not found. Set the CHROME env var to its full path.")


class CDP:
    """Minimal WebSocket client speaking just enough of RFC 6455 for CDP."""

    def __init__(self, ws_url):
        _, rest = ws_url.split("://", 1)
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(
            f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\nOrigin: http://{hostport}\r\n\r\n".encode()
        )
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        if b"101" not in buf.split(b"\r\n")[0]:
            raise RuntimeError(f"WebSocket handshake failed: {buf.split(chr(13).encode())[0]}")
        self.buf = buf.split(b"\r\n\r\n", 1)[1]
        self.n = 0

    def _send(self, payload):
        data = payload.encode()
        header = bytearray([0x81])
        mask = os.urandom(4)
        length = len(data)
        if length < 126:
            header.append(0x80 | length)
        elif length < 1 << 16:
            header.append(0x80 | 126)
            header += length.to_bytes(2, "big")
        else:
            header.append(0x80 | 127)
            header += length.to_bytes(8, "big")
        header += mask
        self.sock.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError("socket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def _recv(self):
        while True:
            b0, b1 = self._read(2)
            length = b1 & 0x7F
            if length == 126:
                length = int.from_bytes(self._read(2), "big")
            elif length == 127:
                length = int.from_bytes(self._read(8), "big")
            payload = self._read(length)
            if b0 & 0x0F == 0x01:  # text frame
                return payload.decode()

    def call(self, method, params=None):
        self.n += 1
        self._send(json.dumps({"id": self.n, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self._recv())
            if msg.get("id") == self.n:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def js(self, expression):
        r = self.call("Runtime.evaluate", {
            "expression": expression, "returnByValue": True, "awaitPromise": True,
        })
        res = r.get("result", {})
        return res.get("value", res.get("description"))


def main():
    args = sys.argv[1:]
    if len(args) < 4:
        sys.exit(__doc__)
    url, width, height, out = args[0], int(args[1]), int(args[2]), args[3]
    evals, prints, clip, full = [], [], None, False
    i = 4
    while i < len(args):
        if args[i] == "--eval":
            evals.append(args[i + 1]); i += 2
        elif args[i] == "--print":
            prints.append(args[i + 1]); i += 2
        elif args[i] == "--clip":
            clip = args[i + 1]; i += 2
        elif args[i] == "--full":
            full = True; i += 1
        else:
            sys.exit(f"unknown argument: {args[i]}")

    profile = tempfile.mkdtemp(prefix="cdp-shot-")
    chrome = subprocess.Popen(
        [find_chrome(), "--headless=new", "--disable-gpu", "--no-first-run",
         f"--remote-debugging-port={DEBUG_PORT}", "--remote-allow-origins=*",
         f"--user-data-dir={profile}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(120):
            try:
                json.load(urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json/version"))
                break
            except Exception:
                time.sleep(0.25)
        else:
            sys.exit("Chrome did not expose its debugging port.")

        tabs = json.load(urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json/list"))
        cdp = CDP(next(t for t in tabs if t["type"] == "page")["webSocketDebuggerUrl"])
        cdp.call("Page.enable")
        # The whole point: a real viewport, not a cropped 500px layout.
        cdp.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 2, "mobile": width < 900,
        })
        cdp.call("Page.navigate", {"url": url})
        time.sleep(2.5)

        for expression in evals:
            cdp.js(expression)
        if evals:
            time.sleep(0.8)
        for expression in prints:
            print(f"{expression}  ->  {cdp.js(expression)}")

        params = {"format": "png", "captureBeyondViewport": True}
        if clip:
            box = cdp.js(
                "(()=>{const n=document.querySelector(%s);if(!n)return null;"
                "const b=n.getBoundingClientRect();"
                "return JSON.stringify({x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height});})()"
                % json.dumps(clip)
            )
            if not box:
                sys.exit(f"--clip selector matched nothing: {clip}")
            b = json.loads(box)
            params["clip"] = {"x": b["x"], "y": b["y"], "width": b["w"],
                              "height": b["h"], "scale": 1}
        elif full:
            page_height = cdp.js("document.documentElement.scrollHeight")
            params["clip"] = {"x": 0, "y": 0, "width": width,
                              "height": min(int(page_height), 8000), "scale": 1}

        shot = cdp.call("Page.captureScreenshot", params)
        with open(out, "wb") as fh:
            fh.write(base64.b64decode(shot["data"]))
        print(f"wrote {out} at {width}x{height}")
    finally:
        chrome.terminate()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
