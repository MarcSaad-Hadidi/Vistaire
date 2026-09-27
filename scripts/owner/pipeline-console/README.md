# Console locale — Pipeline USDZ

UI web pour lancer le pipeline USDZ en local, sans passer par le dashboard :
dépose un `.usdz`, choisis le type de plat et le mode, suis la progression,
compare les résultats, teste en AR et enregistre ton choix.

## Lancement

```bash
cd scripts/owner/pipeline-console
./start.sh
# → http://127.0.0.1:8130
# + une URL publique https://....loca.lt s'affiche automatiquement
#   (tunnel localtunnel) → ouvre-la sur ton iPhone pour tester en AR.
#   1re visite : entre ton IP publique si localtunnel la demande.
```

Le tunnel se lance à chaque `./start.sh` : rien à faire à part
copier l'URL affichée. `Ctrl+C` arrête la console et le tunnel.

## Configuration (`config.json`)

| Clé | Rôle |
|---|---|
| `port` / `host` | écoute du serveur |
| `python` | Python avec Pillow (`python3`) |
| `blender` | binaire Blender (headless) — ou `BLENDER_BIN` en variable d'env |
| `variantsScript` | module de génération des 4 variantes |
| `vistaireRepo` | racine du repo — pré-configuré (`../../..`), active le mode « profil unique » |

## Modes

- **4 variantes** (recommandé) : génère `_r50`, `_r25`, `_r15`, `_r10` via
  `usdz_variants.py` (Blender + textures 1024px/q65). Progression en direct,
  manifest avec tailles et réductions.
- **Profil unique** : appelle `scripts/owner/optimize-restaurant-usdz.mjs`
  du repo (mode `--variants` disponible aussi en CLI, voir ci-dessous).
  Le pipeline auto-sélectionne comme avant.

## Mode `--variants` (CLI)

```bash
node scripts/owner/optimize-restaurant-usdz.mjs \
  --source <plat.usdz> --output ./variantes/ \
  --report ./variantes/manifest.json --variants --dish-kind plate
```

Génère les 4 variantes sans auto-sélection et les garde toutes :

- `plat_r50.usdz` — douce (≈ ratio 0,5, 90k triangles)
- `plat_r25.usdz` — moyenne (≈ ratio 0,25, 45k triangles)
- `plat_r15.usdz` — poussée (≈ ratio 0,15, 27k triangles)
- `plat_r10.usdz` — maximale (≈ ratio 0,10, 18k triangles)
- `manifest.json` — tailles, réductions, triangles avant/après par variante

Les 4 recettes (profil `variants` dans `usdz-optimization-recipes.json`)
réutilisent l'optimiseur existant (textures Pillow + décimation Blender
ciblée en triangles). Aucun pipeline dupliqué.

## Tester en AR

« Voir en AR » utilise `rel="ar"` : ouvre l'URL publique affichée par
`./start.sh` sur ton iPhone (tunnel automatique à chaque lancement),
touche le bouton d'une variante → AR Quick Look.

## Choix

Le bouton « Choisir » enregistre `{plat, variante, taille}` dans
`data/choices.json` — pour retrouver quel ratio tu as pris par plat.

## Données

`data/` contient uploads, jobs (résultats + logs) et choix. Rien ne part
sur le réseau : tout reste sur la machine locale.
