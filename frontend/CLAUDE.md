# Scribe — frontend

Éditeur de texte Vue destiné à l'édition print (rendu paginé, WYSIWYG). Stack :
Vue 3 (`<script setup>`) + Vite, Quill 2 (édition), Paged.js / `pagedjs` (pagination
à la manière d'un livre imprimé), PrimeIcons.

Fait partie du monorepo `scribe` (voir `../CLAUDE.md` pour les règles générales
et l'organisation frontend/backend). Le backend NestJS (`../backend`) expose
désormais un registre de documents (Postgres/Prisma) — voir `../CLAUDE.md`
pour les deux chemins de données qui coexistent (registre backend vs fichiers
statiques `Marvarid/` historiques).

## Vues — routing (`vue-router`)

`App.vue` est un shell (menu + `<router-view>`), plus de toggle manuel entre
vues. Routes (`src/router/index.js`) :
- `/` — `HomeView.vue` : porte d'entrée. La liste des manuscrits (`DocumentList`)
  + le bouton d'import, centrés. **Pas de redirection** vers le dernier document :
  `/` reste une destination réelle (icône « Accueil » de la topbar).
- `/import` — `ImportView.vue` : `ImportCalibration` en plein écran, hors
  `DocumentLayout` (il n'y a pas encore de document, donc rien à mettre dans une
  aside). **Garde de route** : le preview ne vivant qu'en mémoire des deux côtés
  (`useRegistry`, et la `Map` du backend), entrer par l'URL ou recharger renvoie
  à l'accueil plutôt que d'afficher un écran mort. Le commit navigue vers la
  config du document créé.
- `/documents/:id` — `DocumentLayout.vue` (fetch unique de `GET
  /api/documents/:id`, fournit `trame`/`data` via `provide`/`inject` aux
  routes enfants) → `AnalyseView.vue` : dashboard d'analyse en grille de cards
  (`src/components/analyse/*Card.vue`, état partagé via
  `src/composables/useAnalyse.js` — `provideAnalyse()` dans la vue,
  `useAnalyse()` dans les cards). Un bloc = `AnalyseBlock.vue` (cadre commun :
  révélation, spinner, états vide/erreur, colonnes 2/3 · 1/3). Une étape de
  `DASHBOARD_STEPS` peut avoir **`needs: null`** — dérivée du seul contenu du
  document (complétude), donc jamais « indisponible » ni en attente du NLP ;
  `stepStatus` la traite à part (sans la garde, `running === step.needs`
  serait vrai dès que rien ne tourne). `AnomaliesBlock.vue` est le cas mixte à
  connaître : son graphe de complétude est gratuit et s'affiche tout de suite,
  pendant que sa table des doublons attend le NLP dans la même colonne.
  L'ancien écran "Chapitrage"
  (`DocumentIndex.vue`) a été supprimé — ses stats (sous-titres, mots)
  vivent dans l'infobulle des nœuds de `StructureView`.
- `/documents/:id/styles` — `StylesView.vue` : la configuration du document.
  Voir « Typologie des styles » plus bas — l'écran a sa propre section, il n'a
  rien à faire dans du routing.
- `/documents/:id/axe/:axeId` — `EditorView.vue` → `FolioComposer`/`Scroll`
  (Scroll toujours désactivé, `v-if="false === true"`).

`/api` est proxifié vers le backend Nest par `vite.config.js`
(`server.proxy`) — dev uniquement, rien de prévu encore pour la prod (le
frontend buildé n'a pas de backend à contacter en statique). Le proxy vise le
port 3000 : c'est le **backend**, pas Vite (qui sert sur 5173) — la confusion
fait chercher un frontend là où répond Nest.

### Registre et aside contextuelle

Le registre n'a plus d'écran à lui : il vit dans l'aside, **là et seulement là
où l'arbre des nœuds ne sert à rien** — c'est-à-dire sur la config, le seul
écran qui puisse reconstruire cet arbre. Partout ailleurs (dashboard, éditeur)
l'aside porte `StructureView`. L'arbitrage tient dans `asideMode`
(`DocumentLayout`) ; `DocumentBar` reçoit `asideLabel` parce que son chevron ne
peut pas dire « Replier la structure » sur un écran où il replie le registre.

- **`useRegistry.js` est un état de MODULE, pas d'instance** : la liste et le
  bouton d'import sont montés à deux endroits (accueil, aside). Deux copies
  divergeraient dès le premier import — celle qui n'a pas déclenché l'upload
  garderait sa liste d'avant. Même raison pour `pendingPreview`, qui vit là
  plutôt que dans l'URL (l'outline fait des milliers d'entrées).
- **`DocumentList` fait son propre fetch** (`onMounted`), au lieu de le laisser
  à ses parents : le câbler dans chacun d'eux, c'est l'oublier au troisième.
  L'état étant de module, deux montages partagent la même réponse.
- **Le clic ne décide pas de la destination, le parent si** — même philosophie
  que `select()` : depuis l'accueil on entre par le dashboard (on vient lire),
  depuis l'aside on reste sur la config (on compare des configurations).
- **En rail, la liste disparaît** au profit d'une seule icône qui rouvre
  l'aside : 42 px ne rendent pas un titre de manuscrit lisible.
- `DocumentLayout` ne bloque plus son rendu entier sur `v-if="trame && data"` —
  seuls `DocumentBar` et le `<router-view>` attendent. Sinon changer de document
  depuis l'aside ferait disparaître l'aside elle-même, le temps du fetch.
- Les stats du document (axes/blocs/articles/mots) et sa suppression ne sont
  PAS dans la liste : elles ont suivi vers la config. Une action irréversible
  au survol d'une ligne, c'est une suppression par inadvertance.

## Typologie des styles — `StylesView.vue`

`/documents/:id/styles`. Liste les styles relevés dans le `.odt` (usages,
extrait, rôle) et les couleurs de surlignage, un appel unique à
`GET /documents/:id/typology` servant inventaire + suggestions + décisions
déjà prises.

**Les suggestions pré-remplissent le formulaire mais ne sont pas persistées**
tant que l'utilisateur n'a pas enregistré (cf. `backend/CLAUDE.md`) : ce qu'il
voit est une proposition, pas une décision qu'il n'a pas prise. Un document
importé avant la colonne `styleInventory` affiche un état vide explicite — une
recalibration le remplit si son `.odt` a été conservé (`DocumentSource`), un
réimport sinon.

`DocumentLayout` charge `settled` à part (`provide('typologySettled')`) ;
`AnomaliesBlock` s'en sert pour renvoyer vers cet écran. Le défaut est `true`
(« présumé arbitré ») pour ne pas faire clignoter un renvoi avant de savoir.

### Le tableau des styles

Rangé **dans l'ordre du livre** (`src/script/zones.js`) — Liminaire, Axes,
Blocs sémantiques, Articles, Partie finale — et non par fréquence brute : un
style se lit d'abord par où il vit (« Dédicace » n'est pas rare, il est
liminaire ; « Voir » n'est pas fréquent, il est d'article). Trois points :
- chaque style n'apparaît **qu'une fois**, dans sa zone dominante — la ligne
  porte le `v-model` du rôle, un style dupliqué donnerait deux contrôles pour
  une seule décision. Sa répartition réelle se lit dans la barre
  (`StackedBar`), pas dans la duplication ;
- section **« Non situés »** pour les styles que la ventilation ne place nulle
  part : ce sont les paragraphes vides (filets, ornements), comptés par
  l'inventaire mais jamais promus en nœuds (cf. `sum(byZone) <= count` dans
  `../backend/CLAUDE.md`) ;
- **fallback plat** si `byZone` est absent — document importé avant la
  ventilation. Le `.odt` est désormais conservé (`DocumentSource`, cf.
  `../backend/CLAUDE.md`), donc une **recalibration** le ventile ; seuls les
  documents importés avant cette table exigent encore un réimport. Tout empiler
  dans « Non situés » serait un mensonge par omission (ces styles ont une zone,
  on ne la connaît pas).

### Modèles de structure

`useStructureShapes.js` + `script/shapes.js`, alimentés par
`GET /documents/:id/structure-shapes` : les formes récurrentes par niveau. Le
backend rend des **styles**, la traduction en rôles se fait ici contre la
typologie **en cours d'édition** — changer un rôle recompose les motifs dans le
même tick, sans aller-retour (c'est la raison d'être de ce partage ; voir
`../backend/CLAUDE.md`). Trois pièges :
- un nœud **sans texte n'a pas de forme** et n'est jamais proposé comme modèle.
  Sur le témoin, « vide » est la forme la PLUS fréquente à tous les niveaux
  (228 articles sur 818) : la promouvoir reviendrait à proposer « un chapitre
  ne doit rien contenir » comme règle. Comptée à part, jamais modélisée ;
- les pourcentages portent sur les nœuds **rédigés**, pas sur le total —
  rapporté au total, un modèle qui régit tout ce qui est écrit passerait pour
  marginal ;
- le chargement des modèles est **détaché** du reste (pas d'`await` dans
  `load()`, erreur propre) : c'est un complément, son échec ne doit pas masquer
  la typologie, qui est l'objet de l'écran.

### Règles d'éligibilité

`GET`/`PUT /documents/:id/rules`, second appel de l'écran. Elles sont
indicatives — le bouton « Valider » d'un chapitre reste actif quoi qu'il
arrive, seul le compte de conformes du dashboard en dépend (voir
`backend/CLAUDE.md` pour le pourquoi chiffré). Un **onglet par niveau** (Défaut
/ Axes / Blocs / Articles), le formulaire d'un jeu étant `RuleSetForm.vue`,
réutilisé tel quel par onglet :
- `RuleSetForm` **mute son `ruleSet` en place**, délibérément : le parent
  détient l'objet réactif complet, et remonter chaque case par
  `update:modelValue` recréerait des objets pour rien alors qu'il y a jusqu'à
  quatre jeux vivants. Il porte aussi son propre brouillon de seuil — un draft
  partagé afficherait le seuil d'un niveau dans le champ d'un autre ;
- cocher « des règles propres à ce niveau » part d'une **copie du défaut**, pas
  d'un jeu vide : on règle par écart au défaut, et partir de rien ferait passer
  le niveau pour « sans aucune exigence » le temps de tout recocher ;
- une **pastille** sur l'onglet signale un niveau réglé — sinon il faut ouvrir
  les quatre pour savoir lesquels le sont ;
- `save()` sérialise par `JSON.parse(JSON.stringify(rules))` : `rules` est un
  proxy réactif **imbriqué**, un spread de surface enverrait des proxies ;
- les vocabulaires fermés (`STYLE_ROLES`, `REQUIRABLE_ROLES`) et les onglets
  vivent dans `src/script/typology.js` — partagés entre la vue et
  `RuleSetForm`, alignés sur le backend qui refuse tout rôle hors liste.

## Hiérarchie à profondeur arbitraire

Le backend n'impose plus 3 niveaux fixes axe/bloc/article (voir
`../backend/CLAUDE.md`) — `trame.axes[]` est un arbre récursif
(`{ id, children: [...] }` à n'importe quelle profondeur). Composants qui en
dépendent :
- `FolioComposer.vue` (`sections` computed) — parcours récursif de l'axe
  sélectionné (`walk()`), chaque section porte son `depth` réel (pas figé à
  0/1/2). `paginate.js` (`buildBlocks`) choisit le tag de titre (`h1`..`h6`)
  selon cette profondeur.
- `StructureView.vue` (aside, montée sur le dashboard et l'éditeur — la config
  lui substitue le registre, cf. « Registre et aside contextuelle ») + son
  sous-composant récursif `StructureNode.vue` — accordéon **replié/déplié**
  (prop `expanded` binaire : rail étroit vs arbre repliable, stats en
  infobulle). L'état `expanded` et le chevron qui le pilote vivent désormais
  dans `DocumentBar.vue` (voir ci-dessous), pas dans la sidebar. Le chemin
  vers le nœud courant s'auto-déplie ; compte les descendants récursivement
  (les `stats.mots` du backend sont déjà agrégées). Le clic sur un nœud émet
  `select` — c'est `DocumentLayout` qui décide de l'effet (voir ci-dessous).

## Menus environnants — topbar, `DocumentBar`, scope d'analyse

- **Deux barres empilées, hauteur == largeur du rail** : la topbar globale
  (`App.vue`, `.menu`) et la sidebar repliée partagent le token `--bar-size`
  (`base.css`) — hauteur de barre = largeur de rail, harmonisées par une
  seule variable.
- `DocumentBar.vue` — **seconde topbar** (pleine largeur, sous `.menu`, montée
  par `DocumentLayout`), fond `--c-subbar` (teinte fondue entre topbar et
  sidebar). Contient le chevron de repli (largeur `--bar-size`, aligné
  au-dessus du rail) puis un **fil d'Ariane** : titre du livre → niveaux de
  titres jusqu'au nœud courant (`pathToInAxes`, `src/script/trame.js`,
  partagé avec `StructureView`). Le titre du livre vient de `GET
  /documents/:id` (`content.title`, ajouté côté backend).
- **Validation d'un chapitre** — bouton à droite du fil d'Ariane, monté
  **uniquement en édition et sur un chapitre ouvert** : on valide ce qu'on
  vient de relire, sous les yeux ; le dashboard ne fait que compter. Trois
  états (`Valider` / `Validé` / `Revalider`) ; un chapitre périmé propose de
  revalider et non de dévalider — le texte a changé, l'action utile est de
  relire. `DocumentLayout` détient l'état (`validations`, chargé résolu depuis
  `GET /documents/:id`) et fait les appels ; `DocumentBar` n'émet que
  `toggle-validation`.
- **Effet des liens (sidebar + fil d'Ariane) selon l'état**, arbitré par
  `select()` dans `DocumentLayout` :
  - **Édition** (route `editor`) : navigation vers l'article (`/noeud/:id`) —
    le lien « livre » ramène à la racine analyse.
  - **Analyse** (route `document`) : pose le **scope** (`scopeNodeId`,
    fourni via `provide('analyseScopeNodeId')`) sans naviguer — le nœud
    courant du fil d'Ariane et du surlignage suit ce scope. ⚠️ Câblage seul
    pour l'instant : le recalcul NLP restreint au sous-arbre n'est **pas
    encore branché** (l'analyse reste globale), c'est le chantier suivant.

## Calibration d'import

`ImportCalibration.vue` (montée par `ImportView.vue` sur `/import`, après le
`POST /api/documents/preview` déclenché par `ImportButton`) : liste tous les
titres détectés dans l'ordre du
document, en accordéon (`CalibrationNode.vue`, récursif, replié par défaut,
liseret de couleur par niveau). Deux corrections manuelles avant validation
(`POST /api/documents/preview/:previewId/commit`) :
- **Les deux bornes du livre** : chaque ligne de démarcation entre deux titres
  porte deux poignées, révélées au survol — « Début du contenu » (fin du
  liminaire : page de titre, auteur...) et « Partie finale » (début de la
  table des matières, de l'index...). La première est pré-positionnée sur
  `suggestedStructureStartIndex` (basée sur la table des matières si
  présente) ; la seconde sur `suggestedStructureEndIndex`, **souvent absent**
  — le backend ne suggère une fin que sur le nom du titre, et la plupart des
  manuscrits n'ont pas d'appareil de fin (voir `../backend/CLAUDE.md` pour
  pourquoi le croisement avec la ToC a été abandonné de ce côté-là). Re-cliquer
  la poignée active retire la borne : la partie finale est facultative. Le
  backend refuse `endIndex <= startIndex` (des bornes croisées ne feraient pas
  une erreur mais un livre vide).
- **Niveau par titre** : boutons `−`/`+` (pas de liste déroulante — la
  sémantique axe/bloc/article est propre à Marvarid, pas à l'ODT, cf.
  `../backend/CLAUDE.md`). L'arbre de l'accordéon se recalcule en direct
  quand un niveau change. Un repère "⤓" signale un saut de page forcé
  (`hasPageBreak`) — indice manuel, pas une correction automatique : voir
  `../backend/CLAUDE.md` pour les pistes de déduction automatique
  explorées et abandonnées (table des matières, motif de récurrence).

## Design system — atomic design + Storybook

- **Tokens** : `src/assets/base.css` est la source unique (couleurs, typo
  `--font-ui`/`--font-serif`, échelles `--fs-*`/`--sp-*`, `--radius-*`,
  opacités `--op-*`). Ne pas introduire de couleur/taille en dur dans un
  composant — ajouter un token si besoin.
- **Composants réutilisables** : `src/components/ui/` — atoms (`BaseButton`,
  `BaseChip`, `BaseSelect`, `ScoreBar`, `StackedBar`, `StatItem`, `UiNote`) et
  molecules (`UiCard`, `UiTable`, `ChipGroup`, `TreeRow`). `ScoreBar` montre UNE
  valeur sur une échelle (une progression) ; `StackedBar` montre la
  **répartition** d'un total entre catégories — il ne sait pas ce qu'il peint,
  les couleurs viennent de l'appelant, parce que le choix rampe ordinale vs
  palette catégorielle se décide dans le domaine métier (voir plus bas). Chaque composant a sa story
  colocalisée (`*.stories.js`, CSF3). Le domaine métier (cards d'analyse,
  vues) les consomme et ne garde en scoped que son layout propre.
- **Storybook** (`@storybook/vue3-vite`, config `.storybook/`) :
  `npm run storybook` (port 6006), `npm run build-storybook` (smoke-test,
  sortie `storybook-static/` gitignorée). `preview.js` importe primeicons +
  `base.css` (mêmes tokens et fond que l'app) et installe un **routeur en
  mémoire** : sans lui, tout composant consommant `useRoute()`/`RouterLink`
  (renvoi vers la typologie, ouverture d'un chapitre) ne se monte pas.
- Conventions : radius discrets (tokens, 4 px max), pas de scrollbars
  internes multiples (tronquer les listes, `UiTable scroll` en dernier
  recours), transitions compositor-only (opacity/transform), sans-serif
  partout dans l'UI (`--font-serif` réservé au contenu du manuscrit),
  liseret de couleur uniquement s'il est sémantique (niveaux de calibration).
- Hors périmètre : la couche Quill/Folio (éditeur paginé) ne passe pas par
  `ui/` ni Storybook.

### Graphiques — echarts

- **`ui/BaseChart.vue`** est le seul point d'entrée d'Apache ECharts : il
  gère l'instance (init/`dispose` — echarts ne se nettoie pas au retrait du
  DOM), le `ResizeObserver` (echarts mesure son conteneur à l'init et ne se
  réajuste jamais seul) et prend une option echarts complète en prop. Les
  composants métier construisent l'option, pas le graphe.
- **Import modulaire obligatoire** : `echarts/core` + les seuls modules
  utilisés (`echarts.use([...])` dans `BaseChart`). Un
  `import * as echarts from 'echarts'` embarque tous les types de graphes
  (~1 Mo). Ajouter le module d'un nouveau type **là et seulement là**.
- **Les couleurs viennent des tokens, via `script/theme.js` (`cssVar`)** :
  echarts peint dans un `<canvas>`, où un `var(--c-ramp-1)` n'est jamais
  résolu — il faut passer la valeur calculée. C'est le seul usage légitime de
  `getComputedStyle` pour de la couleur ; tout ce qui est rendu en DOM garde
  `var()` en CSS.
- **`--c-status-valide` / `--c-status-perime` sortent de la rampe, exprès** :
  « validé » et « périmé » ne sont pas des paliers de rédaction (comptés en
  mots) mais des décisions humaines. Leur donner une teinte de `--c-ramp-*`
  les ferait lire comme « encore un peu plus rédigé ». Mêmes tokens dans le
  graphe et sur le bouton de `DocumentBar` : un chapitre vert dans la barre
  est un chapitre vert dans le graphe.
- **`--c-ramp-1..4` (rampe ordinale) vs `--c-cat-1..8` (catégorielle)** : une
  échelle dont l'ordre porte le sens (complétude : vide → ébauche → partiel →
  rédigé) prend la rampe d'une seule teinte, clair → foncé — la progression
  se lit alors dans la couleur. `--c-cat-*` encode une identité (communautés
  du réseau lexical), où l'ordre est arbitraire. Ne pas confondre : colorier
  une échelle ordonnée en catégoriel détruit l'information d'ordre.
  Les valeurs de `--c-ramp-*` sont **calculées et validées**, pas choisies à
  l'œil (cf. le commentaire dans `base.css`) — revalider avant retouche.
- Piège de vérification : dans un navigateur headless sans
  `requestAnimationFrame`, les barres d'un graphe echarts restent figées à
  `width: 0` (premier frame de l'animation d'entrée) — le graphe **paraît**
  vide alors que la liste d'affichage zrender est correcte. Ce n'est pas un
  bug du composant ; sonder `chart.getZr().storage.getDisplayList()` plutôt
  que les pixels du canvas.

## Vocabulaire — Quill vs Folio

Deux couches, deux mots, à ne jamais mélanger :

- **Quill** : l'éditeur WYSIWYG flottant (`QuillBlock.vue`). Invisible en
  propre — il n'édite qu'UN fragment à la fois et se superpose visuellement
  au rendu paginé pendant l'édition (voir `syncQuill.js`). Ce n'est jamais
  ce que l'utilisateur regarde en lecture.
- **Folio** : la couche de rendu paginé (implémentée avec Paged.js), celle
  qu'on regarde. "Paged"/"Paged.js" désigne la librairie sous-jacente ;
  **"Folio" est le mot à utiliser en code et en discussion** pour tout ce qui
  concerne cette couche. Composants : `FolioComposer.vue` (orchestrateur),
  `Folia.vue` (l'ensemble scalé, plusieurs pages), `Folio.vue` (une page
  physique unique, recto/verso).

Un changement touche Quill (comportement d'édition, clavier, contenu du
fragment) XOR Folio (mise en page, pagination, rendu visuel des pages) —
identifier laquelle des deux est en cause avant de chercher le bug évite de
fouiller le mauvais fichier.

## Glossaire — à lire avant de toucher à l'édition

Trois notions distinctes, systématiquement confondues si on ne les note pas :

- **Paragraphe** : une entrée de `article.texte[]`. L'unité sémantique réelle,
  celle que l'utilisateur pense éditer.
- **Bloc** (`blockId`) : la représentation d'UN paragraphe avant pagination.
  Id déterministe et positionnel : `${articleId}__texte__${index}` (construit
  dans `buildBlock()`, `src/script/paginate.js`). Recalculé à chaque
  `refresh()` à partir de l'état courant de `article.texte`.
- **Fragment (de pagination)** (`fragId` = `${blockId}::${ordinal}`) : un
  MORCEAU de bloc, quand Paged.js coupe un paragraphe entre deux pages.
  L'édition se fait fragment par fragment : Quill ne charge que le texte
  d'UN fragment à la fois (`fragments.getFragment(fragId)`). `setFragment()`
  recolle les fragments d'un même bloc (frontière de pagination, invisible
  pour l'utilisateur) avant de traiter les vraies frontières de paragraphe
  (celles que Quill introduit via plusieurs `<p>`).

Conséquence directe : atteindre la fin du texte chargé dans Quill ne veut PAS
dire qu'on est à la fin du paragraphe — seulement à la fin de CE fragment. Voir
`isFirstFragment`/`isLastFragment` (`src/script/fragment.js:getFragmentPosition`)
qui distinguent "bord du paragraphe" de "coupure de page interne".

## Architecture

Flux : `FolioComposer.vue` pagine (`paginate.js` → Paged.js) → construit un
`registry` (modèle de données par bloc) et une `fragments` API (registre de
fragments) → délègue l'édition interactive à `useFragmentEditor`.

Fichiers clés :
- `src/components/FolioComposer.vue` — orchestrateur : cycle de pagination
  (`refresh`/`scheduleReflow`), instancie les composables, câble le template.
- `src/components/QuillBlock.vue` — Quill flottant, un fragment à la fois ;
  gère Entrée (split), Backspace/Delete (merge), gated par
  `isFirstFragment`/`isLastFragment`.
- `src/composables/useFragmentEditor.js` — cycle de vie de l'édition par
  fragment (activer/fermer/commit/merge) et sélection cross-fragment
  (`crossSelection`, voir "Pièges connus"). Voir `src/composables/CLAUDE.md`.
- `src/composables/useFakeCaret.js`, `useFloatingToolbar.js` — le DOM paginé
  (`v-html`) n'est pas éditable ; un faux curseur/sélection et une toolbar
  flottante sont positionnés par-dessus et mirroirés depuis Quill.
- `src/script/paginate.js` — appelle Paged.js, construit les blocs à partir de
  `article.texte`.
- `src/script/registry.js` — logique pure sur le modèle de données :
  `applyEdit` (HTML → paragraphes), `mergeNext`/`mergePrev` (retournent
  `{ index, cursor }`, le point de jonction pour repositionner le curseur),
  `deleteRange` (supprime/remplace une sélection à cheval sur un ou
  plusieurs paragraphes, `keepSplit` distingue Entrée du reste).
- `src/script/fragment.js` — registre de fragments : `getFragment`/
  `getBlockId`/`setFragment` (glue), `locateIndex` (index global → bon
  fragment), `getFragmentPosition` (ordinal/total, vrai bord vs coupure interne),
  `globalIndex` (inverse de `locateIndex` : fragId + index local → index
  global dans le paragraphe complet).
- `src/script/liveEdit.js` — maths caret/sélection sur DOM (index de
  caractère ↔ rect pixel), via `TreeWalker` sur les nœuds texte.
  `getRangeRects` calcule les rects d'une plage de texte scopée à UN seul
  élément (utilisé fragment par fragment pour l'overlay d'une sélection
  cross-fragment, plutôt qu'une Range native enjambant plusieurs éléments).
- `src/script/syncQuill.js` — positionne/scale le Quill flottant pour qu'il
  coïncide visuellement avec le fragment DOM sous-jacent.

## Pièges connus

- **Boucle de rétroaction Folia** : `Folia.vue` calcule son échelle depuis
  `containerRef.clientWidth/clientHeight`. Si un ancêtre a une hauteur (ou
  largeur) **indéfinie**, le `height: 100%` de `.spread-scaler` se résout en
  `auto` : Folia mesure alors sa propre taille scalée et la remultiplie par
  `0.92` à chaque passage du `ResizeObserver` — décroissance géométrique
  jusqu'à disparition des folios. Les deux façons de casser la chaîne, déjà
  rencontrées : un `flex: 1` sur un enfant dont le parent n'est PAS un flex
  container (ignoré → hauteur de contenu), et un item flex sans `min-width: 0`
  (son `min-width: auto` le fait grandir jusqu'à la largeur intrinsèque de la
  rangée de folios au lieu de déborder). Tout ancêtre de `Folia` doit avoir une
  taille définie **indépendante de son contenu**. Verrouillé par
  `e2e/scrollbar.spec.js`.
- **Piège du remount Vue** : fermer l'éditeur (`closeEditor()`) puis le
  rouvrir (`activateFragment()`) dans le MÊME tick synchrone ne démonte
  jamais réellement `<QuillBlock>` si le nouveau `fragId`/`:key` finit par
  être identique à l'ancien (ex: fusionner avec le paragraphe suivant garde
  le même index) — Vue ne voit qu'un état inchangé au flush. Résultat : le
  Quill flottant garde son contenu périmé. **Toujours `await nextTick()`**
  entre une fermeture et une réactivation qui peut retomber sur le même id
  (voir `settleClose()` dans `useFragmentEditor.js`).
- Le curseur de fusion (`registry.js`, `merged.length`) est une longueur de
  chaîne HTML brute, pas un compte de caractères visibles — fiable pour du
  texte simple, pas garanti si un paragraphe contient du formatage inline
  (`<strong>`, `<em>`...). Pas encore de bug connu là-dessus, mais à garder
  en tête si un paragraphe fusionné se retrouve mal positionné.
- Backspace/Delete avec un curseur **collapsé** en bord de fragment ne
  fusionne toujours qu'aux vrais bords de paragraphe (`isFirstFragment`/
  `isLastFragment` dans `QuillBlock.vue`) : à une coupure de page interne,
  c'est un no-op sûr. Cette limitation-là reste — un seul Quill est monté à
  la fois, il ne "voit" que son propre fragment.
- En revanche, une **sélection** (drag) qui enjambe plusieurs fragments —
  coupure de page interne à un paragraphe OU vraie frontière entre deux
  paragraphes — est gérée depuis peu par `useFragmentEditor.js`
  (`crossSelection` / `activateCrossSelection` / `handleCrossSelectionKeydown`) :
  aucun Quill ne représente cette sélection, la suppression/fusion/split
  (Entrée) se fait directement sur `article.texte` via `registry.deleteRange`,
  puis l'éditeur se rouvre normalement au point de jonction. L'overlay
  (`getRangeRects`, `liveEdit.js`) et l'interaction clavier n'ont pu être
  vérifiés qu'au niveau logique/tests — pas de vérification navigateur
  possible ici, à confirmer manuellement avant de considérer le sujet clos.

## Tests

- Vitest + jsdom. `npm test` (run), `npm run test:watch`. Config :
  `vitest.config.js`. Tests colocalisés `*.test.js` à côté du fichier testé.
- Portée actuelle : logique pure dans `src/script/` (`registry.js`,
  `fragment.js`) — pas de dépendance DOM/Quill/Paged.js réelle. C'est
  volontaire : ça permet de verrouiller les règles de fusion/split sans
  mocker Quill ou Paged.js.
- **Playwright** (`npm run test:e2e`, config `playwright.config.js`, specs dans
  `e2e/`) — lance son propre Vite sur le port 5183. Portée : ce que jsdom ne
  sait pas rendre, c'est-à-dire le **layout réel** (hauteurs, débordements,
  échelle Folia). Le backend n'est jamais requis : `e2e/fixtures.js` mocke
  `GET /api/documents/:id` via `page.route` et neutralise les appels d'analyse.
  - `pagination.spec.js` — plancher de pages + non-débordement du contenu d'un
    folio.
  - `scrollbar.spec.js` — géométrie de `CustomScrollbar` (tracks dans le
    viewport, thumb dans sa track, affichage conditionnel, flèches) et
    **non-régression de la boucle de rétroaction Folia** (voir "Pièges
    connus").
- Pas encore de tests d'intégration DOM/Quill (Vue Test Utils) — **prévu à
  terme, pas encore en place**. Tant que ça n'existe pas, toute interaction
  clavier/souris dans `QuillBlock.vue`/`FolioComposer.vue` doit être vérifiée
  manuellement en navigateur avant d'être considérée comme corrigée (cf.
  section précédente).

## Commandes

Depuis `frontend/` :
```
npm run dev         # serveur de dev Vite
npm test             # vitest run
npm run test:watch   # vitest en mode watch
npm run build         # build de prod (supprimer dist/ après une build de vérif)
```
Depuis la racine du monorepo, équivalent via `--workspace frontend` (voir
`../CLAUDE.md`), ou `npm run dev` à la racine pour lancer frontend + backend
ensemble.

## Conventions de code

- Logique pure et sans état Vue → `src/script/*.js`. Logique avec état/cycle
  de vie Vue (`ref`, `computed`, composition d'autres composables) →
  `src/composables/use*.js`. Composants → `src/components/*.vue`.
- Éviter la duplication en isolant le protocole commun dans une fonction
  partagée plutôt qu'en dupliquant deux variantes quasi identiques (ex :
  `mergeFragment(direction)` partagé par merge-next/merge-prev plutôt que
  deux fonctions copiées-collées).
- Commentaires en français, uniquement quand le "pourquoi" n'est pas évident
  (contrainte cachée, contournement, comportement surprenant). Ne pas
  commenter ce que le code dit déjà.
- Ne pas créer de fichiers `*.md` de documentation/plan sauf demande explicite.
