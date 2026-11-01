# serves the game the way the artifact host does: index.html wrapped in a page skeleton with [hidden] honoured
# usage: python3 serve.py            (from this folder; the game is two levels up)  → http://localhost:8765/
import http.server, os, sys
GAME = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..'))
HEAD = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>[hidden]{display:none!important}body{margin:0}</style></head><body>')
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8'}
    def __init__(self, *a, **k): super().__init__(*a, directory=GAME, **k)
    def do_GET(self):
        if self.path.split('?')[0].split('#')[0] in ('/', '/index.html'):
            body = (HEAD + open(os.path.join(GAME, 'index.html'), encoding='utf-8').read() + '</body></html>').encode()
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body); return
        super().do_GET()
    def log_message(self, *a): pass
print('game at http://localhost:8765/  (add #test for the test hooks)')
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()
