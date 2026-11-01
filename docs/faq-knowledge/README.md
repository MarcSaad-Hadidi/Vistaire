# Base de connaissances de la FAQ intelligente

Ce dossier est la **seule** source de faits de la question libre de la FAQ publique
(`POST /api/public/faq`). Le dépôt est public : n'y écrivez que des informations
publiables.

## Fonctionnement

- `manifest.json` est l'allowlist. Seuls les documents listés avec `"status": "approved"`
  sont chargés par `lib/faq-rag/knowledge.ts`. Aucun autre fichier du dépôt n'est lu.
- Chaque document Markdown contient des **passages** :

  ```md
  ## identifiant-stable
  topics: mots-clés FR, synonymes, mots-clés EN
  fr: Fait court en français.
  en: Même fait en anglais.
  ```

  Le texte avant le premier `##` est ignoré (notes internes). Les identifiants de
  passage sont uniques dans tout le corpus et ne doivent pas être renommés sans raison :
  ce sont eux que le modèle cite et que le serveur vérifie.
- Une seule base pour FR et EN : chaque fait porte ses deux langues dans le même
  passage. La recherche indexe les deux, la génération reçoit la langue de la question.
- Le corpus est lu côté serveur seulement et inclus dans la fonction Vercel par
  `outputFileTracingIncludes` (`next.config.ts`). Il n'est jamais envoyé au navigateur
  en entier : seuls les passages retenus partent vers Mistral.

## Champs du manifeste

| Champ | Rôle |
| --- | --- |
| `id` | Identifiant stable du document. |
| `file` | Fichier Markdown du dossier. |
| `status` | `approved` (chargé) ou `pending` (jamais chargé). |
| `category` | Regroupement éditorial. |
| `title.fr` / `title.en` | Libellé de source affiché sous une réponse. |
| `publicPath` | Page publique liée à la source, ou `null` (source sans lien). |
| `sources` | Fichiers du dépôt qui prouvent les faits du document. |
| `verifiedAt` | Date de la dernière vérification (`AAAA-MM-JJ`). |
| `topics` | Sujets couverts. |

## Protocole de maintenance

1. **Ajouter une information officielle** : vérifier qu'elle est publiée sur une page
   publique ou dans une source commerciale du dépôt, l'ajouter comme passage court
   (FR + EN + topics) dans le document de la bonne catégorie, ajouter le fichier source
   à `sources` si nouveau, mettre à jour `verifiedAt`.
2. **Vérifier une source** : chaque phrase doit se retrouver dans un fichier listé dans
   `sources`. Une fonctionnalité d'outil interne owner/admin, une démo ou un prototype
   n'est pas une offre commerciale : ne l'écrivez pas comme disponible.
3. **Fonctionnalité modifiée** : corriger le passage concerné dans le même PR que le
   changement produit, puis `verifiedAt`.
4. **Information obsolète ou douteuse** : la supprimer du document `approved`, ou la
   déplacer dans `09-en-attente.md` (statut `pending`) avec la raison.
5. **Prix** : la source de vérité reste `lib/pricingPage.ts`. Tout montant de
   `05-tarifs.md` est contrôlé par `npm run test:node` (`tests/faq-rag.test.mjs`) ; un
   changement de prix dans le code fait échouer le test tant que le corpus n'est pas
   aligné. Ne jamais écrire un rabais, une promotion ou une garantie non publiés.
6. **Nouvelle catégorie** : créer `NN-nom.md`, l'ajouter au manifeste avec
   `publicPath` pointant vers une page existante (vérifié par le test) ou `null`.
7. **Bloquer un document non approuvé** : `"status": "pending"`. Le chargeur ignore
   tout document non `approved` et tout fichier absent du manifeste.

Validation : `node --test tests/faq-rag.test.mjs` vérifie le manifeste, l'unicité des
identifiants, la présence FR/EN, les pages publiques, les fichiers sources, l'absence
de secrets et la cohérence des prix.
