> Historischer Handoff, durch `.project/state.md` (Ausgerollt 2026-10-14) ersetzt. Die Domains sind inzwischen geschützt und ausgerollt.

# Handoff — Vitrine auf sm1/sm2 ausrollen

Stand **2026-10-12**. Für eine Claude-Sitzung **auf dem Rechner, der den VPS
erreicht**. Die Cloud-Sitzung, die das geschrieben hat, kennt weder den VPS
noch hat sie SSH-Zugang.

## Warum es eilt

Auf `sm1.navarini.com` und `sm2.navarini.com` läuft der Stand vom 9.10.
(Commit `b570ad8`). Er hat **keine Freigabeliste und keinen Schutzfilter**.
Die Wand kann also Bilder von Kindern oder Genitalien zeigen. Bis der neue
Stand läuft, sollten die iPads aus sein.

## Was ausgerollt wird

Repo `sysderm/skinmap_screensaver`, Branch `claude/intelligent-bardeen-9myr7c`,
Commit **`1019c34`** (oder neuer auf diesem Branch). Er enthält das neue
Cockpit-Interface aus `wip/m5` und den Schutzfilter.

Auf den Server gehören genau diese Dateien, sonst nichts:

```
index.html
vitrine.json
office-review.json
assets/            (enthält skinmap-logo.png)
```

`tests/`, `deploy/`, `.project/` und die Handoffs gehören **nicht** nach `public/`.

## Den Server finden

Bekannt aus dem Repo (`README.md`, `deploy/`):

- Ein VPS betreibt beide Domains über einen nginx-Container
  `skinmap-screensaver` (Image `nginx:alpine`) hinter Traefik.
- Docker-Netzwerk `traefik-proxy`, Zertifikate über Let's Encrypt.
- Im Dienstverzeichnis liegen `docker-compose.yml` und `nginx.conf` neben
  einem Ordner `public/`, der als `/usr/share/nginx/html` eingebunden ist.

Vorgehen, falls Adresse oder Pfad nicht bekannt sind:

1. IP der Domains auflösen: `nslookup sm1.navarini.com`.
2. In `~/.ssh/config` nach einem Host mit dieser IP oder einem passenden
   Namen suchen. Dort steht meist auch der Nutzer. Nicht raten, keine
   fremden Schlüssel ausprobieren. Wenn nichts passt: Alexander fragen.
3. Auf dem VPS den Ordner finden:

   ```
   docker ps --filter name=skinmap-screensaver
   docker inspect skinmap-screensaver --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
   ```

   Die Quelle zu `/usr/share/nginx/html` ist der `public/`-Ordner.

## Ausrollen

```
# lokal: Stand holen
git -C <repo> fetch origin
git -C <repo> checkout 1019c34      # oder: origin/claude/intelligent-bardeen-9myr7c

# auf den VPS kopieren (PUBLIC = Pfad aus docker inspect)
scp -r <repo>/index.html <repo>/vitrine.json <repo>/office-review.json <repo>/assets  <vps>:$PUBLIC/
```

Kein Neustart nötig. nginx liefert die Dateien direkt aus und sendet
`Cache-Control: no-store`. Nur wenn sich `nginx.conf` oder
`docker-compose.yml` geändert haben: im Dienstverzeichnis `docker compose up -d`.

## Prüfen

1. Beide Hosts liefern dieselbe, neue Datei:

   ```
   curl -s https://sm1.navarini.com/ | sha256sum
   curl -s https://sm2.navarini.com/ | sha256sum
   sha256sum <repo>/index.html
   curl -s https://sm1.navarini.com/ | grep -c SCHUTZ_MUSTER     # muss >= 1 sein
   ```

2. Liveprüfung im Browser: `node tests/pruefe_live.js https://sm1.navarini.com/ https://sm2.navarini.com/`.
   Sie speichert keine Bilder und protokolliert keine Zeileninhalte.
3. **Erwartet ist die SkinMap-Wartetafel, keine Bilder.** `office-review.json`
   enthält noch keine Freigaben. Das ist gewollt.

## iPads

Beide iPads **neu laden**. Die Seite holt alle 10 Minuten neue Daten, aber nie
eine neue `index.html`. Ohne Neuladen zeigen sie weiter das alte Interface.
Bei Geführtem Zugriff: dreimal Seitentaste, beenden, Seite neu laden, wieder
sperren.

## Wie Bilder später erscheinen

Eine Atlaszeile erscheint nur, wenn sie in `office-review.json` so steht:

```json
{
  "atlas": "https://skinmap.ngrok.io",
  "approved": [
    {"row_index": 12345, "visually_reviewed": true, "no_genitals": true, "no_children": true}
  ]
}
```

Unabhängig davon schliesst die Seite immer aus: Alter unter 18, geschätztes
Alter unter 25, unbekanntes Alter und Stichworte zu Kindern, Genital- und
Analregion, Leiste, Gesäss, Brust und genitalen Diagnosen. Freigaben setzt nur
ein Mensch, der das Bild angesehen hat.

## Nicht tun

- Keine Freigaben ohne visuelle Prüfung in `office-review.json` eintragen.
- `OFFICE_REVIEW_REQUIRED` nicht auf `false` setzen.
- Keine Bilder oder Zeileninhalte des Atlas in Logs, Commits oder Chats kopieren.
- Den ngrok-Tunnel nicht auf einem Rechner mit Patientendaten oder
  Zugangsdaten (`.env` mit HANA/Apollo) laufen lassen. Der Atlas-Endpunkt
  führt beliebiges SQL aus.
