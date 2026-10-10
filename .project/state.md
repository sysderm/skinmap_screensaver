# Projektstand

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
