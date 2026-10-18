#!/usr/bin/env python3
"""
Servidor HTTP y API liviano para el Portfolio 3D Interactivo de Pedro Cassani.
- Deshabilita el caché del navegador en desarrollo (Cache-Control: no-store) para ver cambios al instante.
- Expone endpoints JSON (/api/health, /api/profile) manteniendo compatibilidad total con GitHub Pages.
"""

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", 8080))
HOST = os.environ.get("HOST", "0.0.0.0")


class PortfolioRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Evita cualquier caché antiguo al editar el proyecto localmente
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

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
        super().do_GET()

    def _send_json(self, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
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
