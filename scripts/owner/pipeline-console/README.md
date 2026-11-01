# Console locale — Pipeline USDZ

Dépose un `.usdz`, choisis le type de plat, génère quatre variantes ou un profil unique,
compare les résultats et enregistre ton choix. L’historique permet de rouvrir un résultat
après redémarrage.

## Prérequis et lancement

Node.js 24, Python avec OpenUSD (`usd-core`) et Pillow, et Blender avec import/export USD.
Depuis la racine du dépôt, après `npm ci` :

```bash
cd scripts/owner/pipeline-console
./start.sh
# Console locale et URL HTTPS du tunnel affichées au démarrage.
CONSOLE_NO_TUNNEL=1 ./start.sh  # accès local uniquement
```

Le lanceur nécessite Bash et utilise localtunnel 2.0.2 via npx (réseau requis au
premier lancement). Sous Windows, le serveur peut aussi être lancé directement :

```powershell
$env:VISTAIRE_USDZ_PYTHON = "C:\Python314\python.exe"
$env:BLENDER_BIN = "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
node scripts/owner/pipeline-console/server.mjs
```

Les chemins de `config.json` sont relatifs au dossier de la console, quel que soit
le dossier de lancement. `python` et `blender` acceptent un nom dans le PATH ou un chemin.
`VISTAIRE_USDZ_PYTHON`, `BLENDER_BIN` (ou `VISTAIRE_USDZ_BLENDER`), `CONSOLE_HOST`
et `CONSOLE_PORT` permettent de remplacer ces paramètres. Redémarre après modification.

## Génération

- **4 variantes** : l’optimiseur du dépôt génère r50/r25/r15/r10 avec des cibles
  de triangles relatives à la source. Le type de plat détermine l’échelle physique.
  Les quatre résultats doivent être valides pour déclarer le lot réussi.
- **Profil unique** : utilise les profils balanced, light, premium ou emergency
  existants et leur sélection automatique.
- `vistaireRepo: ""` active explicitement le script autonome `usdz_variants.py`
  (Blender + Pillow) et désactive le profil unique. Un échec de validation de
  l’optimiseur configuré ne déclenche pas ce second moteur.

Les deux moteurs appliquent le budget de taille variants du fichier
`../usdz-optimization-recipes.json` (16 Mio par fichier par défaut).
`VISTAIRE_USDZ_VARIANTS_TARGET_BYTES` permet de le remplacer. Un dépassement
fait échouer le lot et retire ses fichiers et son manifeste.

Une seule génération est acceptée à la fois. Les erreurs restent visibles dans le
journal. Un choix est enregistré dans `data/choices.json` ; les fichiers ne sont
ni publiés dans le menu ni envoyés au stockage de production.

## Accès iPhone et données

Ouvre sur iPhone l’URL HTTPS complète affichée, puis touche « Voir en AR ».
Le même Wi-Fi n’est pas nécessaire avec le tunnel. La validation visuelle et
Quick Look sur un véritable iPhone reste nécessaire avant de publier un modèle.

Le tunnel rend la console accessible sur Internet : toute personne possédant
l’URL **et son token** peut lire les résultats et lancer des générations.
Le trafic passe par localtunnel. Ne partage pas ce lien et ferme le lanceur après usage.
Ctrl+C ferme le tunnel, la console et ses workers.

`data/` conserve localement les sources, résultats, journaux et choix ; ce dossier
est ignoré par Git. Le token change à chaque démarrage, sauf si `CONSOLE_TOKEN` est
fourni. Il n’est pas enregistré dans les résultats. Les fichiers journaux du
lanceur contiennent les liens d’accès et sont privés à l’utilisateur sur Unix.
