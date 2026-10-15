# Dokumentation Experten-Sammlung

- `DEPLOY_EXPERTEN.md` – Ausrollen (öffentlicher und geschützter Host), Prüfschritte
- `ISIC_Vergleich.md`, `ISIC_Vergleich_ohne_Dots.md` – Test, wie gut ein Sprachmodell (Apollo, Prompt v1.1) dermatoskopische
  Strukturen gegenüber den ISIC-2018-Experten-Masken erkennt (300 Bilder). Ergebnis: nur Pigmentnetz brauchbar, Lageangaben unzuverlässig.
- `QC_Bericht_KI_Beschreibungen.md` – automatische Prüfung der früheren KI-Beschreibungen (nicht mehr auf der Wand)
- `prompts/skinmap_vlm_beschreibung_v1.1.txt` – verwendeter Beschreibungs-Prompt (Version 1.0 plus Zusatz v1.1)
- Skripte: `scripts/eval/` (Apollo-Lauf mit Lastmessung, ISIC-Vergleich, QC) und `scripts/` (isic_meta, build_experten, build_derm7pt)

Derm7pt (`derm7pt/`) liegt im **privaten** Repo (Entscheidung von A. Navarini, 2026-10-15). Der Datensatz darf laut Autoren nicht weiterverteilt werden (nur Forschung, CC BY-NC-ND): Repo nicht öffentlich machen und `derm7pt/` nie auf den öffentlichen Host kopieren (der Public-Build kopiert den Ordner nicht).
