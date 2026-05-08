# Modèles 3D démo Maison Élyse (MVP stylisés)

Ces fichiers **GLB** sont des **assets de démonstration stylisés**, générés en procédural (Three.js via `npm run demo:generate-3d`, équivalent possible avec Blender via `scripts/create-demo-3d-models.py`). Ce ne sont **pas** des scans photoréalistes.

| Fichier | Usage |
| ------- | ----- |
| `.glb`  | Web et Android (Chrome, `model-viewer`, AR via WebXR / Scene Viewer) |
| `.usdz` | iPhone / iPad (Quick Look) — **non inclus** pour l’instant ; ajouter puis renseigner `usdzUrl` dans `lib/demoMenuData.ts` |

## Régénérer les GLB

Sans Blender :

```bash
npm run demo:generate-3d
```

Avec Blender (3.6+) :

```bash
blender --background --python scripts/create-demo-3d-models.py
```

Les deux approches peuvent produire des variantes géométriques / matériaux légèrement différentes.

## Déploiement

Pour **AR terrain** exploitable depuis un téléphone : servir le site en **HTTPS** (ex. Vercel).

## Version commerciale

Pour la production : remplacer par la **photogrammétrie**, un scan pro ou une **modélisation** par un artiste 3D selon vos standards.
