# Projektstand

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
