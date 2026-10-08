# Confidentialité Vistaire — version de travail, non publiée

Inspection du 8 octobre 2026, base `cd91ec7556c9d6dcafe6d2d44b27f571abd1e0be`.
Ce document prépare la rédaction d'une politique. Il n'est ni une politique
approuvée, ni une garantie de conformité juridique. Aucune route publique ou
lien de footer n'est ajouté avant validation des informations manquantes.

## Faits confirmés dans le dépôt

| Traitement | Données et fonctionnement observés | Source |
| --- | --- | --- |
| Demande de contact ou d'échange | Nom, courriel, restaurant, message, langue, identifiant de tentative et horodatage. Le même formulaire sert aux deux parcours. | `components/vistaire-preview/VistaireContactForm.tsx` |
| Envoi de la demande | Resend reçoit les données nécessaires à deux courriels : la demande à `contact@vistaire.ca` et sa confirmation au demandeur. Cet endpoint n'enregistre pas la demande dans Supabase. L'acceptation par Resend ne prouve pas la livraison. | `app/api/contact/route.ts`, `lib/contactEmails.ts` |
| Protection du formulaire | Validation, vérification de l'origine, champ anti-spam et quota temporaire en mémoire par adresse IP issue des headers. Une fenêtre de quota de dix minutes n'est pas une durée de conservation des courriels. | `app/api/contact/route.ts` |
| Courriels directs entrants | Le worker Cloudflare transfère le message vers la destination configurée, puis transmet des métadonnées signées à un endpoint Vistaire pour envoyer un accusé de réception via Resend. L'adresse effective de transfert et la conservation de la boîte destinataire ne sont pas vérifiées. | `workers/inbound-email/index.ts`, `app/api/inbound-email/route.ts` |
| Analyse de navigation | Microsoft Clarity est chargé après l'interactivité en environnement Vercel `production`, en dehors de `/admin`, `/owner`, `/todos` et `/sign-in`. Le code inspecté ne contient pas d'interface de consentement ni de condition de consentement avant ce chargement. Les réglages Clarity, les masquages et les données effectivement collectées ne sont pas établis par ce code. | `components/analytics/MicrosoftClarity.tsx`, `MicrosoftClarityScript.tsx`, `lib/analytics/microsoftClarityRoutes.ts` |
| Mesure de fréquentation | Vercel Analytics est intégré aux layouts français et anglais lorsque `VERCEL_URL` est défini. Les données du compte et les paramètres du fournisseur n'ont pas été obtenus. | `app/(fr)/layout.tsx`, `app/(en)/layout.tsx` |
| Consultation de menus | Le code crée un identifiant aléatoire en `sessionStorage` et peut envoyer des événements de consultation avec restaurant/menu, plat, catégorie, recherche, filtre, action, dimensions de l'écran et métadonnées. L'endpoint peut les enregistrer dans `analytics_events` Supabase avec le user agent, si le service est configuré. | `lib/analytics/client.ts`, `types.ts`, `eventStore.ts`, `app/api/analytics/events/route.ts` |
| Accès privés | Clerk et des cookies d'accès sont utilisés pour les espaces privés. Leur configuration réelle, les catégories de données de compte et leur conservation demandent une validation distincte. | `components/owner/OwnerClerkBoundary.tsx`, `lib/auth/**`, `lib/admin/accessSessionCore.ts` |
| Hébergement et médias | Vercel héberge le site ; le dépôt contient des intégrations Cloudflare, Supabase et R2. Les contrats, régions de traitement et durées de journaux de ces fournisseurs ne se déduisent pas de leur présence dans le code. | `vercel.json`, `utils/supabase/**`, `lib/storage/**` |

Aucune politique dédiée n'a été trouvée dans le checkout de la base inspectée.
Les vérifications navigateur du site public ont observé le chargement de scripts
depuis `scripts.clarity.ms` et `www.clarity.ms` sur les parcours marketing. Cela
confirme leur chargement, sans établir les cookies, les masquages ni les données
effectivement transmises. Les requêtes autres que GET/HEAD y étaient bloquées.
Aucun formulaire de production n'a été soumis pendant les vérifications. Les
tests de formulaire utilisent le serveur local et des réponses simulées ;
aucune mutation métier n'est exécutée sur les services de production.

## Texte français de travail, fondé sur ces faits

Lorsque vous demandez un échange avec Vistaire, le formulaire vous demande votre
nom, votre adresse courriel, le nom de votre restaurant et votre message. Ces
informations permettent de recevoir votre demande et de vous répondre à propos
de votre projet de menu digital. Le formulaire utilise Resend pour transmettre
la demande à Vistaire et vous envoyer un courriel de confirmation. Vous pouvez
aussi joindre Vistaire directement à `contact@vistaire.ca`.

Le site intègre des outils de mesure de fréquentation et de navigation, dont
Vercel Analytics et Microsoft Clarity. Les menus peuvent également transmettre
des événements de consultation à Vistaire : ouverture de carte ou de fiche
plat, recherche, filtre et interaction avec les contenus 3D ou AR. Le code de
ces menus utilise un identifiant aléatoire conservé dans le stockage de session
du navigateur. Les outils tiers et les cookies qu'ils utilisent doivent être
précisés après vérification de leur configuration et du mécanisme de
consentement retenu.

## English working text, based on the same facts

When you request a conversation with Vistaire, the form asks for your name,
email address, restaurant name and message. These details let Vistaire receive
your request and reply about your digital menu project. The form uses Resend to
send your request to Vistaire and email you a confirmation. You can also reach
Vistaire directly at `contact@vistaire.ca`.

The website integrates traffic and navigation measurement tools, including
Vercel Analytics and Microsoft Clarity. Menus can also send consultation events
to Vistaire, such as opening a menu or dish page, searching, filtering and
interacting with 3D or AR content. Menu code uses a random identifier held in
the browser's session storage. Third-party tools and their cookies still need
to be described after their settings and the chosen consent process have been
verified.

## Informations à valider avant toute publication

1. Identité légale de l'entreprise, coordonnées à publier et personne ou fonction
   désignée responsable de la protection des renseignements personnels.
2. Durées réellement appliquées, critères de suppression et procédures pour les
   demandes/courriels, journaux, données de navigation, événements Supabase et
   comptes clients ; distinguer conservation et fenêtres techniques de quota.
3. Destination des courriels Cloudflare, fournisseurs effectivement actifs,
   sous-traitants et pays/régions où les données sont traitées ou accessibles.
4. Paramètres Clarity et Vercel : cookies/stockage, masquage des formulaires,
   finalités, activation réelle et mécanisme de consentement/retrait validé pour
   le Québec. Une politique seule ne résout pas ce point.
5. Procédure et canal validés d'accès, de rectification, de retrait et de
   suppression ; modalités de vérification de l'identité et délais applicables.
6. Champ de la politique (visiteurs, menus publics et/ou comptes restaurateurs),
   validation juridique et approbation du propriétaire des versions FR/EN.

Le texte destiné au public devra être complété et relu à partir de ces réponses,
puis approuvé. Aucun responsable, délai, pays, consentement ou engagement légal
n'est inventé dans ce chantier.
