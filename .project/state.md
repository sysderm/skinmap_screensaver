# Public DNS cutover — 2026-10-14

- Cloudflare root CNAME to the unavailable tunnel replaced with proxied A
  187.124.4.207; missing www added as proxied A to the same server. Mail and
  TXT records retained.
- Anonymous public HTTPS browser test passes for root and www: live dermoscopy
  image, hidden diagnosis initially, reveal after 15 seconds, three metadata
  fields and correct lab link. Public API returns 404; private sm1 returns 302.
- Origin certificate initially unavailable because ACME attempted validation
  before the DNS cutover. Renamed only the public Traefik router to retry issuance;
  verified origin TLS now returns 200 without certificate overrides.

# Combined public display — 2026-10-14

- User requested public dermatoskopie.ch: combined landscape image + diagnosis,
  skin type, age and localization, SkinMap logo and navarinilab.com link.
- Combined mode uses a local 15-second timer starting at image onload; no
  dependency on the private iPads or readiness API. Dermoscopy filter retained.
- Separate public build and nginx service deployed in the existing app directory;
  no auth middleware on the public service, no public readiness API. Existing
  sm1/sm2 service and deployed HTML unchanged.
- Verified synthetic browser timing at 14.999/15 seconds, next-image reset,
  3 clinical metadata fields, no readiness calls, landscape fit at 3 sizes.
  Existing two-screen training and auth regression checks pass.
- Live deployed-origin browser check confirms a decoded dermoscopy image,
  diagnosis reveal and exactly three metadata fields; no clinical contents saved.
- Public origin returns 200 and exact build hash. Domain currently returns
  Cloudflare 530 / 1033 (unavailable old tunnel); DNS/Cloudflare routing must point
  dermatoskopie.ch to Hostinger 187.124.4.207. Public domain release not complete.
- User confirmed both iPads now show metadata 15 seconds after images following
  login/reload. The earlier blank display was caused by missing sm1 cookie.

# Projektstand

## Korrektur der Trainingsanmeldung — 2026-10-14

- Ursache leerer Metadaten auf sm2: Beide Clients erhielten vom Auth-Gate
  HTTP 302 auf Bereitschaftsabrufe. Automatisches Fetch-Follow führte zu einem
  verschluckten Hintergrundfehler; keine Bildmeldung, keine Diagnosefreigabe.
- Fetch verwendet nun manuelle Umleitungsbehandlung. Opaque Redirect sowie
  HTTP 401/403 führen zur bestehenden Anmeldung; der Schutz bleibt aktiv.
- Regression: tatsächliche 302-Antwort im Browser führt zur sichtbaren
  Anmeldung; 15-Sekunden-Grenze und Wechsel zur nächsten Aufnahme bestehen.
  Zusätzliche Auth-Prüfung für Redirect/401/403 besteht. Datei ausgerollt und
  anhand SHA-256 mit lokalem Stand abgeglichen. Bestehende Tabs brauchen Reload.

## Ausgerollt — 2026-10-14

- Visuelle Vorschau vom Nutzer freigegeben. Dermatoskopie ist auf ausdrücklichen
  Wunsch das Freigabekriterium; manuelle Bildfreigabe deaktiviert.
- sm1/sm2 mit großer Cockpit-Typografie, SkinMap-Logo, Atlas-Stichprobe und
  Nachbarschaftsroute veröffentlicht. Identische Dateien überprüft.
- Beide Domains inklusive API und statischer Ressourcen erfordern navauth;
  nur bestehender Vollzugang zulässig. Anonyme Abrufe leiten zur Anmeldung um.
- Bildschirm 1 meldet das tatsächlich geladene Bild. Gemeinsamer temporärer
  Bereitschaftsdienst löst Diagnose/Unterzeile/Metadaten frühestens 15s später
  aus. Ohne Bildmeldung bleibt die Diagnose verborgen; Neuladen derselben
  Aufnahme setzt den Timer nicht zurück. Keine Inhalte im Bereitschaftsdienst.
- Tests bestanden: 103 Atlas-, 55 Listenprüfungen, Modalitätsprüfung,
  Trainings-Browserprüfung und vier Bereitschafts-Servertests. Origin-Liveprüfung
  per lokalem SSH-Tunnel bestätigt echtes dermatoskopisches Bild, gleiche Zeile
  und Diagnosefreigabe. Externer Auth-Schutz unabhängig geprüft; eine echte
  persönliche Anmeldung und die tatsächlichen iPads wurden nicht getestet.
- Rückfall ohne dermatoskopische Einträge zeigt SkinMap plus Logo.
- Historische Freigabe-/Deployment-Blocker unten sind durch diesen Stand ersetzt.
- Parallel auf m5 entstandene Commits sind zusammengeführt. Zusätzlicher
  früherer Alters-/Regionenfilter als optionale, deaktivierte Funktion erhalten;
  seine 13 Prüfungen bestehen ebenfalls. Hautbilddaten wurden nicht gespeichert.

## Modalitätsfilter — 2026-10-14

- Ausschließlich erhobene modality=dermoscopy zugelassen, normalisiert auf
  Kleinbuchstaben. Clinical, TBP, fehlende Modalität und reine Modellschätzungen
  ausgeschlossen; SQL, Ersatzliste und finale Darstellung geprüft.
- Atlas meldet 107135 dermatoskopische Einträge. Die zusätzliche visuelle
  Freigabeliste bleibt aktiv und ist weiterhin leer.
- Änderung lokal; noch nicht veröffentlicht, gemeinsam mit offenem Entwurf.

## Laufende Änderung — 2026-10-10

- Lokaler Entwurf: große Cockpit-Typografie, Atlas-Position und vorwärts
  gerichtete Nachbarschaftsroute mit Rückweg; proportionale Bildvergrößerung.
- Sichtbare Warteseite auf Nutzerwunsch auf SkinMap plus das vom Atlas
  verwendete Logo reduziert. Sicherheitsfilter unverändert; keine sichtbaren
  Hinweise auf Büromodus oder Genitalien. Logo lokal gebündelt.
- Auf Wunsch nochmals deutlich vergrößert: klinischer Text skaliert anhand
  des tatsächlichen Inhalts bis an die Bildschirmgrenze. Kleine Ränder,
  kompakte Karte; Overflow-Prüfungen bei 1024x768, 1366x1024, 1920x1080 und
  768x1024 sowie langer Diagnose bestanden.
- Keine generative Bildverbesserung: Browser-Interpolation bewahrt die
  Originaldaten, fügt aber keine neue Auflösung hinzu.
- Bürosicherheit: leere explizite Freigabeliste; ungeprüfte Atlasbilder und
  alle Ersatzbilder werden im strikten Modus durch eine Wartetafel ersetzt.
- Synthetic smoke checks: keine Atlas-Bildabrufe bei leerer Liste, keine
  ungeprüfte Darstellung, deterministische Hin/Rückroute, Textnormalisierung,
  kein Cockpit-Overflow bei 1366x1024.
- Noch nicht ausgerollt. Nutzerantwort zur Sicherheitsstrategie und visuelle
  Freigabe zweier Vorschauen ausstehend (AGENTS.md-Gate).
- Nächste Schritte: Bildfreigaben an unveränderlichen Bildinhalt binden,
  Modus-Synchronisation verbessern, mobile/Long-Text-Prüfungen, vollständige
  Regressionstests nach aktualisierten Großschreibungs-Erwartungen und Deploy.

Stand: 2026-10-09

- Ausgangspunkt: dd1d206 auf claude/intelligent-bardeen-9myr7c.
- Echte Atlas-Bilder verwenden Asset-Token. Die Vitrine löst sie nun anhand
  von props.assets.images aus data/metadata.json auf.
- Verifikation: 103 Atlas-Prüfungen inklusive Token-Bildern und Ausfall/Rückkehr;
  55 Listen-Prüfungen. Liveprüfung in Chromium bestätigt Bilddekodierung,
  vorhandene Beschriftung und dieselbe Zeile auf beiden Schirmen.
- Tests erlauben eine explizite Chromium-Datei über eine Umgebungsvariable.
- Deployment abgeschlossen: Beide Anzeigehosts liefern identische Dateien über
  gültiges HTTPS. Gemeinsamer statischer Dienst, bestehendes Proxy-Netzwerk.
  Browser-Liveprüfung über beide Domains bestanden (Bild, Beschriftung, Gleichlauf).
- Noch offen: Safari/iPad-Prüfung, Lizenzzuordnung pro Datensatz und Absicherung
  des SQL-Endpunkts.
- Liveprüfung speichert keine Bilder und protokolliert keine Zeileninhalte.


## VLM-Beschreibungsprompt — 2026-10-14

- Ziel präzisiert: literaturgestützter Prompt für VLM-Bildbeschreibungen, kein diagnostisches Nachschlagewerk.
- Eigenständiges Promptpaket erstellt: kontrollierter Wortschatz mit 82 Einträgen und Quellenlinks, acht Strukturgruppen, Qualitäts- und Nichtbeurteilbarkeitsregeln, Sondermodule und JSON-Schema.
- Quellen: Dermoscopedia/Academy, IDS-Konsensusarbeiten und zusätzliche Publikationen bis 2026; Quellenumfang und Zugriffstiefe explizit dokumentiert. Keine Vollständigkeit der gesamten Literatur behauptet.
- Schema, zwei synthetische Beispiele und fünf absichtliche Fehlvarianten geprüft; kein Modelltest auf klinischen Bildern durchgeführt. Keine Hautbilddaten übernommen.
- Promptpaket separat geliefert; Webseiten und Produktionsdienste unverändert. Vor Massenannotation fachliche VLM-Validierung erforderlich.
