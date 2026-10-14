"""Nachbau des Embedding-Atlas-Abfrageendpunkts (embedding_atlas 0.10.0, server.py):
GET /data/query?query={"type":"json","sql":...} -> cursor.execute(sql).df().to_json(orient="records"),
Fehler -> 500 {"error": ...}, CORS Access-Control-Allow-Origin: *, Tabelle "dataset".
Aufruf: python atlas_nachbau.py <variante> <port>   variante: struct | blob | b64 | url | token | schutz"""
import base64, io, json, sys, threading, zlib, struct as st
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import duckdb, pandas as pd

variante, port = sys.argv[1], int(sys.argv[2])
N = 500

def png(i):
    w, h = 8, 6
    farbe = bytes(((i * 37) % 256, (i * 91) % 256, (i * 53) % 256))
    roh = b"".join(b"\x00" + farbe * w for _ in range(h))
    def chunk(t, d): return st.pack(">I", len(d)) + t + d + st.pack(">I", zlib.crc32(t + d))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", st.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + \
           chunk(b"IDAT", zlib.compress(roh)) + chunk(b"IEND", b"")

zeilen = []
for i in range(N):
    roh = png(i)
    if i % 7 == 3: bild = None
    elif variante == "struct": bild = {"bytes": roh, "path": f"img_{i}.png"}
    elif variante == "blob": bild = roh
    elif variante == "b64": bild = base64.b64encode(roh).decode()
    elif variante == "token": bild = f"ea://image/image/{i}.png"
    else: bild = f"http://127.0.0.1:{port}/bild/{i}.png"
    zeilen.append({
        "image": bild, "img_path": f"img_{i}.png",
        "dataset": ["isic2020", "fitzpatrick17k", "scin", "passion"][i % 4],
        "condition": None if i % 11 == 5 else f"Befund {i}",
        "icd_description": f"ICD-Text {i}",
        "fitzpatrick": "III" if i % 2 == 0 else None, "fitzpatrick_pred": "V",
        "body_region": None, "body_region_pred": "Rumpf",
        "age": float(30 + i % 50) if i % 3 == 0 else None, "age_pred": 41.6,
        "gender": "female" if i % 2 == 0 else None, "gender_pred": "male",
        "origin": "public", "modality": "dermoscopy",
        "x": float(i % 20), "y": float(i // 20),
    })
if variante == "schutz":
    # Nur i % 5 == 4 (ausser i % 25 == 24) ist unbedenklich; alles andere muss
    # der Schutzfilter aussortieren: Kinder, Genitalregion, Genitaldiagnose,
    # unbekanntes Alter.
    for i, z in enumerate(zeilen):
        z["image"] = {"bytes": png(i), "path": f"img_{i}.png"}
        z.update({"condition": f"Befund {i}", "body_region": None, "body_region_pred": "back",
                  "age": 45.0, "age_pred": 44.0})
        art = i % 5
        if art == 0: z["age"] = 8.0
        elif art == 1: z.update({"age": None, "age_pred": 12.0})
        elif art == 2: z["body_region_pred"] = "genital area"
        elif art == 3: z["condition"] = "Condyloma acuminatum"
        elif i % 25 == 24: z.update({"age": None, "age_pred": None})
df = pd.DataFrame(zeilen)
df["_row_index"] = range(N)
con = duckdb.connect(":memory:")
con.sql("CREATE TABLE dataset AS (SELECT * FROM df)")
sperre = threading.Lock()
abfragen = []

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def antwort(self, code, body, typ):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/data/metadata.json":
            return self.antwort(200, json.dumps({"props": {"assets": {"images": {
                "tokenPrefix": "ea://image/", "relativePath": "images"
            }}}}).encode(), "application/json")
        if u.path.startswith("/data/images/image/"):
            return self.antwort(200, png(int(u.path.rsplit("/", 1)[1].split(".")[0])), "image/png")
        if u.path.startswith("/bild/"):
            return self.antwort(200, png(int(u.path[6:].split(".")[0])), "image/png")
        if u.path == "/_abfragen":
            return self.antwort(200, json.dumps(abfragen).encode(), "application/json")
        if u.path != "/data/query":
            return self.antwort(404, b"{}", "application/json")
        q = json.loads(parse_qs(u.query)["query"][0])
        abfragen.append(q["sql"])
        with sperre:
            try:
                data = con.cursor().execute(q["sql"]).df().to_json(orient="records")
                self.antwort(200, data.encode(), "application/json")
            except Exception as e:
                self.antwort(500, json.dumps({"error": str(e)}).encode(), "application/json")

ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
