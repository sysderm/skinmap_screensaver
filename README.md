# SkinMap Vitrine

Zwei iPads an der Wand, ein Takt. Das eine zeigt ein Bild aus dem SkinMap-Atlas
(die **Tafel**), das andere die Beschriftung dazu (die **Karte**). Jede volle
Minute rücken beide gleichzeitig zum nächsten Eintrag, ohne dass sie voneinander
wissen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die ganze Anwendung. Erkennt am Hostnamen, ob sie Tafel oder Karte ist. |
| `vitrine.json` | Ersatzliste, falls der Atlas nicht antwortet. Liegt neben `index.html`. |
| `tests/` | Browser-Prüfungen, siehe unten. Gehört nicht auf die Hosts. |

## Woher die Bilder kommen

1. **Der SkinMap-Atlas, live.** In `index.html` steht oben
   `const ATLAS = "https://skinmap.ngrok.io";`. Jede Minute fragt jeder Schirm
   dort eine Zeile ab, Bild und Beschriftung. `""` schaltet das ab.
2. **`vitrine.json`**, wenn der Atlas nicht antwortet.
3. **Sechs eingebaute Beispieleinträge**, wenn auch die Liste fehlt. Sie tragen
   die Marke „Beispieldaten".

Antwortet der Atlas zweimal in Folge nicht, schaltet die Wand auf die Liste und
nennt den Grund unten auf der Karte. In jeder geraden Minute versuchen beide
Schirme den Atlas erneut, damit sie gemeinsam zurückfinden.

### Wie der Atlas abgefragt wird

Der Atlas ist ein [Embedding Atlas](https://github.com/apple/embedding-atlas)
(Version 0.10.0). Sein Server beantwortet SQL auf der Tabelle `dataset` unter
`GET /data/query` und erlaubt Abrufe von jedem Host (CORS `*`).

- Beim Start liest die Seite die Spalten mit `DESCRIBE dataset` und die
  Zeilenzahl über `_row_index`.
- Aus der Minute und der festen Saat leiten beide Schirme dieselbe Zielzeile ab
  und nehmen die erste Zeile ab dort, die ein Bild und eine Diagnose hat.
- Die Tafel holt nur das Bild, die Karte nur die Metadaten. Der nächste Eintrag
  wird 25 Sekunden vor dem Wechsel geholt, damit beide pünktlich umschalten.
- Die Bildspalte (`image`) darf eine URL, eine `data:`-URL, Base64-Text, ein
  BLOB oder die Hugging-Face-Form `{bytes, path}` sein. Exportierte `ea://image/`-
  Verweise werden über `props.assets.images` aus `/data/metadata.json` aufgelöst.
- `ATLAS_FILTER` grenzt bei Bedarf ein, etwa `"modality = 'clinical'"`.

### Was die Karte zeigt

| Feld | Spalte | ersatzweise, als „Modell" markiert |
|---|---|---|
| Diagnose | `condition`, sonst `icd_description` | – |
| Unterzeile | `icd_description` | – |
| Fitzpatrick | `fitzpatrick`, `fitzpatrick_grouped` | `fitzpatrick_pred`, `fitzpatrick_grouped_pred` |
| Körperregion | `body_region`, `body_location` | `body_region_pred` |
| Alter | `age` | `age_pred` |
| Geschlecht | `gender`, `sex` | `gender_pred` |
| Datensatz | `dataset` | – |
| Lizenz | `license`, `lizenz` | – |

Gemessenes geht vor. Fehlt es, steht der Modellwert da, mit dem Kästchen
„Modell" daneben. Der Atlas trägt heute keine Lizenzspalte, deshalb zeigt die
Karte „Lizenz: —".

## Ausrollen

Dieselben zwei Dateien auf beide Hosts:

```
https://sm1.navarini.com/   index.html   vitrine.json     -> Tafel (nur Bild)
https://sm2.navarini.com/   index.html   vitrine.json     -> Karte (Metadaten)
```

- **Beide Hosts über HTTPS.** Ohne HTTPS verweigert Safari die Bildschirmsperre
  (Wake Lock), und das iPad schläft ein.
- **`vitrine.json` neben der `index.html`** auf demselben Host.
- **Der Atlas muss laufen**, solange die Wand laufen soll. Schläft der Rechner
  hinter dem ngrok-Tunnel, zeigt die Wand die Liste.

Die Liste wird alle 10 Minuten neu geholt, die Zeilenzahl des Atlas ebenso.
Beide Hosts müssen dieselbe `index.html` und `vitrine.json` tragen, sonst
stimmt die Reihenfolge nicht überein.

Der VPS betreibt beide Domains über einen gemeinsamen nginx-Dienst. Die
Konfiguration liegt in `deploy/`; im Dienstverzeichnis liegen diese beiden
Konfigurationsdateien neben `public/index.html` und `public/vitrine.json`.
`docker compose up -d` startet den Dienst im bestehenden Netzwerk
`traefik-proxy`. Traefik stellt die HTTPS-Zertifikate aus. nginx verhindert
veraltete Browser-Caches mit `Cache-Control: no-store`.

## vitrine.json

```json
{
  "beispiel": true,
  "basis": "https://bilder.example.org/skinmap/",
  "bilder": [
    {
      "id": "isic-0015719",
      "bild": "ISIC_0015719.jpg",
      "diagnose": "Melanoma",
      "art": "malignes Melanom",
      "fitz": "II",
      "region": "Rücken",
      "alter": 64,
      "sex": "m",
      "datensatz": "ISIC 2020",
      "quelle": "ISIC Archive",
      "lizenz": "CC-0"
    }
  ]
}
```

- **`basis`** kommt einmal und wird vor jeden Dateinamen in `bild` gesetzt. Ein
  `bild`, das selbst mit `http://` oder `https://` beginnt, bleibt unverändert.
- **`beispiel: true`** hält die Marke „Beispieldaten" sichtbar. Die Zeile
  entfernen, sobald echte Einträge drinstehen.
- **Englische Feldnamen** werden ebenso gelesen: `condition`, `fitzpatrick`,
  `body_region`, `age`, `dataset`, `source`, `license`, `url`.
- **`sex`**: `m` oder `w` (auch `f`, `male`, `female`). Alles andere zeigt „—".
- Statt des Objekts darf die Datei auch eine blanke Liste `[ {...}, {...} ]`
  sein; dann gibt es kein `basis` und keine Marke.

## iPad einrichten

1. Adresse in Safari öffnen, dann **Teilen → Zum Home-Bildschirm**.
2. **Einstellungen → Anzeige & Helligkeit → Automatische Sperre → Nie**.
3. **Einstellungen → Bedienungshilfen → Geführter Zugriff** einschalten, dann in
   der App dreimal die Seitentaste drücken und sperren.
4. **Einstellungen → Allgemein → Datum & Uhrzeit → Automatisch einstellen**.
   Der Gleichlauf hängt an der Uhr.

## Vorschau

Unter einem anderen Hostnamen zeigt die Seite eine Einrichtungsseite mit dem
Zustand von Atlas und Liste. `#bild` erzwingt die Tafel, `#meta` die Karte:

```
python3 -m http.server 8000
# http://localhost:8000/        Einrichtungsseite
# http://localhost:8000/#bild   Tafel
# http://localhost:8000/#meta   Karte
```

## Tests

Die Prüfungen laufen in Chromium über Playwright und brauchen kein Netz.
Benötigt werden das Node-Paket `playwright` mit installiertem Chromium sowie
für den Nachbau die Python-Pakete `duckdb` und `pandas`. Ein bereits installierter
Chromium kann über `PLAYWRIGHT_CHROMIUM_EXECUTABLE` gewählt werden.

```
# Listenbetrieb, Atlas abgeschaltet
node tests/pruefe_liste.js  "$PWD" /tmp/vw-wurzeln /tmp/vw-bilder

# Atlasbetrieb gegen einen Nachbau des Atlas-Endpunkts (Python mit duckdb und pandas)
node tests/pruefe_atlas.js  "$PWD" /tmp/vw-wurzeln /tmp/vw-bilder  python3  tests/atlas_nachbau.py
```

`tests/atlas_nachbau.py` baut den Abfrageendpunkt des Embedding-Atlas-Servers
nach, mit 500 synthetischen Zeilen. Die Bildspalte gibt es in fünf Formen
(`struct`, `blob`, `b64`, `url`, `token`), alle werden geprüft.

Zusätzlich prüft `node tests/pruefe_live.js` die konfigurierte echte Atlas-Adresse
im Browser: Verbindung, Bilddekodierung, Beschriftung und Gleichlauf beider
Schirme. Dieser optionale Test braucht Netz und speichert weder Bilder noch
Zeileninhalte. Er ersetzt keine Prüfung auf den tatsächlichen iPads.
Für die veröffentlichten Hosts: `node tests/pruefe_live.js https://sm1.navarini.com/ https://sm2.navarini.com/`.

## Regeln

- **Nur Bilder aus öffentlichen Datensätzen**, deren Lizenz die Anzeige erlaubt.
- **Keine Patientenbilder.** Die Vitrine hängt öffentlich. Die Lehrsammlung des
  Dermassistenten bleibt getrennt und kommt hier nicht hin.
- **SkinMap ist kein Medizinprodukt.** Die Vitrine zeigt Atlas-Inhalte zum
  Anschauen, nicht zur Entscheidungsfindung. Modellwerte sind als solche
  markiert.
- **Der Atlas-Endpunkt führt beliebiges SQL aus.** Wer die Adresse kennt, kann
  über DuckDB auch Dateien auf dem Rechner hinter dem Tunnel lesen. Der Tunnel
  sollte deshalb nur so lange offen sein, wie die Wand ihn braucht, und nicht
  auf einem Rechner mit Patientendaten oder Zugangsdaten laufen.
