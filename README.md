# SkinMap screensaver

The active display is https://dermatoskopie.ch/ (also www.dermatoskopie.ch),
with the dermoscopy image and clinical metadata on one screen. Diagnosis is
revealed 15 seconds after the image loads; the next image hides it again.
Skin type, localization and age appear immediately.
The source dataset appears in small print beneath each loaded image; an absent
dataset is left blank. The caption is cleared for placeholders and failed loads.

Only recorded `modality = dermoscopy` entries with a specific diagnosis are
eligible. Generic labels such as `benign`, `malignant`, unknown and empty values
are excluded. A specific `icd_description` can replace a generic `condition`.
Named diagnoses such as `malignant melanoma` remain eligible. Selection, fallback
lists and final rendering enforce these rules.

The display uses a deterministic neighbourhood route of up to 2000 Atlas
points. `?mode=random` enables random selection. Images retain their proportions;
no additional image details are generated. If no eligible images are available,
the display shows SkinMap with its logo.

## Build and deploy

```sh
python3 scripts/build_public.py /tmp/skinmap-public
```

Deploy the generated `index.html`, `vitrine.json` and `assets/` to the existing
`public-combined/` mount. The production service is `skinmap-combined`; its
configuration is in `deploy/docker-compose.yml` and `deploy/nginx-combined.conf`.
It has no dependency on the private readiness API. nginx sends `Cache-Control:
no-store`; already open displays need a reload after an application update.

The Atlas endpoint is configured in `index.html`; `vitrine.json` is the fallback
list. Both must supply recorded dermoscopy modality. Measured metadata takes
precedence over model estimates. Estimated age and localization are marked;
skin type omits the “Modell” label at the user's request.

## Verification

```sh
node tests/pruefe_diagnose.js
node tests/pruefe_modalitaet.js
node tests/pruefe_combined.js
```

The browser check requires Playwright and Chromium. `NODE_PATH` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing installation.
Tests use synthetic data and do not retain clinical images or row contents.

## Archived two-screen presentation

The sm1/sm2 presentation is retired from active operation. Its previous source,
operating notes and handoff are preserved in `archive/two-screen/`. The old
nginx configuration, readiness service and regression tests remain available
for recovery. The shared application retains the legacy preview modes.

Both legacy services require the explicit Compose profile `archived-two-screen`;
normal deployment starts only the single-screen service. The legacy containers
are stopped, with their deployed files preserved. To deliberately restore them:

```sh
docker compose --profile archived-two-screen up -d skinmap-screensaver
```

The archived presentation requires its existing authentication and readiness
service. Its former deployment instructions are historical, not instructions
for the active public screen.
