# Console locale — Pipeline USDZ

UI web pour lancer le pipeline USDZ en local, sans passer par le dashboard :
dépose un `.usdz`, choisis le type de plat et le mode, suis la progression,
compare les résultats, teste en AR et enregistre ton choix.

## Lancement

```bash
cd pipeline-console
./start.sh
# → http://127.0.0.1:8130
# + une URL publique https://....loca.lt s'affiche automatiquement
#   (tunnel localtunnel) → ouvre-la sur ton iPhone pour tester en AR.
#   1re visite : entre ton IP publique si localtunnel la demande.
```

## Configuration (`config.json`)

| Clé | Rôle |
|---|---|
| `port` / `host` | écoute du serveur |
| `python` | Python avec Pillow (`python3`) |
| `blender` | binaire Blender (headless) |
| `variantsScript` | module de génération des 4 variantes |
| `vistaireRepo` | chemin du repo Vistaire — active le mode « profil unique » (vide = désactivé) |

## Modes

- **4 variantes** (recommandé) : passe par `optimize-restaurant-usdz.mjs --variants --dish-kind`
  du repo quand `vistaireRepo` est configuré (normalisation d'échelle physique
  selon le type de plat) ; sinon repli sur `usdz_variants.py` (Blender +
  textures 1024px/q65, normalisation d'échelle incluse). Progression en direct,
  manifest avec tailles et réductions.
- **Profil unique** : appelle `scripts/owner/optimize-restaurant-usdz.mjs`
  du repo (nécessite `vistaireRepo`). Le pipeline auto-sélectionne comme avant.

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
