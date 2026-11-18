#!/usr/bin/env python3
"""本地预览服务器：挑一个空闲端口起静态服务，并打开默认浏览器。

用法：
    python serve.py             # 起服务并打开浏览器
    python serve.py --no-browser
"""

from __future__ import annotations

import http.server
import socket
import socketserver
import sys
import threading
import webbrowser
from functools import partial
from pathlib import Path

HOST = "127.0.0.1"
ROOT = Path(__file__).resolve().parent
PORT_FIRST = 8000
PORT_LAST = 8050


def pick_port() -> int:
    """在 8000-8050 里找一个没被占的端口；全占满就交给系统分配。"""
    for port in range(PORT_FIRST, PORT_LAST + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((HOST, port))
            except OSError:
                continue
            return port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind((HOST, 0))
        return int(probe.getsockname()[1])


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """只把 4xx/5xx 打到控制台，正常请求不刷屏。"""

    def log_message(self, fmt: str, *args) -> None:  # noqa: D401
        code = args[1] if len(args) > 1 else ""
        if str(code).startswith(("4", "5")):
            super().log_message(fmt, *args)


def main() -> int:
    port = pick_port()
    url = f"http://{HOST}:{port}/"
    open_browser = "--no-browser" not in sys.argv

    handler = partial(QuietHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True

    print()
    print("  艾布拉姆斯型号演进 · 本地预览")
    print("  " + "-" * 44)
    print(f"  目录: {ROOT}")
    print(f"  地址: {url}")
    print("  按 Ctrl+C 停止服务")
    print(flush=True)

    try:
        with socketserver.TCPServer((HOST, port), handler) as httpd:
            if open_browser:
                threading.Timer(0.8, lambda: webbrowser.open(url)).start()
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  服务已停止。")
    except OSError as exc:
        print(f"\n  [x] 起服务失败: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
