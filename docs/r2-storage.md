# Stockage médias R2

Le flag serveur `R2_STORAGE_ENABLED=true` bascule uniquement `vistaire-media`
et `vistaire-3d` vers R2. Les autres buckets restent sur Supabase. Les noms
de buckets, clés et métadonnées DB sont conservés.

Configurer `R2_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
`R2_S3_ACCESS_KEY_ID` et `R2_S3_SECRET_ACCESS_KEY` côté serveur.
Les autorisations doivent couvrir les lectures, écritures, listes et suppressions
des deux buckets. Ne pas exposer ces variables via NEXT_PUBLIC.

Les routes publiques contrôlent le plat puis redirigent vers l'URL publique
permanente du CDN (`https://cdn.vistaire.ca`, `https://3d.vistaire.ca`) quand
R2 est activé et que le CDN sert l'objet (contrôle HEAD court + validation
anti-forgery de l'hôte et du chemin) ; sinon elles retombent sur une URL S3
pré-signée à expiration courte, avec une signature correspondant a GET ou
HEAD. Le cache serveur distingue ces methodes. Les assets
« authorized-admin » n'utilisent jamais le domaine CDN public : toujours
l'URL pré-signée. Le 307 vers l'URL permanente peut être mis en cache en
public (borné, `s-maxage=120`) ; le repli pré-signé est `private, no-store`.
La révocation est appliquée à la couche de divulgation : après dépublication
ou remplacement d'un asset, le redirect cesse d'émettre toute URL dans le
SLA (cache métadonnées 30 s). Une URL permanente déjà divulguée reste
utilisable tant que l'objet existe dans R2 (objets immuables, adressés par
contenu ; aucune suppression au remplacement/à la dépublication pour
l'instant) : l'accès résiduel par URL conservée après révocation est connu et
équivaut aux octets conservés par téléchargement pendant la fenêtre publique.
Le header `X-Vistaire-Asset-Revocation-SLA` n'est donc annoncé que sur les
redirects pré-signés, jamais sur les redirects CDN permanents. La suppression
des objets à la dépublication/au remplacement est un chantier futur (décision
du propriétaire requise). Ne pas exposer les buckets via r2.dev ou un Worker
qui contourne le contrôle de disponibilité ; cette PR ne modifie aucune
ressource Cloudflare.

CORS R2 doit autoriser les origines du site pour GET/HEAD et les en-têtes Range
utilisés par les médias. Les uploads du worker local utilisent un PUT signé
avec If-None-Match: * : ils ne peuvent pas remplacer un objet publié.
La taille exacte runtime/rapport est liee a la signature Content-Length,
avec le plafond de bucket existant de 250 Mio.
Lancer le worker depuis cette version du dépôt. Les écritures serveur et ce
worker Node ne nécessitent pas de permission CORS navigateur.

Avant activation en production, valider sur une preview configurée :
lecture image/GLB/USDZ, clés avec espaces/accents, upload photo, upload USDZ,
repli vers la photo originale si son dérivé manque, et refus des liens expirés.
Les tests locaux utilisent des objets et identifiants synthétiques.

Pour le validateur HTTP R2, utiliser
`--expected-storage-host <account-id>.r2.cloudflarestorage.com` (sans bucket).
Pour l'E2E navigateur, utiliser
`VISTAIRE_RUNTIME_STORAGE_HOST=vistaire-3d.<account-id>.r2.cloudflarestorage.com`.

## Scripts et workflow de backfill

Les backfills photo/Maison Elyse et le runner 3D utilisent le meme adaptateur.
Le workflow manuel de backfill exige une variable GitHub `R2_STORAGE_ENABLED`
explicitement `true` ou `false`, identique au deploiement, et les trois secrets
`R2_S3_*` si R2 est actif. Les scripts locaux doivent recevoir ces memes variables.
Les protections existantes (confirmation, canary, quota, mesure et verification)
sont conservees. Le workflow de production n'est pas execute par cette PR.
L'audit `supabase:usage:audit` reste un inventaire de Supabase, pas un audit R2.

## Retour arrière

Le flag false restaure le routage Supabase, mais ne recopie aucun objet.
Après de nouvelles écritures R2, un retour arrière exige de réconcilier les
objets référencés vers Supabase avant de changer le flag ; sinon les nouvelles
métadonnées pourraient pointer vers des fichiers absents. Suspendre les écritures
pendant cette bascule. Aucun effacement de l'ancien stockage n'est prévu ici.

Références : [URLs signées R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[CORS R2](https://developers.cloudflare.com/r2/buckets/cors/),
[suppressions partielles S3](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html).
