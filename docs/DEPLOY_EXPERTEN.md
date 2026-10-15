# Ausrollen – Experten-Sammlung (Stand: Commit auf Branch lehrbuch-sammlung)

Zwei fertige Pakete (nichts davon ist bisher auf einem Server):

| Ordner | Für | Inhalt |
|---|---|---|
| `public-combined/` | dermatoskopie.ch (öffentlich, ohne Login) | index.html (immer kombinierte Ansicht), vitrine.json, assets/, experten/ – **kein Derm7pt** |
| `public/` | sm1/sm2.navarini.com (mit Login) | index.html, vitrine.json, office-review.json, assets/, experten/, **derm7pt/** |

Derm7pt darf nicht weiterverteilt werden (CC BY-NC-ND, nur Forschung): `derm7pt/` gehört nur auf den geschützten Host,
nie auf den öffentlichen, nie ins Git.

## Auf dem VPS (Pfade aus `docker inspect skinmap-screensaver` bzw. der Combined-Dienst)

```
docker ps --filter name=skinmap
docker inspect <container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
```

Die Quelle zu `/usr/share/nginx/html` ist der jeweilige `public/`-Ordner (sm1/sm2: `public/`, dermatoskopie.ch: `public-combined/`).

## Kopieren (Beispiel, Host/Nutzer/Pfad einsetzen)

```
# öffentlich
scp -r public-combined/* <nutzer>@<vps>:<PFAD>/public-combined/
# geschützt
scp -r public/*          <nutzer>@<vps>:<PFAD>/public/
```

Kein Neustart nötig (nginx sendet `Cache-Control: no-store`). Alte Dateien der früheren Sammlung (z. B. `lehrbuch/`) dürfen bleiben oder gelöscht werden.

## Prüfen

```
curl -s https://dermatoskopie.ch/ | sha256sum        # = public-combined/index.html
curl -s https://sm1.navarini.com/  | sha256sum       # = public/index.html (mit Login)
curl -sI https://dermatoskopie.ch/derm7pt/vitrine.json   # muss 404 sein
```

SHA-256 der Pakete:

- public-combined/index.html: 7d13f36e3570d00c2556ee10fed4e581671f38563d205e0f72231030280388d3
- public/index.html: e4f3cbd0c61d47010dec637d569de1f98ad732a76e6bb0c21b88f8a1058aeee6

iPads danach **neu laden** (die Seite holt nie selbst eine neue index.html).
