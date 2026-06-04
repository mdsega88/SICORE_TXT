# -*- coding: utf-8 -*-
"""
Servidor local para la app SICORE.

Sirve los archivos estaticos y guarda logs mensuales en la raiz del proyecto.
Ejecutar desde esta carpeta:

    python server.py
"""

import json
import re
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
LOG_DIR = ROOT_DIR / "logs"
PERIOD_PATTERN = re.compile(r"^(0[1-9]|1[0-2])/\d{4}$")


def period_log_filename(period):
    month, year = period.split("/")
    return f"SICORE-{month}-{year}.txt"


class SicoreHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def do_POST(self):
        if self.path != "/api/log":
            self.send_error(HTTPStatus.NOT_FOUND, "Endpoint inexistente")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            period = str(payload.get("period", "")).strip()
            log_line = str(payload.get("logLine", "")).strip()

            if not PERIOD_PATTERN.match(period):
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "periodo_invalido"})
                return

            if not log_line:
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "log_vacio"})
                return

            LOG_DIR.mkdir(exist_ok=True)
            log_path = LOG_DIR / period_log_filename(period)
            with log_path.open("a", encoding="utf-8", newline="\n") as file:
                file.write(log_line + "\n")

            self._send_json(HTTPStatus.OK, {"ok": True, "file": log_path.name})
        except Exception as exc:
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})

    def _send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("localhost", port), SicoreHandler)
    print(f"Servidor SICORE en http://localhost:{port}/")
    print(f"Logs mensuales en: {LOG_DIR}")
    server.serve_forever()


if __name__ == "__main__":
    main()
