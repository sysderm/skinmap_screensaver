# SkinMap Vitrine

## Experten-Sammlung (aktueller Inhalt)

Die Wand zeigt ausschließlich dermatoskopische Bilder mit **echten Expertenannotationen** aus der
ISIC-2018-Challenge (Task 2) unter `experten/` (`ATLAS = ""`, `DATEN = "./experten/vitrine.json"`,
`DERMOSCOPY_ONLY = true`). Es gibt keinen KI-Text: Unter dem Bild stehen die von Experten markierten Strukturen
(Pigmentnetz, Negatives Netz, Streaks, Milia-ähnliche Zysten, Globules/Dots). Zusammen mit der Diagnose (nach 15 s)
wechselt das Bild zur Version mit den farbigen Experten-Masken (`experten/overlay/`). Diagnose, Region, Alter, Geschlecht,
Lizenz und Urheber stammen aus dem ISIC-Archiv (CC-0 bzw. CC-BY-NC). Ausgenommen: Aufnahmen von unter 18-Jährigen.
Neu bauen: `node scripts/isic_meta.mjs <raw> <meta.json>`, dann `node scripts/build_experten.mjs <Ordner mit raw/ und masks/> <meta.json>`
(Quelle: ISIC 2018 Task 1-2 Input und Task 2 GroundTruth).
Reihenfolge: Jedes Bild kommt vor; alle Diagnosen außer Nävi erscheinen dreimal so oft (`ANDERE_KOPIEN` in `index.html`), jede Kopie in einem eigenen Abschnitt des Durchlaufs.
Optional (nur geschützter Host): `derm7pt/` (liegt im privaten Repo) mit den Derm7pt-Fällen und den echten 7-Punkte-Kriterien, gebaut mit `node scripts/build_derm7pt.mjs <release_v0>`. Derm7pt darf nicht weiterverteilt werden (CC BY-NC-ND, nur Forschung) und gehört nicht auf den öffentlichen Host; das Repo darf nicht öffentlich werden. Die früheren, KI-beschriebenen 5065 Bilder stehen nur noch in der Git-Historie.

## Aktueller Betrieb

- Beide Domains sind über `auth.navarini.com` geschützt. Nur der bestehende
  Vollzugang darf sie öffnen; die API ist ebenfalls geschützt.
  Läuft die Anmeldung während der Anzeige ab, führen auch Hintergrundabrufe
  zur Login-Seite. So bleibt die Diagnose nicht unbemerkt dauerhaft verborgen.
- Ausschließlich erhobene `modality = dermoscopy` wird verwendet. Fehlende
  Werte, Modellschätzungen, klinische Aufnahmen und TBP sind ausgeschlossen.
  Ersatzlisten müssen jeden Eintrag mit `modality: "dermoscopy"` kennzeichnen.
  Ohne passende Ersatzdaten erscheint ausschließlich SkinMap mit Logo.
- Auf Wunsch dient dieser Modalitätsfilter als Freigabekriterium; die optionale
  manuelle Liste ist ausgeschaltet. Das ist keine Anonymisierungsgarantie.
- sm1 bestätigt über `/api/display-ready` ein tatsächlich geladenes Bild.
  sm2 hält Diagnose, Unterzeile und Metadaten bis 15 Sekunden nach dieser
  Bestätigung verborgen. Ohne Bestätigung wird nichts verraten. Ein Neuladen
  startet den Timer derselben Aufnahme nicht erneut; ein neues Bild verbirgt
  die alte Diagnose sofort. Polling/Browserzeichnung können die Einblendung
  geringfügig verzögern, aber die Trainingszeit nicht verkürzen.
- Standardmäßig laufen beide Schirme durch eine deterministische
  Nachbarschaftsroute einer Stichprobe von bis zu 2000 dermatoskopischen
  Atlaspunkten, mit Rückweg. Die Karte zeigt diese Stichprobe und die Position.
  `?mode=random` aktiviert Zufallsauswahl; beide Hosts müssen denselben Modus
  verwenden. Die Route nutzt zweidimensionale Atlas-Nachbarschaft, keine
  medizinisch definierte Ähnlichkeit.
- Textgröße passt sich dem Bildschirm an. Bilder werden proportional
  vergrößert; es werden keine zusätzlichen Bilddetails generiert.

Training prüfen: `node tests/pruefe_training.js` und
`python3 tests/pruefe_training_server.py`. Modalitätsprüfung:
`node tests/pruefe_modalitaet.js`.

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

## Schutz: keine Kinder, keine Genitalien

Dieser zusätzliche ältere Schutzfilter ist erhalten, aber auf ausdrücklichen Nutzerwunsch deaktiviert (`ADDITIONAL_PROTECTION = false`). Der aktive Filter ist Dermatoskopie, wie oben beschrieben. Wenn zusätzlich aktiviert, greift er dreifach:

1. **Freigabeliste.** Im Büromodus erscheint eine Atlaszeile nur, wenn sie in
   `office-review.json` mit `visually_reviewed`, `no_genitals` **und**
   `no_children` auf `true` steht.
2. **SQL-Bedingung im Atlas.** Ausgeschlossen sind Zeilen unter 18 Jahren,
   geschätzt (`age_pred`) unter 25, Zeilen ohne lesbares Alter und Zeilen mit
   Stichworten zu Kindern, Genitalien, Anogenitalregion, Leiste, Gesäss oder
   Brust in Diagnose, Region, Datensatz oder Pfad (`SCHUTZ_MUSTER`).
3. **Letzte Prüfung vor dem Anzeigen**, auch für `vitrine.json` und die
   eingebauten Beispiele. Fällt ein Eintrag durch, zeigt die Wand die
   SkinMap-Wartetafel.

Im Zweifel fällt ein Bild heraus. Prüfung: `node tests/pruefe_schutz.js "$PWD"
/tmp/vw-wurzeln python3 tests/atlas_nachbau.py`.

## Combined landscape display

`#combined` previews image and clinical metadata together. The public build
always uses this view. It shows skin type, localization and age immediately and
reveals diagnosis 15 seconds after the image loads. Failed image loads do not
reveal a diagnosis. The dermoscopy filter and neighbourhood selection remain.

Build with `python3 scripts/build_public.py <output-directory>`. Deploy the
result to `public-combined/` alongside `deploy/nginx-combined.conf` and the
compose service `skinmap-combined`. This public service has no readiness API;
the existing private displays keep their own authentication and shared timer.
The domain must resolve to the hosting server before HTTPS release can finish.
