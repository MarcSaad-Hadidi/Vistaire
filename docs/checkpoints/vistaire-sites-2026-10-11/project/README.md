# Vistaire — présentation actuelle optimisée

Version publique indépendante préparée à la demande du propriétaire. La présentation Vistaire précédente et la référence ORYZO restent distinctes. Interface immersive reprise du HEAD `ecaf036a1c69964ca9a5a71bd32c2be3e7786445` ; dashboard actualisé au HEAD `db8898ad09c53fda6455a64fac84b2356532751f` du PR #296 (MarcSaad-Hadidi/Vistaire). Le PR n’a pas été modifié. Les optimisations locales du renderer sont conservées.

Les tarifs terminent la présentation avec une main claire, pouce sur le côté
gauche et doigts derrière le côté droit, selon la nouvelle référence fournie.
La main photographique transparente et le téléphone 3D entrent comme un seul
groupe animé. Son écran présente une grande photo réelle de chacune des quatre
collections, sa matière, son nom et son prix de mise en place, avec l’abonnement
commun de 200 CAD/mois. Le bouton « Voir les tarifs en détail » mène à la page
Tarifs complète ; chaque carte mène aussi à sa collection. Un lien permet de prendre rendez-vous. Le
scroll natif fait défiler ce contenu dans le téléphone, puis révèle une FAQ
générale de cinq questions et le footer. La FAQ reprend le composant partagé
des autres pages et son formulaire de question. Les options et le détail
des collections restent sur la page Tarifs. Une courte présentation et les
liens vers les tarifs complets/rendez-vous entourent le téléphone sur PC et
passent au-dessus/en dessous sur mobile. Le grand CTA final est retiré : la
FAQ précède directement les liens du footer.

Le restaurant reste visible et s’assombrit progressivement derrière la main,
la FAQ et le footer, sans fond de section opaque. Il est capturé une fois dans
le renderer existant, puis réutilisé pendant l’animation. Le canvas reste dans
son host fixe et garde son habillage ; il ne change plus de parent aux transitions.
L’écran HTML utilise un portail dans ce même monde, sous l’ouverture alpha du
mesh, avec la même position de page que le rendu GPU. Le retour depuis la FAQ
redessine explicitement la main, même si sa pose finale est identique. Les tarifs ne lisent plus la géométrie DOM à
chaque scroll des autres sections ; la projection et les écritures immobiles
sont mises en cache. La résolution, les vidéos et le rythme restent conservés.

Le rig historique reste conservé et testé séparément. Ses positions de vertices
restent fixes dans leur buffer : le
squelette standard de Three applique les 36 transformations natives sur le GPU.
Leur équivalence avec la déformation quaternion d’origine est contrôlée sur
les 8 441 vertices aux 46 poses. La géométrie, l’atlas et les pistes sont conservés, ainsi que les
pistes du produit et de la caméra ; provenance dans
`public/assets/pricing-hand/provenance.json`. Les boutons sont de vrais liens
HTML, projetés sur le mesh de l’écran. La nouvelle prise laisse tout l’écran
libre ; le téléphone d’origine garde son ouverture en alpha pour cet écran HTML. La main
s’immobilise après 0,9 écran de scroll ; la première carte reste ensuite visible
pendant 0,2 écran avant une lecture ralentie à 0,9 pixel visible par pixel de page.
Le contenu défile sans nouvel upload de texture. La hauteur du chapitre suit le contenu réel. Clavier et mouvement
réduit restent pris en compte ; le téléphone HTML sert aussi de secours.
Voir `design-qa.md` pour les vérifications et la limite de contrôle navigateur.

La main démarre juste sous le cadre et rejoint sa place avec une accélération
et un arrêt progressifs, sans changement de taille ni retard ajouté au scroll.
La sortie vers la FAQ est également adoucie. Le masque suit l’arrondi du boîtier
pour conserver la paume sous les coins du téléphone.

Les maintiens sont adaptés par section au retour au trackpad : plus longs pour
la carte mobile et chaque texte de détail, plus courts pour la signature, les
plats et les collections. Le MacBook s’ouvre après son entrée, avec une phase
plus longue et un raccord plus progressif vers la section suivante. La lecture
des vidéos et le scroll natif restent conservés.

L’interface est noire et or. Les vidéos originales des menus se lisent dans le téléphone, la galerie et les pages publiques lorsqu’ils sont visibles ; elles s’arrêtent hors écran et en arrière-plan. Le film cinématique existant reste disponible en secours WebGL. Les supports, le téléphone, le restaurant et le MacBook proviennent des GLB fournis. Les sept plats utilisent les modèles Vistaire existants et leurs variantes mobiles déjà disponibles. Les sources et matériaux embarqués sont conservés ; aucune géométrie de plat n’est modifiée pour zoomer. La caméra physique commune rapproche l’ensemble de la scène. La lampe et le verre à vin sont masqués.

Le défilement vertical reste natif. Les chapitres mobiles conservent leur hauteur lors d’un changement de hauteur de la barre du navigateur. Les panneaux cinématiques sont fixes dans le viewport et les panneaux inactifs sont masqués ; tarifs et footer restent dans le flux naturel. Les textes et les poses sont publiés ensemble après la clôture GPU. Les transitions consomment directement le même échantillon déjà adouci du scroll, sans retard temporel supplémentaire ; les contrôles immobiles gardent leur amortissement exponentiel de coefficient 12. Le renderer s’arrête lorsque la scène est immobile ou masquée et limite les images GPU en attente à une seule. Les bornes sont mises en cache et les ombres recalculées au changement de pose. La résolution garde le DPR natif jusqu’à 3, avec un budget de quatre millions de pixels.

L’entrée interactive est dans `src/App.jsx et Scene.jsx`. Les 51 pages publiques Vistaire en français et anglais restent disponibles. Les données des menus, prix et coordonnées viennent de Vistaire ; les établissements affichés sont des menus de démonstration. Les pages de rendez-vous préparent un courriel et ne simulent pas une réservation. Les pages privées et les cartes opérationnelles restent sur Vistaire officiel.

## Construire

```sh
npm ci
npm run build
npm run test:sites
```

La compilation prépare et vérifie par SHA-256 les huit fichiers de `runtime-assets.json` (trois GLB et cinq MP4), puis produit `dist/client`, `dist/server/index.js` et `dist/.openai/hosting.json`. Les GLB et vidéos de menus proviennent du commit public épinglé ; les deux films cinématiques existants sont conservés dans `runtime-sources`. Tous sont inclus dans l’archive déployée.

## Vérification

Les preuves de cette version sont dans `qa/verification.json`, `qa/controls-verification.json` et `qa/latest-ui-verification.json`, avec les captures desktop et mobile aux positions de lecture réelles. Les nouveaux contrôles couvrent les langues, le thème, les photos, les liens de menus officiels, les cartes actives, la FAQ et les six groupes du footer. Voir `design-qa.md` pour la portée exacte. Les comptes rendus sous `docs/archives` et les anciennes validations héritées décrivent le Site source, pas cette nouvelle publication.

Les adaptations Next→Vite conservent les composants et CSS du PR : liens natifs vers les pages locales et menus officiels, assets locaux exacts, wrapper data-immersive-vistaire. La FAQ utilise la branche native details/summary déjà fournie dans le PR, avec le même style et ouverture unique ; les questions libres demandent le service public officiel et affichent son état indisponible en cas de panne, sans réponse inventée. Les images de menus restent visibles jusqu’au décodage de la vidéo et lors d’une interruption. Les 14 photographies marketing proviennent du même HEAD.


Correction v14 : main fournie par le propriétaire, poignet vers le bas à gauche ; actions et conditions hors téléphone, Pilotage +100 CAD/mois dans le téléphone. Les liens sont dans un portail au-dessus du contenu. Restaurant Studio du PR296 repris dans la démonstration ; illustrations SVG desktop/mobile, claires/sombres, sur le Mac et dans le téléphone. Palette et contraste du restaurant, FAQ et footer suivent le thème. Vérification de géométrie Three et tests Node/SSR ; pas de navigateur disponible dans cet environnement.

Correction v15 : même barre de navigation sur les 52 routes publiques FR/EN, liens vers les pages du site et thème conservé avant affichage. Mode clair des pages, formulaires et footer relié aux tokens communs. Sur la landing, aucun voile blanc de remplacement : la scène reste naturelle en clair ; sa luminosité sombre reste identique à l’entrée de la main. Téléphone mobile réduit pour laisser titre et boutons libres, CTA alignés et contrastés. Aperçu Pilotage responsive ; la démonstration Studio conserve ses pages et périodes interactives. Contrôles SSR des 52 routes/images, tests React des contrôles, projection Three mobile/desktop et checks renderer/scroll/Worker. Pas de nouvelle validation navigateur ou de FPS sur appareil.
