# Projektstand

Stand: 2026-10-09

- Ausgangspunkt: dd1d206 auf claude/intelligent-bardeen-9myr7c.
- Echte Atlas-Bilder verwenden Asset-Token. Die Vitrine löst sie nun anhand
  von props.assets.images aus data/metadata.json auf.
- Verifikation: 103 Atlas-Prüfungen inklusive Token-Bildern und Ausfall/Rückkehr;
  55 Listen-Prüfungen. Liveprüfung in Chromium bestätigt Bilddekodierung,
  vorhandene Beschriftung und dieselbe Zeile auf beiden Schirmen.
- Tests erlauben eine explizite Chromium-Datei über eine Umgebungsvariable.
- Noch offen: Deployment und Safari/iPad-Prüfung, TLS-Kette der Anzeigehosts,
  Lizenzzuordnung pro Datensatz und Absicherung des SQL-Endpunkts.
- Liveprüfung speichert keine Bilder und protokolliert keine Zeileninhalte.
