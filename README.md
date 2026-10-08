# SkinMap Vitrine

Zwei iPads an der Wand, ein Takt. Das eine zeigt ein Bild aus dem SkinMap-Atlas
(die **Tafel**), das andere die Beschriftung dazu (die **Karte**). Jede volle
Minute rücken beide gleichzeitig zum nächsten Eintrag, ohne dass sie voneinander
wissen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die ganze Anwendung. Erkennt am Hostnamen, ob sie Tafel oder Karte ist. |
| `vitrine.json` | Die Liste der Einträge. Liegt neben `index.html` auf demselben Host. |
| `README.md` | Diese Anleitung. |

## Ausrollen

Dieselben zwei Dateien auf beide Hosts:

```
https://sm1.navarini.com/   index.html   vitrine.json     -> Tafel (nur Bild)
https://sm2.navarini.com/   index.html   vitrine.json     -> Karte (Metadaten)
```

Zwei Bedingungen:

- **Beide Hosts über HTTPS.** Ohne HTTPS verweigert Safari die Bildschirmsperre
  (Wake Lock), und das iPad schläft ein.
- **`vitrine.json` neben der `index.html`** auf demselben Host. Von einem fremden
  Host braucht die Liste einen `Access-Control-Allow-Origin`-Header, die Bilder
  selbst brauchen das nicht.

Die Liste wird alle 10 Minuten neu geholt. Datei austauschen genügt, die iPads
bleiben unberührt. Beide Hosts müssen dieselbe `vitrine.json` tragen, sonst
stimmt die Reihenfolge nicht überein.

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
  Das ist der eine Eintrag, der heute noch fehlt: der Bilder-Link.
- **`beispiel: true`** hält die Marke „Beispieldaten" auf beiden Schirmen
  sichtbar. Die Zeile entfernen, sobald echte Einträge drinstehen. Erfundene
  Angaben dürfen nicht wie Atlas-Inhalte aussehen.
- **Englische Feldnamen** werden ebenso gelesen: `condition`, `fitzpatrick`,
  `body_region`, `age`, `dataset`, `source`, `license`, `url`. Ein CSV-Export
  lässt sich damit fast unverändert wandeln.
- **`sex`**: `m` oder `w` (auch `f`, `male`, `female`). Alles andere zeigt „—".
- **`id`** bestimmt das Höhenlinien-Muster des Platzhalters, falls ein Bild fehlt
  oder nicht lädt. Fehlt `id`, wird die Position in der Liste genommen.
- Statt des Objekts darf die Datei auch eine blanke Liste `[ {...}, {...} ]`
  sein; dann gibt es kein `basis` und keine Marke.

Ohne erreichbare Liste laufen sechs eingebaute Beispieleinträge mit
Höhenlinien-Tafeln, als Beispieldaten gekennzeichnet. Auf der Karte steht dann
unten der Grund in Rot. Ist die Liste einmal geladen und fällt später das Netz
aus, bleibt sie stehen; ein Aussetzer schaltet die Wand nicht um.

## iPad einrichten

1. Adresse in Safari öffnen, dann **Teilen → Zum Home-Bildschirm**. Von dort
   gestartet läuft die Seite ohne Safari-Leisten.
2. **Einstellungen → Anzeige & Helligkeit → Automatische Sperre → Nie**.
3. **Einstellungen → Bedienungshilfen → Geführter Zugriff** einschalten, dann in
   der App dreimal die Seitentaste (bzw. Home-Taste) drücken und sperren.
4. **Einstellungen → Allgemein → Datum & Uhrzeit → Automatisch einstellen**.
   Der Gleichlauf hängt an der Uhr.

## Vorschau und Test

Unter einem anderen Hostnamen (lokal, Vorschau) zeigt die Seite eine
Einrichtungsseite mit zwei Knöpfen. `#bild` erzwingt die Tafel, `#meta` die
Karte, unabhängig vom Hostnamen:

```
python3 -m http.server 8000
# dann  http://localhost:8000/        Einrichtungsseite
#       http://localhost:8000/#bild   Tafel
#       http://localhost:8000/#meta   Karte
```

## Wie der Gleichlauf funktioniert

Beide Schirme rechnen `Minute seit Epoche mod Anzahl` über dieselbe fest
geseedete Mischung der Liste (`MISCHUNG_SAAT` in `index.html`). Es gibt keinen
Server und keine Verbindung zwischen den Geräten. Nach Neustart oder Funkloch
ist jedes Gerät sofort wieder im Takt, solange seine Uhr stimmt. Geprüft bis
800 ms Uhrabweichung; die Wechsel fallen dann sichtbar in dieselbe Sekunde.

Wer die Reihenfolge ändern will, ändert die Saat auf **beiden** Hosts
gleichzeitig, am einfachsten durch Hochladen derselben `index.html`.

## Regeln

- **Nur Bilder aus öffentlichen Datensätzen**, deren Lizenz die Anzeige erlaubt.
  Die Karte zeigt Quelle und Lizenz je Eintrag. Leere Felder sind keine Lösung.
- **Keine Patientenbilder.** Die Vitrine hängt öffentlich. Die Lehrsammlung des
  Dermassistenten bleibt getrennt und kommt hier nicht hin.
- **SkinMap ist kein Medizinprodukt.** Die Vitrine zeigt Atlas-Inhalte zum
  Anschauen, nicht zur Entscheidungsfindung. Die Modellgewichte stehen unter
  CC BY-NC (Forschung); für die gezeigten Bilder zählt die Lizenz des
  jeweiligen Datensatzes.
