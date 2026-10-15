# ISIC 2018 Task 2 – Vergleich Apollo (Prompt v1.1) vs. Expertenmasken

Bilder: 300 (Zufallsstichprobe aus Test+Validierung). Anwesenheit = Maske nicht leer; Apollo-Treffer = zugeordnete Befundcodes mit state=present.

| Merkmal | Experten positiv | Apollo positiv | TP | FP | FN | TN | Präzision | Recall | F1 |
|---|---|---|---|---|---|---|---|---|---|
| pigment_network | 212 (71 %) | 198 (66 %) | 165 | 33 | 47 | 55 | 0.83 | 0.78 | 0.80 |
| negative_network | 20 (7 %) | 0 (0 %) | 0 | 0 | 20 | 280 | – | 0.00 | – |
| streaks | 26 (9 %) | 34 (11 %) | 17 | 17 | 9 | 257 | 0.50 | 0.65 | 0.57 |
| milia_like_cyst | 17 (6 %) | 7 (2 %) | 1 | 6 | 16 | 277 | 0.14 | 0.06 | 0.08 |
| globules | 53 (18 %) | 223 (74 %) | 45 | 178 | 8 | 69 | 0.20 | 0.85 | 0.33 |

## Lage (nur Bilder, bei denen beide das Merkmal sehen und die Lage eindeutig ist)

| Merkmal | n | Lage stimmt | Anteil | „Zentral“ wäre immer richtig bei | Seitenangaben (links/rechts) n | richtig | vertauscht |
|---|---|---|---|---|---|---|---|
| pigment_network | 72 | 34 | 0.47 | 0.76 | 7 | 4 | 3 |
| negative_network | 0 | 0 | – | – | 0 | 0 | 0 |
| streaks | 9 | 3 | 0.33 | 0.44 | 1 | 1 | 0 |
| milia_like_cyst | 1 | 1 | 1.00 | 0.00 | 1 | 1 | 0 |
| globules | 42 | 29 | 0.69 | 0.45 | 6 | 3 | 3 |
