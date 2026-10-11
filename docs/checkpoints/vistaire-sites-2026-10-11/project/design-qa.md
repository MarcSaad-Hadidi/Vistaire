# Vistaire — présentation actuelle optimisée — vérification du 11 octobre 2026

## Version actuelle v13 — revue au trackpad et composition des tarifs

Les distances de maintien répondent séparément au retour sur PC. Les entrées,
sorties, poses et textes consomment toujours le même scroll natif publié avec
le rendu GPU. Aucun filtre wheel/trackpad ou retard temporel global n'est ajouté.

| Phase, en hauteurs du viewport stable | v12 | v13 |
| --- | ---: | ---: |
| Carte à portée de main, maintien final | 1,05 | 1,75 |
| Chaque détail compte, maintien de chaque texte | 1,4 | 2,1 |
| Signature de votre table, phase active | 2,8 | 2,24 |
| Plats 3D, phase active | 2,8 | 2,24 |
| Choisissez votre collection, phase active | 2,8 | 2,1 |
| PC, phase active | 2,8 | 3,5 |
| PC vers prochaine section, raccord complet | 2,54 | 3,17 |
| Main arrivée, maintien avant lecture | 0 | 0,2 |
| Déplacement visible dans le téléphone / déplacement de page | 1,65 | 0,9 |

Le couvercle natif du MacBook s'ouvre après son entrée, pendant 76 % de la
phase active avec une rampe progressive ; il est ouvert avant le raccord
sortant et reste ouvert pendant ce raccord. Les proportions par chapitre
restent identiques avec le réglage de vitesse de prévisualisation. Les trois
vidéos de démonstration gardent leur rythme de lecture précédent.

La photographie de la main avait un poignet coupé au bord gauche du fichier.
La nouvelle retouche générée `fair-hand-grip-v2.png` conserve la prise claire
et prolonge le poignet vers le bas/droite. Ses deux bords latéraux sont entièrement
transparents : plus de coupe verticale au milieu de la scène. Le PNG original,
le nouveau PNG et l'ancien rig restent conservés. La main photographique suit
le vrai boîtier 3D sans mouvement individuel des doigts. Le masque arrondi est
recalé sur le nouveau fichier 1070 × 1470, sans modifier ses pixels après génération.

La dernière demande ajoute une courte présentation à gauche et deux vrais
liens à droite : tarifs complets et rendez-vous. Sur les formats empilés, le
titre passe au-dessus et les boutons sous le téléphone. La caméra et le secours
HTML réservent leur espace. Ce texte est un portail au-dessus du canvas fixe,
publié et masqué avec le même échantillon que le téléphone ; les contrôles sont
inert hors de leur présentation. Aucun fond opaque n'est ajouté à la section.
Le grand CTA « À la hauteur de votre restaurant » et son espace réservé sont
retirés : la FAQ générale précède directement la navigation du footer.

68 tests ciblés passent, dont les nouveaux maintiens, le couvercle et ses
raccords réversibles, la lecture retardée et ralentie, les dimensions du PNG,
les caches de textes extérieurs, les synchronisations GPU et le Worker Sites.
Le rendu React serveur confirme les liens FR/EN, les cinq hauteurs de chapitres,
les quatre photos et l'ordre FAQ/footer. La projection réelle est vérifiée sur
sept formats, dont 1906 × 862, 390 × 740 et 320 × 600. Les bandes de texte et
de boutons restent hors du boîtier sur les formats mobiles vérifiés.

Preuves : `qa/pricing-hand/trackpad-review-validation.json`,
`trackpad-content-validation.json` et `fair-grip-v2-generation.md`. La compilation
vérifie les huit médias runtime ; les sept fichiers de main sont comparés à
leur provenance SHA-256. Le plugin navigateur reste indisponible : ces contrôles
ne remplacent pas une revue visuelle au trackpad ou sur Safari/iPhone et ne
mesurent pas les FPS de ces appareils.

## Historique v12 — transition douce et paume sous les coins arrondis

Le coin rectangulaire visible dans IMG_7585 venait du masque du téléphone
photographique : il supprimait aussi la paume à l’extérieur des coins du
boîtier. Le shader suit maintenant un rectangle arrondi de rayon 80 pixels
dans l’image source. Le PNG d’origine reste intact. Le diagnostic
`qa/pricing-hand/rounded-corner-comparison.png` compare l’ancien masque au
nouveau avec la géométrie de production ; il ne représente pas le rendu HTML
ni un navigateur. Le pixel opaque de paume (330, 1090) est désormais conservé.

L’entrée prend 0,9 écran de scroll. La main et le téléphone parcourent
0,85 hauteur du viewport 3D, avec une courbe quintique dont vitesse et
accélération sont nulles aux deux extrémités. La caméra et la taille restent
à leur pose finale ; seule une légère rotation de trois degrés accompagne
la translation. Le départ est juste sous le cadre, sans longue montée depuis
le bas. Sur le format 390 × 740, la course du téléphone passe d’environ 934
à 624 pixels. Aucun suivi temporel supplémentaire n’est ajouté au scroll.

La sortie vers la FAQ démarre également sans saut de vitesse. L’offset commun
au rendu, au HTML et aux pointeurs rejoint progressivement la vitesse native
sur les premiers pixels de sortie. L’assombrissement du restaurant utilise
la même progression adoucie. La vitesse de lecture du téléphone (1,65), les
photos, les prix, les vidéos, le DPR et le facteur de parcours natif (0,7)
restent inchangés. La main reste une image photographique animée avec le
téléphone 3D, sans articulation indépendante des doigts.

Les 33 tests ciblés passent : progression et taille stables sur quatre formats,
alignement HTML/mesh à l’aller et au retour, redimensionnement, raccord FAQ,
cache au repos, synchronisation GPU, modèle tardif, masque et Worker Sites.
La compilation vérifie les huit médias runtime. Les six assets de la main
sont comparés à leurs SHA-256 de provenance. Les preuves géométriques sont
dans `qa/pricing-hand/fair-grip-validation.json`.

Le plugin navigateur est indisponible : le rendu final et la fluidité sur
Safari/iPhone restent à vérifier visuellement. Aucun gain de FPS mesuré sur
appareil n’est revendiqué.

## Historique v11 — nouvelle prise claire et offres illustrées

La nouvelle demande remplace la prise native d’origine par celle de la photo
fournie : pouce à gauche, quatre doigts recourbés derrière le bord droit et
écran entièrement dégagé. La main est un nouveau détourage photographique
généré, à peau claire naturelle. Il est animé dans le même groupe que le vrai
téléphone 3D ; ce changement n’ajoute pas de nouveau squelette ni d’animation
indépendante des doigts. L’ancienne main et ses 46 poses restent conservées
et testées comme rig historique, mais ne sont plus la prise par défaut.

Le PNG original (1071 × 1468, 856 219 octets, transparence réelle) est intégré
sans retouche. Son téléphone provisoire est masqué dans le shader ; seuls la
main et les doigts entourent le boîtier 3D original. Le rendu utilise toujours
le canvas fixe, la scène de restaurant et l’ouverture de l’écran HTML. Main,
boîtier et interface suivent le même échantillon GPU-ready, y compris lors
de la sortie et du retour depuis la FAQ. La main tenue ne se redessine pas
pendant la lecture. La résolution et les cinq vidéos runtime restent identiques.

Chaque carte de collection montre la photo marketing existante, réservée à
un ratio stable 3:2, sa matière, son nom et son tarif réel : 2 000, 2 050,
2 100 et 2 200 CAD. L’abonnement commun de 200 CAD/mois est affiché une fois.
Le bouton doré « Voir les tarifs en détail » ouvre la page Tarifs locale en
français ou en anglais ; les cartes mènent à leurs ancres de collection.
La marge de lecture finale est réduite de 180 à 48 pixels puisque les doigts
ne cachent plus les derniers liens. La longueur reste calculée sur le contenu
mesuré, sans modifier la vitesse native ni les autres sections.

Les contrôles React statiques vérifient les quatre images locales, les prix,
six liens et la FAQ partagée dans les deux langues. Les nouveaux tests couvrent
l’alignement de la photo avec le boîtier, les formats et la réversibilité, toute
la surface de lecture accessible, le repos du rendu, l’arrivée tardive du modèle
de téléphone et le secours en cas d’image indisponible. Les vérifications de la
prise originale restent explicitement sur `grip: "original"` ; la production
et les nouveaux tests utilisent `grip: "fair"`.

Le plugin navigateur est indisponible : pas de validation visuelle Safari ni
de mesure FPS post-modification. La projection hors navigateur ne reproduit
ni l’éclairage final ni l’UI HTML. Preuves : `qa/pricing-hand/phone-content-validation.json`,
`fair-grip-validation.json`, `fair-grip-generation.md` et `fair-grip-geometry.png`.

## Historique v10 — correction fondée sur la vidéo Safari

La vidéo de 26,76 secondes fournie le 11 octobre montre le téléphone HTML
avant la main (environ 1–2 s), une arrivée brusquement claire, une coupure du
poignet au bas du stage et plusieurs retours entre téléphone/FAQ où le contenu
ne suit pas la main. Le fond clair rend aussi la FAQ difficile à lire. Ces
observations ne permettent pas de déduire les FPS exacts du GPU.

Le canvas ne change plus de parent aux sections. Son ancien déplacement le
sortait du monde fixe et de son habillage ; il réinitialisait aussi sa taille
au moment du raccord. Le téléphone HTML est maintenant un portail dans ce
même monde, sous le canvas, avec des contrôles accessibles et un état inert
hors de la présentation. Son déplacement vertical et son scroll intérieur
sont publiés avec le même échantillon de page que le rendu de la main ; aucun
sticky HTML ne peut avancer seul pendant l’attente de la clôture GPU. L’UI
n’est révélée qu’avec la première image native, ou avec le secours si celle-ci
est indisponible. Les pointeurs restent masqués par les véritables doigts.

La caméra étend sa projection à toute la hauteur physique du canvas tout en
conservant la taille du téléphone. La hauteur du navigateur peut donc augmenter
sans couper le poignet au bord du chapitre gelé. Lors de la sortie, la main
abaisse le téléphone pendant que la FAQ arrive : le bord coupé de l’asset
reste sous le viewport. Le mouvement est réversible et utilise le même offset
pour le mesh, l’écran HTML et les pointeurs. Le retour depuis la FAQ
invalide la dernière image de la main : une pose identique est redessinée après
l’image du seul restaurant. Le texte de la collection précédente finit sa
sortie avant l’entrée de la main. Restaurant, ombres et détails restent visibles ;
une variation lumineuse progressive améliore la lecture de la FAQ et du footer.

La main utilise désormais le SkinnedMesh standard de Three et ses matrices
d’os, à géométrie et atlas identiques. Les 8 441 positions ne sont plus
recalculées et envoyées dans un buffer à chaque mouvement. Le test compare
la déformation des 36 os aux opérations quaternion natives sur les 46 poses,
pour tous les vertices, avec une erreur inférieure à 2e-7 unité du modèle.
La main est préchargée à la fin du chargement initial et ses shaders sont
préparés avant l’entrée. La résolution et les vidéos n’ont pas été abaissées.

Les quatre offres occupent une liste verticale, avec nom et prix sur chaque
ligne : 2 000, 2 050, 2 100, 2 200 CAD. L’abonnement commun reste 200 CAD/mois.
Les six liens du téléphone mènent aux quatre détails de collection, à la page
Tarifs et au rendez-vous. Le tarif détaillé n’est pas ajouté à la landing.
Les noms/prix tiennent dans les 244 pixels CSS disponibles aux tailles de
police de production, vérifiées avec les métriques des fontes originales.
Le rendu React statique vérifie les deux langues et la FAQ partagée.

La compilation et 80 tests ciblés passent (75 Node et cinq Worker), dont
la projection avec un canvas 850 px et un chapitre 740 px, le scroll retardé,
les pointeurs, les poses, les transitions et les vidéos. Une exécution plus
large a aussi trouvé un ancien test de souris obsolète qui attend un pitch :
le contrôleur existant et ce test n’ont pas été modifiés dans cette correction ;
il ne remet pas en cause les tests ciblés, mais la suite complète n’est pas
annoncée entièrement verte. Les huit médias runtime et cinq assets de la main
sont vérifiés par SHA-256. Les anciens dessins de géométrie restent historiques.

Le plugin navigateur est indisponible : aucun rendu post-correction Safari,
contrôle tactile physique ou gain de FPS sur iPhone n’est revendiqué. Les
preuves portent sur la vidéo avant correction, les opérations mathématiques,
le contenu React et la compilation, avec leur portée explicitement indiquée.

## Historique v9 — quatre offres dans le téléphone, scène et FAQ partagée

Le téléphone affiche les quatre collections Acrylique, Sculpté, Carré et
Signature, avec leurs prix de mise en place de 2 000, 2 050, 2 100 et 2 200 CAD.
L’abonnement commun de 200 CAD/mois apparaît une seule fois. Chaque carte mène
directement au détail de sa collection sur la page Tarifs ; rendez-vous et
lien vers tous les détails restent accessibles. Aucun pack, option ou
processus détaillé n’est ajouté. La FAQ générale utilise désormais le composant
SeoFaq des autres pages, y compris son formulaire de question et sa première
réponse ouverte. Elle précède le footer.

Les fonds opaques de la main, de la FAQ et du footer sont retirés. Le restaurant
réel est capturé dans une texture linéaire au DPR existant, avec le renderer et
le contexte déjà présents ; le tone mapping est appliqué lors de sa composition.
La scène de la main se dessine par-dessus et garde l’ouverture alpha de l’écran
HTML. À la sortie sticky, seul le viewport de la main se déplace ; le restaurant
reste plein écran pour éviter une bande vide derrière la FAQ. La salle est
capturée une fois par entrée/taille, puis le rendu se suspend au repos. La cible
est libérée à la reprise de la présentation principale.

Les mesures des tarifs sont limitées aux changements de taille, police,
projection ou mouvement réduit. Les échantillons continus du scroll utilisent
les mesures du chapitre déjà disponibles et ne lisent plus getBoundingClientRect,
scrollTop ou les styles CSS. La projection du téléphone est conservée pendant
la lecture ; les valeurs identiques ne sont plus réécrites. Dans les tests,
1 400 échantillons avant la section provoquent zéro écriture de tarifs,
500 projections identiques une seule écriture CSS, et 500 appels sur la main
immobile aucune nouvelle mise à jour de son scene graph. Ces comptes vérifient
la suppression de travail ; ils ne mesurent pas les FPS d’un appareil.

Les 66 tests ciblés et cinq tests Worker passent. Le rendu React statique FR/EN
confirme les quatre montants, six liens dans le téléphone, cinq questions et
le formulaire partagé. Le test de sortie compare la position GPU au déplacement
HTML à moins de 0,01 pixel. La géométrie/caméra de la v8 est conservée : son
rapport des 46 poses sur cinq formats reste applicable. Les huit médias runtime
et les cinq assets de la main gardent leurs sommes SHA-256.

Preuves : `qa/pricing-hand/performance-validation.json`,
`phone-content-validation.json` et `runtime-validation.json`. Les anciennes
images de géométrie ne représentent pas le nouveau restaurant en arrière-plan.
Le plugin navigateur est indisponible : le layout final DOM/WebGL, les
interactions Safari et le gain de FPS sur iPhone n’ont pas été mesurés.

## Historique v8 — une offre courte dans le téléphone, FAQ puis footer

Le grand texte autour du téléphone et les blocs de tarifs sous l’animation
sont retirés. L’écran contient uniquement le tarif de mise en place de la
collection choisie plus haut, 200 CAD/mois, trois inclusions, un lien de
rendez-vous, les deux repères taxes/engagement et le lien vers la page Tarifs
complète. Aucun sélecteur, option Pilotage, pack 3D ou processus détaillé n’est
ajouté à la landing. La page Tarifs complète est conservée. Une FAQ générale
de cinq questions, toutes fermées au départ, suit le téléphone avant le footer.

Le scroll de page reste natif. Après l’entrée de la main, le viewport HTML
interne reçoit l’offset correspondant à la distance de page, puis une courte
pause précède la sortie. La hauteur réelle du contenu et le facteur de
projection déterminent la longueur du chapitre. Le retour arrière restaure
le même offset ; le clavier révèle les liens dans le téléphone et la préférence
de mouvement réduit saute l’entrée. L’état DOM suit toujours la clôture GPU
établie en v6.

Les coins du véritable mesh de l’écran définissent une matrice CSS affine.
La caméra orthographique native permet un alignement exact pendant les
46 poses. Le téléphone garde ses matériaux partagés, sauf l’écran : un mesh
standard Three écrit une ouverture RGBA transparente, sans blending et avec
depth test. L’HTML sous le canvas reste masqué par le boîtier, l’îlot et les
doigts. Le raycast rejette les actions masquées par la main. Le canvas partagé
a désormais alpha=true ; le fond opaque de la scène principale est conservé.
L’écran n’utilise aucune CanvasTexture et le scroll de lecture ne provoque
aucun nouveau rendu GPU d’une pose immobile.

La compilation passe, ainsi que 60 tests de main/scroll/transition/vidéo/caméra
et cinq tests Worker. La projection HTML est comparée au mesh réel sur cinq
formats et 46 poses (erreur inférieure à 0,01 pixel). Le téléphone complet
présente zéro vertex hors viewport pour ces formats. Le rendu React statique
FR/EN des quatre collections confirme deux liens, trois inclusions, cinq
questions fermées et la route locale de détails. Les huit médias runtime et
les cinq sources de la main conservent leurs SHA-256.

Les preuves sont dans `qa/pricing-hand/runtime-validation.json`,
`phone-content-validation.json` et `*-geometry.png`. Les projections sont des
calculs de géométrie avec atlas et textes indicatifs, pas des captures du site.
La composition alpha réelle, le layout DOM, les interactions tactiles Safari
et les performances GPU sur appareil n’ont pas été contrôlés en navigateur :
le plugin navigateur est indisponible. Aucun succès visuel Safari ni FPS
physique n’est revendiqué.

## Historique v7 — reprendre la main du Site de référence

La vidéo utilisateur de 9,9 secondes a été inspectée à douze positions :
le téléphone HTML de secours apparaît, puis la zone devient vide autour de
1,6–2,4 secondes. La photo montre une main en grand dans le viewport, et non
le panneau arrondi introduit dans la v5. Ce panneau est retiré. Les tarifs
commencent par un stage plein écran, un grand titre « Votre offre. », la main
d’origine et les vrais sélecteurs de collections ; le récapitulatif HTML et
les conditions suivent dans le flux naturel.

Les cinq fichiers natifs sont repris à l’identique de l’autre Site. Le sampler
réutilise les 36 os, leur hiérarchie et les 46 poses sans les modifier. La piste
du produit et l’orientation de la caméra viennent aussi de la référence. Le
cadrage adapte la hauteur et le décalage horizontal au viewport. L’iPhone est
replacé 12 mm plus près des doigts et 12 mm plus bas que dans la v5, puis agrandi
de 6,7 %. Son bas passe derrière les doigts et les prix restent dans la partie
haute. Les montants et les conditions Vistaire ne changent pas. L’animation
suit linéairement la piste native sur 0,75 écran, puis garde 0,15 écran de pause.
Le mouvement réduit affiche directement la prise finale.

Le vertex shader personnalisé de la v5 est remplacé par le chemin de mesh
standard de Three, avec la même déformation quaternion calculée uniquement au
changement de pose. Le blend de l’atlas photographique est conservé. Le rendu
rétablit explicitement target, scissor et viewport ; un changement de dimensions
physiques du buffer invalide le rendu même si le CSS est identique. La main est
préchargée près de la section. Le secours HTML est masqué seulement après un
rendu de contenu ; les erreurs d’atlas/shader et un rendu du seul fond ne le
masquent pas. Ces corrections traitent les causes possibles du panneau vide ;
sa cause exacte dans Safari n’a pas été observée en instrumentation GPU.

Les projections dans `qa/pricing-hand/*-geometry.png` sont dérivées du véritable
scene graph de `createPricingHandScene` à 0 %, 50 % et 100 %. Elles vérifient
la géométrie, le cadrage et l’occlusion des doigts. L’éclairage, les textes et
le layout HTML y sont approximatifs : ce ne sont pas des captures navigateur.
Le téléphone complet ne présente aucun vertex hors du viewport sur les 46
poses et cinq formats (1440×900, 390×740, 320×600, 768×1000, 844×390).
Les tests couvrent les poids/poses, la déformation comparée à l’opération native,
les changements de prix, le redessin après resize/réentrée, l’arrêt au repos et
les chemins d’erreur. Le contrôle visuel DOM/WebGL et le FPS sur appareil n’ont
pas été exécutés : le plugin navigateur est indisponible dans cette session.

Compilation et 61 tests passent (56 poses/transition/vidéo/caméra et cinq Worker).
Les huit médias existants et les cinq fichiers natifs de la main dans la
production correspondent à leurs SHA-256 documentés. Le rapport détaillé de
projection du téléphone est `qa/pricing-hand/runtime-validation.json`.

## Version v6 — stabilité des transitions

La publication DOM précédait le contrôle de la clôture GPU : sous charge, les
textes pouvaient afficher un nouveau chapitre devant l’ancienne image 3D.
Le callback `beforeSceneFrame` publie maintenant le dernier scroll seulement
quand le renderer peut dessiner. Les demandes intermédiaires restent groupées.
Les poses de scroll, déjà adoucies en distance, ne reçoivent plus le retard
supplémentaire de l’amortissement temporel. Caméra et objets utilisent le même
easing ; les contrôles au repos conservent leur interpolation.

Les stages cinématiques sont fixes dans le viewport. Leur ancienne compensation
du sticky par des translations JavaScript est retirée. Un stage inactif est
masqué en entier, y compris ses contrôles, tout en conservant sa géométrie de
layout pour la mesure. Les hauteurs, le défilement natif et son facteur 0,7
restent identiques. Les tarifs, la main et le footer conservent leur flux naturel.

Quatre tests de régression vérifient un GPU occupé simulé (60 demandes, une publication
du dernier échantillon), le secours sans renderer, les fades sans superposition
sur trois hauteurs et le retour arrière, et les poses identiques à différents
rythmes de frames. Pas de contrôle visuel ou de mesure FPS en navigateur :
le plugin de contrôle navigateur demeure indisponible dans cette session.
Compilation, 52 tests de transitions/caméra/main/vidéo et cinq tests Worker
passent. Les huit médias et les cinq assets natifs de la main dans l’output
de production gardent leurs SHA-256 documentés.

## Historique v5 — première présentation de la main (remplacée)

Les tarifs intègrent le maillage ORYZO original (8 441 vertices, 15 422 triangles),
ses 36 os, 46 poses et l’atlas photographique exact. Le sampler conserve la
correction native des doigts et les transformations du produit. La caméra est
cadrée pour la section Vistaire ; les matériaux PBR et la géométrie de l’iPhone
existant sont partagés. Seul son écran a une texture propre aux tarifs, mise à
jour avec la collection, le montant et Pilotage. Tous les montants et conditions
existants sont conservés. Le bandeau dans l’écran est décoratif ; les actions
fonctionnent via les vrais boutons HTML.

La section propose un cadrage à droite sur desktop et une présentation empilée
sur mobile. L’entrée de la main suit 180 à 307 pixels de défilement naturel selon
la hauteur du panneau, puis reste immobile. Le mouvement est réversible et la
préférence de mouvement réduit affiche directement la prise finale. Le canvas
du renderer existant est temporairement déplacé dans le panneau ; la salle et
les vidéos sont suspendues. Le canvas est masqué pendant le chargement de la
main, puis replacé dans son host original en quittant la présentation. Aucun
second contexte WebGL, boucle de rendu permanent ou changement de DPR n’est ajouté.

Les projections 3D de trois poses sur desktop/mobile sont inspectées dans
`qa/pricing-hand/*-geometry.png`. Ce sont des rendus de géométrie et d’atlas,
avec éclairage et texte approximatifs, pas des captures du site. Le téléphone
reste entièrement cadré aux trois positions ; son écran reste cadré et orienté
vers la caméra aux 46 positions, sur cinq formats de panneau jusqu’à 280 px.
La prise en main et le dégagement des prix dans la partie haute sont vérifiés
sur ces projections. Les octets des assets de production sont contrôlés, dont les
cinq sources ORYZO exactes. Quatre tests supplémentaires couvrent les poses,
le retour arrière, le cadrage, les influences et la préférence de mouvement.

La compilation finale passe, ainsi que 46 contrôles de poses, scroll et vidéo
et les cinq tests Worker. Les huit médias existants et les cinq assets natifs
de la main dans `dist/client` correspondent à leurs SHA-256 documentés.

La validation complète DOM/WebGL dans le navigateur n’a pas pu être exécutée :
le plugin de contrôle navigateur est indisponible. Aucun résultat FPS physique
ni contrôle visuel complet desktop/Safari n’est revendiqué.

## Mise à jour actuelle — vidéos et rythme

Les trois démonstrations originales remplacent les images fixes du téléphone 3D,
de la galerie et des pages publiques. Les deux films cinématiques existants sont
restaurés pour les pages de présentation et le secours WebGL. Les cinq MP4 sont
en H.264 4:2:0, avec une première image décodée par FFmpeg et des SHA-256 vérifiés
dans l’archive de production ; détails dans `qa/video-media-validation.json`.
La lecture est différée jusqu’à la visibilité et suspendue hors écran, en
arrière-plan et pour la préférence de mouvement réduit. Les posters restent
affichés jusqu’à une image décodée. Un refus d’autoplay permet une reprise par
geste ; les requêtes interrompues et les callbacks de l’ancien menu sont invalidés.
Les frames vidéo réveillent le renderer à la demande et conservent les ombres.

Le facteur de distance passe de 0,8 à 0,7 : déplacements et pauses écrits sont
12,5 % plus courts. Les chapitres simples passent de 596 à 534 vh et les chapitres
à trois temps de 916 à 814 vh. La hauteur physique du stage reste inchangée.

Build, cinq tests Worker (dont MIME MP4 et préservation des ranges), douze tests
de lecture vidéo et trente tests SceneDirector/RestaurantPace passent. Pas de
nouveau contrôle navigateur dans cette session : plugin indisponible. Les
rapports et captures ci-dessous décrivent les versions précédentes, dont la
contrainte sans vidéo désormais remplacée par la demande actuelle.

## Historique des contrôles précédents

Compilation de production et quatre tests Worker réussis. Les trois fichiers GLB préparés correspondent exactement aux tailles et SHA-256 du manifeste. Les fichiers GLB embarqués des supports, du téléphone, du MacBook et du restaurant sont repris sans modification de leurs octets.

Les captures des douze chapitres ont été réalisées avec WebGL logiciel Chromium 153 / SwiftShader aux dimensions CSS 1440 × 900 et 390 × 844. Pour inspecter chaque pose sans accumulation d’images du GPU logiciel, les captures utilisent la préférence de mouvement réduit et un DPR de capture 0,5. Ce réglage de vérification ne modifie pas le DPR de production. Les deux panneaux intermédiaires de l’ouverture superposée de la version actuelle ont aussi été capturés à leurs vraies positions virtuelles.

`qa/verification.json` décrit les contrôles de stabilité : arrêt du rendu immobile, retour à l’ouverture, absence de vidéo, absence de débordement horizontal et invariance des positions des chapitres lorsque la hauteur mobile passe de 844 à 730 pixels. `qa/controls-verification.json` décrit les sélections des sept plats et des quatre collections, le zoom caméra sans changement d’échelle du maillage, le clavier, le menu mobile et les routes publiques vérifiées. Les 25 contrôles de cette version ont passé sans erreur ou fichier manquant.

Un contrôle séparé dans le même navigateur active les animations normales et vérifie le déplacement au défilement puis le retour à la pose de départ. Le renderer ne bloque pas le CPU pour attendre le GPU : une clôture WebGL2 est vérifiée sans attente bloquante et la pose la plus récente est consommée dès que le GPU est disponible.

Ces contrôles ne mesurent pas les FPS, la chauffe, les barres Safari, Quick Look ou WebXR d’un iPhone physique. Le moteur utilise les GLB Vistaire avec Three.js ; il ne prétend pas reproduire les shaders propriétaires, le pipeline de post-traitement ni chaque pixel d’ORYZO.


L’UI de cette publication reprend App/Pricing, leurs CSS, la locale, les gestes, le contrôleur de chapitres, PublicControls et PublicFooterNavigation du HEAD PR296 ecaf036a1c69964ca9a5a71bd32c2be3e7786445, vérifié de nouveau avant publication. Les 14 photographies marketing sont les fichiers exacts de ce HEAD. La provenance des fichiers source est consignée dans docs/latest-pr-ui.json. Le moteur conserve le scheduling à la demande, la clôture GPU non bloquante, la pièce immobile, les bounds mis en cache et la résolution de production antérieurs ; les poses et timings de l’ouverture sont alignés sur le dernier contrôleur.

23 contrôles supplémentaires ont passé dans qa/latest-ui-verification.json sur les deux viewports : liens de menus avec locale, une seule carte de lecture accessible, six groupes de footer, FAQ à ouverture unique, validation locale des questions trop courtes, thème et langues, pas de vidéo, pas de débordement et stabilité des chapitres mobiles. Les captures ai/wearable utilisent leurs positions virtuelles réelles ; les autres captures sont prises aux positions de lecture et non au début des fades. Aucune requête FAQ valide n’a été soumise pendant la QA. La FAQ libre dépend du service officiel Vistaire et conserve un état indisponible honnête en cas d’erreur ou de refus CORS.

## Rythme légèrement accéléré — 11 octobre 2026

La demande actuelle approuve le scroll et réduit son temps de lecture. Le facteur
des distances cinématiques est désormais 0,8 : lecture simple 4 → 3,2 écrans,
lecture à trois temps 8 → 6,4 écrans, maintien du téléphone 1,5 → 1,2 écran.
Les transitions passent de 3,2 à 2,76 écrans, en conservant l’écran réel du stage.
La distance d’ouverture passe de 12 à 10,2 écrans de hauteur totale. Les rapports
des étapes de lecture restent identiques. La dernière UI PR296 et le renderer
optimisé sont conservés ; aucun intercepteur de molette/touch n’est ajouté.
Le passage d’ouverture ne reçoit pas une deuxième application de l’easing des
chapitres, conformément au contrat de SceneDirector et à son test existant.

30 contrôles SceneDirector/RestaurantPace passent (continuité desktop/mobile,
retour arrière, coordonnées de salle, ouverture). Build, 4 tests Worker et SHA des
3 assets GLB passent. Les captures et rapports navigateur précédents décrivent le
rythme précédent. Pas de nouveau contrôle visuel dans cette session : plugin de
contrôle navigateur indisponible après maintenance. Pas de mesure physique.


## v14 — prise naturelle, liens et thème

Les nouvelles captures du propriétaire ont été inspectées. Le PNG fourni est copié sans édition ; la caméra place sa coupure gauche hors cadre sur PC et le téléphone garde son écran complet. Les actions ont un host fixe frère de la scène au z-index20, au-dessus du main z-index2, avec activation/inert synchronisée. Pilotage +100 CAD/mois est une option du forfait200, sans CTA/conditions répétés dans le téléphone. Le dashboard du PR296 db8898ad est porté en lecture seule avec sa fixture fictive ; les visuels du Mac/téléphone sont des illustrations issues du code SVG et non des captures. Mode clair/sombre : écran, FAQ, footer et shader du restaurant suivent le même thème ; la texture du Mac change aussi. Tests ciblés de géométrie, cache, pacing, SSR et compilation/Worker. Aucun test navigateur/FPS mesuré ; disponibilité control-browser absente. Revue globale thème/navigation à effectuer après cette première publication.

## v15 — navigation commune, transparence et mobile

Les captures 211511, 211706 et IMG_7586 ont été analysées. Deux règles héritées coloraient le bouton rendez-vous en or sans adapter son texte et conservaient 12px de marge sous le seul premier bouton : elles sont supprimées/neutralisées. Le cadrage portrait réserve davantage d'espace au titre et aux actions ; projection Three du boîtier à 393×747, 390×740, 390×844, 320×600, 430×932 et 768×1024, avec au moins20px libres au-dessus des actions.

Le fond capturé reçoit le gradient CSS original après conversion de couleur, uniquement sur le restaurant et en sombre. Il ne varie plus avec l'entrée de la main. En clair, suppression du voile sombre sans voile blanc ; surfaces de lecture de la landing transparentes, contraste du texte conservé sur la photographie. Le Mac et l'illustration du Studio continuent de suivre le thème.

La barre commune est utilisée sur les52 routes publiques FR/EN. Contrôle de rendu serveur de chaque route : exactement une barre et un sélecteur de thème, liens de pages et traductions valides, images locales présentes. Vérification React des deux sens du thème, conservation locale, synchronisation entre onglets, menu/Escape/scroll, quatre vues Studio et changement de période. Vérification CSS des surfaces marketing ; les photos, le PDF et les menus de restaurants gardent leur propre design. Les données Studio sont fictives et l'illustration Pilotage est un WebP issu du code, responsive, lié à l'aperçu interactif.

Build et tests Node ciblés (géométrie, synchronisation GPU, cache, transitions, pacing et Worker) vérifiés. Les52 routes ont été analysées en SSR : cela ne constitue pas une session navigateur. Contrôle navigateur indisponible ; aucune nouvelle mesure FPS, touch Safari ou screenshot après correction n'est revendiquée.
