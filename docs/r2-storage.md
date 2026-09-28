# Stockage médias R2

Le flag serveur `R2_STORAGE_ENABLED=true` bascule uniquement `vistaire-media`
et `vistaire-3d` vers R2. Les autres buckets restent sur Supabase. Les noms
de buckets, clés et métadonnées DB sont conservés.

Configurer `R2_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
`R2_S3_ACCESS_KEY_ID` et `R2_S3_SECRET_ACCESS_KEY` côté serveur.
Les autorisations doivent couvrir les lectures, écritures, listes et suppressions
des deux buckets. Ne pas exposer ces variables via NEXT_PUBLIC.

Les routes publiques contrôlent le plat puis émettent une URL S3 à expiration
courte, avec une signature correspondant a GET ou HEAD. Le cache serveur
distingue ces methodes ; les redirects R2 ne sont pas caches par le CDN,
qui pourrait sinon reutiliser une reponse GET pour HEAD. Elles ne redirigent pas vers les domaines CDN publics. Pour conserver
la révocation, les objets protégés ne doivent pas être accessibles par un domaine
public R2, r2.dev ou un Worker qui contourne la signature. Vérifier ce réglage
avant activation ; cette PR ne modifie aucune ressource Cloudflare.

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
