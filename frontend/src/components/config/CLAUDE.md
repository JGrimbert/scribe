# Configuration du document — `components/config/`

**⚠️ Plus d'écran routé (2026-08-05).** `ConfigView.vue` a été SUPPRIMÉ et la
route `config` retirée (`/config` et `/styles` **redirigent vers `maquette`**) :
styles, règles, surlignages et recalibrage vivent désormais dans la **maquette**
(`../maquette/MaquetteView.vue` + panes routés + `MaquetteBar`). Ce dossier
reste un **fournisseur de composants partagés** que la maquette monte. Les
sections d'orchestration propres à l'ancien écran — `TypologySection.vue`,
`LayoutSection.vue`, `PageFormatSection.vue`, `RunningBandControl.vue`,
`StructureModelList.vue` — ont été supprimées avec lui.

Le vocabulaire reste le **niveau de chapitrage** (`../../script/zones.js`,
`typology.js` + `DEPTH_LABELS` backend, alignés).

## Découpage

- **L'orchestration vit maintenant dans `../maquette/MaquetteView.vue`** + ses panes
  routés (`../maquette/panes/`). Le socle **règles** + la **complétude/anomalies**
  sont sur le jalon « Annotations » (`MaquetteAnnotations`, en regard des lambeaux),
  les **surlignages** y sont passés en menu de filtres (`MaquetteAnnotationFilters`).
  Flux de recalibration + action « Enregistrer » dans la doc-bar. L'ancien
  `ConfigView`/`MaquetteAside` (aside pleine hauteur) n'existent plus.
- **`../../composables/useTypologyConfig.js`** porte les données : inventaire,
  `styles`, `highlights`, `rules` (`{ default, byDepth }`), `settled`, les
  modèles (`useStructureShapes`), et le calcul des `sections` (une par zone,
  `groupByZone` + `shapeGroups` + profondeur des règles). `load(id)`/`save(id)`.
- **`HighlightsList.vue`** — les surlignages relevés (couleur · comptes ·
  ventilation · échantillon · rôle). **N'est plus monté** (l'aside « Validation » a
  disparu) : le jalon Annotations utilise `../maquette/MaquetteAnnotationFilters.vue`
  (menu de filtres, ex-« Surlignages »), plus léger. Composant conservé, `highlights`
  y était muté en place.
- **`StyleRolesTable.vue`** — table style · (succession) · rôle · (exigé) ·
  (ce qui précède), scopée à une zone, montée par les **callouts de styles** de la
  maquette (`MaquetteStyleCallouts`, liminaire + chapitrage). `styleRoles` est muté
  **en place**. Colonne **`show-precedes`**
  (opt-in) : `precedesOf`/`setPrecedes` sur la map **`stylePrecedence`** INJECTÉE
  (rien/saut/blanche par style, cf. `../liminaire/CLAUDE.md` et backend
  `typology.ts`) ; un **filet teal coiffe** les lignes qui ouvrent une page
  (`.row--page-start`). **1ʳᵉ ligne de la table liminaire** (`zone-key==='liminaire'`,
  `i===0`) : select **verrouillé sur « page blanche » et grisé** (`precedesLocked`)
  — la première page suit toujours la « Page de garde » (folio 0). Présentation
  seule (la garde vient de la blanche de tête du `.odt`, pas de cette valeur).
  Sous chapitrage (`show-require` + `depth-key`), deux contrôles d'éligibilité par
  ligne : la case **« exigé »** (par STYLE → `requiresStyles`) et, entre style et
  rôle, la puce **`SuccessionLink`** chevauchant la bordure avec la ligne suivante
  (paire → `requiresAdjacency`). Les deux appellent `toggleRequireStyle`/
  `toggleAdjacency` **injectés** (fournis par `MaquetteView`, mutent `rules` dans le
  composable) — comme `openStyleEditor`/`stylePrecedence`, pour ne pas remonter
  d'événement sur deux profondeurs. Plus d'encart « Règles d'éligibilité » : tout se règle en ligne.
  Un bouton **« + »** (au survol, dans la gouttière de gauche, avec `zone-key`)
  ouvre un popover **téléporté dans `<body>`** (sinon rogné par l'`overflow` d'
  `UiTable`) : nom libre + rôle → `addDeclaredStyle`. Une ligne déclarée s'affiche
  en italique, avec un « × » (`removeDeclaredStyle`). Voir `declaredStyles` ci-dessous.
  La table est **resserrée sur son contenu** (`.ui-table-box` en `fit-content`, la
  `.ui-table` interne forcée en `width: max-content` — surtout PAS `auto`, qui pour
  un `<table>` remplit la largeur dispo ; overrides via classe doublée pour battre
  la spécificité d'`UiTable`), laissant l'espace à droite libre.

## Recalibration — deux déclencheurs, une modale

`POST /documents/:id/recalibrate` rend un `PreviewResponse` ordinaire ;
`../maquette/MaquetteView.vue` monte alors le MÊME `ImportCalibration` (cf.
`../import/CLAUDE.md`) en `mode="recalibration"`, dans `RecalibrationModal` (une
`UiModal`). Le `previewId` sait qu'il s'agit d'un remplacement, le commit repasse
par la route de commit normale.

**Un seul déclencheur (2026-08-05)** : le bouton **« Redéfinir les bornes » de
`MaquetteBar`** (3e barre — le slot CTA de la doc-bar est pris par « Enregistrer »
en maquette). MaquetteView câble `useRecalibration({ docId, borderShift: limBorderShift })`
+ `onRecalCommitted` (finishCommit → fetchDocuments → reloadDocument → load) ;
le rapport s'affiche en carte flottante fermable. Barré si le `.odt` d'origine
n'est pas conservé (`recalibratable` = `doc.hasSource`). L'ancien second
déclencheur « Redéfinir le liminaire » (section Liminaire de `ConfigView`) a
disparu avec l'écran — `borderShift` reste à 0 (plus d'UI étendre/exclure).

**Avertissement de recalibrage** (`bornesChanged`, `useCalibration`) : porte sur
les bornes **ET** les niveaux forcés (un override change aussi l'arbre → analyses
à relancer). Comparé à l'état en base et au niveau d'origine du titre — un réglage
ramené à sa valeur ne compte pas, pour ne pas user la mise en garde.

- **Niveaux de titre démotés** : la calibration ne différencie plus par défaut
  que liminaire / contenu / partie finale. Le réglage manuel −/+ reste dispo mais
  **replié** sous « réglages avancés » (`showLevels`).
- **`hasSource` (+ `sourceSizeBytes`)** dit si le `.odt` est conservé : le bouton
  est **barré d'avance** sur un document importé avant `DocumentSource`. Ne pas
  confondre avec `sourceFilename` (le NOM du fichier, toujours rempli). Le 404 du
  backend reste le filet ; `recalibratable` vaut `true` tant que le registre
  n'est pas chargé (pas de clignotement).
- **Le rapport (`RecalibrationReport`) reste affiché** en en-tête, pas en toast :
  une relecture perdue doit pouvoir se lire et se refaire. `error` s'il y a des
  perdues, `info` sinon. Le backend le rend à CHAQUE `replace`.
- Après commit : `reloadDocument` (injecté) rafraîchit `trame`/`data` (ids de
  nœuds regénérés) ET `load(id)` recharge la typologie (la ventilation change).
  Le store d'analyse n'est pas touché.
- **Les stats se lisent dans `useRegistry`**, pas dans un appel dédié :
  `GET /documents/:id` ne les porte pas, et la liste est déjà chargée pour l'aside.

## Styles, modèles, règles par section

`GET /documents/:id/typology` sert inventaire + suggestions + décisions prises ;
`GET /rules` les règles. **Les suggestions pré-remplissent mais ne sont
persistées qu'à l'enregistrement** : ce qu'on voit est une proposition.

- **`AnalyseBlock` en mode `bare`** : la prop `bare` pose `.split--bare`
  (`analyse.css`) — le `main` perd fond/cadre et n'est plus centré, c'est la
  colonne étroite qui porte SA bordure (card autonome). Le mode normal veut
  l'inverse (asides sans bordure propre) : le travers qu'on évitait ici était un
  double trait cadre + séparateur. Voir `../analyse/CLAUDE.md` pour `AnalyseBlock`.
- **Répartition main/aside** : le `main` porte la **table des styles** (rôle +
  éligibilité par ligne) PUIS les **modèles inlinés**, discrets (une ligne de
  signatures, pas une card). L'aside porte l'aperçu. Changer un rôle recompose
  les modèles dans le même tick — d'où leur présence côté styles.
- **Ordre des styles = ordre d'apparition** (`firstIndex`, cf. backend
  `inventory.ts`), pas par fréquence. Repli sur le poids/count pour les documents
  importés avant `firstIndex` (styleInventory figé ; un recalibrage le repeuple).
- **Modèles inlinés** : le rôle `corps` ne porte jamais son `×N`
  (`../../script/shapes.js`) — remplissage attendu, décompte = bruit.
- **Éligibilité en ligne (plus d'encart)** : chaque ligne de chapitrage porte sa
  case **« exigé »** (par style) et sa puce de **succession** (paire de styles
  voisins). Marquer l'un OU l'autre **matérialise** au vol le jeu du niveau
  (`byDepth[depth]`, copie du défaut ; cf. `ensureDepth`) et le **purge** dès que
  les deux tableaux redeviennent vides — sinon un jeu fantôme étiquetterait le
  dashboard par niveau. Le **socle « Règles par défaut »** (minChars,
  annotations, rôles, tableau) reste, lui, dans un `RuleSetForm` en bas d'écran.
- **Surlignages + Non situés en bas** : section globale des surlignages (par
  couleur, `HIGHLIGHT_ROLES`) ; les styles « Non situés » (paragraphes vides :
  filets, ornements — ni nœuds, ni modèles, ni règles) juste dessous, à typer eux
  aussi. Ils sortent de la boucle des sections (`useTypologyConfig.unzonedStyles`).

`DocumentLayout` charge `settled` à part (`provide('typologySettled')`) ;
`AnomaliesBlock` s'en sert pour renvoyer ici. Défaut `true` (« présumé arbitré »)
pour ne pas faire clignoter un renvoi avant de savoir.

### Le tableau des styles

Rangé **dans l'ordre du livre** (`../../script/zones.js`) et non par fréquence
brute : un style se lit d'abord par où il vit (« Dédicace » n'est pas rare, il
est liminaire). Chaque zone est SA section, mais l'ordre/regroupement vient de
`zones.js`. Trois points :
- chaque style n'apparaît **qu'une fois**, dans sa zone dominante — la ligne
  porte le `v-model` du rôle, un doublon donnerait deux contrôles pour une
  décision. Colonnes : style · (succession) · rôle · (exigé) ; l'extrait, les
  usages et `StackedBar` retirés (bruit face au rôle), texte non sélectionnable ;
- section **« Non situés »** pour les styles que la ventilation ne place nulle
  part (paragraphes vides, `sum(byZone) <= count` côté backend) ;
- **fallback plat** si `byZone` absent (document importé avant la ventilation) —
  une recalibration le ventile. Tout empiler dans « Non situés » serait un
  mensonge (ces styles ont une zone, on ne la connaît pas).

### Modèles de structure

`useStructureShapes.js` + `../../script/shapes.js`, alimentés par
`GET /documents/:id/structure-shapes` : formes récurrentes par niveau. Le backend
rend des **styles**, la traduction en rôles se fait ici contre la typologie **en
cours d'édition** — changer un rôle recompose les motifs dans le même tick, sans
aller-retour (cf. `../../../../backend/CLAUDE.md`). Trois pièges :
- un nœud **sans texte n'a pas de forme**, jamais proposé comme modèle (« vide »
  est la forme la plus fréquente à tous les niveaux — la promouvoir = proposer
  « un chapitre ne doit rien contenir ») ;
- les pourcentages portent sur les nœuds **rédigés**, pas le total ;
- le chargement des modèles est **détaché** (pas d'`await` dans `load()`) : son
  échec ne doit pas masquer la typologie, objet de l'écran.

### Règles d'éligibilité

`GET`/`PUT /documents/:id/rules`. Indicatives — « Valider » reste actif quoi
qu'il arrive, seul le compte de conformes du dashboard en dépend (backend pour le
pourquoi chiffré). Un **jeu par niveau** (`RuleSet`, cf. backend `rules.ts`) —
deux voies d'édition, plus d'encart « propres à ce niveau » :
- **par ligne dans la table** (chapitrage) : case « exigé » → `requiresStyles`
  (style NOMMÉ, pas un rôle), puce → `requiresAdjacency` (paire ordonnée). Les
  deux passent par `toggleRequireStyle`/`toggleAdjacency` du composable, qui
  matérialise/purge `byDepth[depth]` (cf. `ensureDepth`/`pruneDepth`) ;
- **le socle « Règles par défaut »** (`RuleSetForm.vue`, bas d'écran) édite
  `rules.default` : minChars, annotations, `requiresRoles`, `requiresTable`. Il
  **mute son `ruleSet` en place** (le parent détient l'objet réactif) et porte son
  brouillon de seuil. Il ne touche PAS `requiresStyles`/`requiresAdjacency` — ces
  deux-là ne se règlent qu'en ligne, par niveau ;
- `save()` sérialise par `JSON.parse(JSON.stringify(rules))` : `rules` est un
  proxy réactif **imbriqué**, un spread de surface enverrait des proxies ;
- `byDepth` **remplace** `default` (ne le complète pas) : matérialiser un niveau
  copie donc minChars/annotations du défaut — attention à la dérive si le défaut
  change ensuite (édge case documenté, jeu purgé sitôt les deux tableaux vides) ;
- vocabulaires fermés (`STYLE_ROLES`, `REQUIRABLE_ROLES`) dans
  `../../script/typology.js`, alignés sur le backend. Les noms de STYLE, eux, sont
  ouverts (propres au document) — `requiresStyles`/`requiresAdjacency` non validés
  contre une liste fermée.
