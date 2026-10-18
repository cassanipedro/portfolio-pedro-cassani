#!/usr/bin/env python3
"""
Servidor HTTP y API liviano para el Portfolio 3D Interactivo de Pedro Cassani.
- Deshabilita el caché del navegador en desarrollo (Cache-Control: no-store) para ver cambios al instante.
- Gestiona las solicitudes de reunión de la Meta (/api/appointments y /api/appointments/respond)
  para conectar con el Google Calendar de Pedro Cassani y permitirle Aceptar o Rechazar reuniones.
"""

import json
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", 8080))
HOST = os.environ.get("HOST", "0.0.0.0")
APPT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "appointments.json")


def load_appointments():
    if not os.path.exists(APPT_FILE):
        return []
    try:
        with open(APPT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def save_appointments(items):
    try:
        with open(APPT_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


class PortfolioRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/health"):
            self._send_json({"status": "ok", "service": "portfolio-pedro-cassani", "engine": "Three.js + Python"})
            return
        if self.path.startswith("/api/profile"):
            self._send_json({
                "name": "Pedro Cassani",
                "role": "Desarrollador de Sistemas Ágil",
                "email": "cassanipedro01@gmail.com",
                "specialties": [
                    "Modernización de Sistemas Legacy",
                    "Gestión Documental (Goldenbelt / SharePoint)",
                    "WMS Infor & Logística",
                    "Administración Oracle SQL & Datos Maestros",
                    "Integraciones Oil & Gas (SLB APIs)",
                    "Implementación Express Jira"
                ]
            })
            return
        if self.path.startswith("/api/appointments"):
            self._send_json({"appointments": load_appointments()})
            return
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            body = json.loads(raw)
        except Exception:
            body = {}

        if self.path.startswith("/api/appointments/respond"):
            appt_id = body.get("id")
            decision = body.get("decision")
            items = load_appointments()
            updated = None
            for it in items:
                if str(it.get("id")) == str(appt_id):
                    it["status"] = "accepted" if decision == "accepted" else "rejected"
                    it["respondedAt"] = int(time.time())
                    updated = it
                    break
            save_appointments(items)
            self._send_json({"ok": True, "appointment": updated, "appointments": items})
            return

        if self.path.startswith("/api/appointments"):
            items = load_appointments()
            new_item = {
                "id": int(time.time() * 1000),
                "name": str(body.get("name", "")).strip() or "Visitante del Portfolio",
                "email": str(body.get("email", "")).strip(),
                "date": str(body.get("date", "")).strip(),
                "time": str(body.get("time", "")).strip(),
                "duration": int(body.get("duration", 30)),
                "reason": str(body.get("reason", "")).strip(),
                "gcalUrl": str(body.get("gcalUrl", "")).strip(),
                "status": "pending",
                "createdAt": int(time.time())
            }
            items.insert(0, new_item)
            save_appointments(items[:50])
            self._send_json({"ok": True, "appointment": new_item})
            return

        self._send_json({"error": "Not found"}, status=404)

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    server = ThreadingHTTPServer((HOST, PORT), PortfolioRequestHandler)
    print(f"Servidor Portfolio Pedro Cassani corriendo en http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrando servidor...")
        server.server_close()
        sys.exit(0)


if __name__ == "__main__":
    main()
