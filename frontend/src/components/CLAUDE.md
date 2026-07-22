# Composants — `components/`

Composants à plat (vues, registre, menus, calibration, éditeur) + sous-dossiers
thématiques. Atoms/molecules réutilisables : `ui/`. Détails par sous-arbre :

- **`config/`** — écran de configuration (typologie, styles, modèles, règles,
  recalibration). Voir `config/CLAUDE.md`.
- **`analyse/`** — dashboard de `/documents/:id` (cards, `AnalyseBlock`, echarts).
  Voir `analyse/CLAUDE.md`.
- **`ui/`** — design system atomique + Storybook + `BaseChart`. Voir `ui/CLAUDE.md`.
- **`liminaire/`** — typage/composition des pages liminaires. Voir
  `liminaire/CLAUDE.md`.

Routing et rôle de chaque vue : `../router/CLAUDE.md`. Moteur d'édition (logique
pure) : `../script/CLAUDE.md`. Composables : `../composables/CLAUDE.md`.

## Registre et aside contextuelle

Le registre n'a plus d'écran à lui : il vit dans l'aside, **là et seulement là où
l'arbre des nœuds ne sert à rien** — la config, le seul écran qui puisse
reconstruire cet arbre. Partout ailleurs (dashboard, éditeur) l'aside porte
`StructureView`. L'arbitrage tient dans `asideMode` (`DocumentLayout`) ;
`DocumentBar` reçoit `asideLabel` (son chevron ne peut pas dire « Replier la
structure » là où il replie le registre).

- **`../composables/useRegistry.js` est un état de MODULE, pas d'instance** : la
  liste et le bouton d'import sont montés à deux endroits (accueil, aside). Deux
  copies divergeraient au premier import. Même raison pour `pendingPreview`, qui
  vit là plutôt que dans l'URL (l'outline fait des milliers d'entrées).
- **`DocumentList` fait son propre fetch** (`onMounted`) : le câbler dans chaque
  parent, c'est l'oublier au troisième. L'état étant de module, deux montages
  partagent la même réponse.
- **Le clic ne décide pas de la destination, le parent si** (comme `select()`) :
  depuis l'accueil on entre par le dashboard (on vient lire), depuis l'aside on
  reste sur la config (on compare des configurations).
- **En rail, la liste disparaît** au profit d'une icône qui rouvre l'aside :
  42 px ne rendent pas un titre de manuscrit lisible.
- `DocumentLayout` ne bloque plus son rendu entier sur `v-if="trame && data"` —
  seuls `DocumentBar` et le `<router-view>` attendent, sinon changer de document
  depuis l'aside la ferait disparaître le temps du fetch. **Corollaire, piège déjà
  refermé une fois** : ce `v-if` fait que vider `trame`/`data` DÉMONTE la vue
  enfant. `loadDocument(id, { silent })` existe pour ça — un rechargement en place
  (après recalibration) ne vide rien, sans quoi il détruit l'écran qui l'a demandé.
  Le vidage reste le défaut pour un vrai changement de document.
- Une ligne = **deux boutons frères** (titre + méta, puis poubelle à droite) —
  imbriquer la poubelle dans le bouton de sélection serait un bouton dans un
  bouton (HTML invalide, clic qui remonte). Poubelle **absente au repos, révélée
  au survol**, rouge quand on la vise.
- **La suppression est offerte à deux endroits** (la ligne, l'écran de config) :
  `confirmAndDelete` vit dans `useRegistry`, pas dans les vues (deux formulations
  divergeraient). `DocumentList` supprime et **émet `deleted`** ; le parent décide
  de la suite (supprimer le document étudié quitte l'écran, un autre raccourcit la
  liste). Les stats du document restent hors de la liste : dans l'en-tête de config.

## Structure — `StructureView` / `StructureNode`

Aside montée sur le dashboard et l'éditeur (la config lui substitue le registre).
Arbre récursif de `trame.axes[]` (profondeur arbitraire, cf.
`../script/trame.js`) : `StructureNode.vue` en accordéon **replié/déplié** (prop
`expanded` binaire : rail étroit vs arbre repliable, stats en infobulle). L'état
`expanded` et le chevron vivent dans `DocumentBar.vue`, pas dans la sidebar. Le
chemin vers le nœud courant s'auto-déplie ; compte les descendants récursivement
(`stats.mots` déjà agrégées côté backend). Le clic sur un nœud émet `select` —
`DocumentLayout` décide de l'effet (voir menus).

## Menus — topbar, `DocumentBar`, scope d'analyse

- **Deux barres empilées, hauteur == largeur du rail** : la topbar globale
  (`App.vue`, `.menu`) et la sidebar repliée partagent le token `--bar-size`
  (`base.css`).
- `DocumentBar.vue` — **seconde topbar** (pleine largeur, sous `.menu`, montée par
  `DocumentLayout`), fond `--c-subbar`. Chevron de repli (largeur `--bar-size`)
  puis **fil d'Ariane** : titre du livre → niveaux jusqu'au nœud courant
  (`pathToInAxes`, `../script/trame.js`, partagé avec `StructureView`). Le titre
  vient de `GET /documents/:id` (`content.title`).
- **Validation d'un chapitre** — bouton à droite du fil d'Ariane, monté
  **uniquement en édition et sur un chapitre ouvert** : on valide ce qu'on vient
  de relire, le dashboard ne fait que compter. Trois états (`Valider`/`Validé`/
  `Revalider`) ; un chapitre périmé propose de **revalider** (le texte a changé,
  l'action utile est de relire), pas de dévalider. `DocumentLayout` détient l'état
  (`validations`, résolu depuis `GET /documents/:id`) et fait les appels ;
  `DocumentBar` n'émet que `toggle-validation`.
- **Effet des liens (sidebar + fil d'Ariane) selon l'état**, arbitré par
  `select()` dans `DocumentLayout` :
  - **Édition** (route `editor`) : navigation vers l'article (`/noeud/:id`) ; le
    lien « livre » ramène à la racine analyse.
  - **Analyse** (route `document`) : pose le **scope** (`scopeNodeId`, fourni via
    `provide('analyseScopeNodeId')`) sans naviguer. ⚠️ Câblage seul : le recalcul
    NLP restreint au sous-arbre n'est **pas encore branché** (l'analyse reste
    globale), chantier suivant.

## Calibration d'import — `ImportCalibration` / `CalibrationNode`

`ImportCalibration.vue` est **montée à deux endroits** : par `ImportView.vue` sur
`/import` (après `POST /api/documents/preview`), et par `config/ConfigView.vue` en
`mode="recalibration"` dans une modale. Le `previewId` porte la différence de
destination ; le `mode` arbitre deux choses de présentation :

- **Le chapeau** : mode d'emploi complet à l'import, une phrase en recalibrage.
- **La hauteur** (exception assumée). Sur `/import`, la calibration **n'a pas de
  hauteur propre** : elle défile avec la page dans la `CustomScrollbar`
  environnante (s'en donner une y remettrait la scrollbar imbriquée proscrite par
  le DS). En recalibrage, `.calibration--boxed` lui donne `height: 100%`, fait
  défiler **sa seule liste** (`.outline`) et fixe son pied : elle vit dans une
  modale à hauteur plafonnée où « Annuler / Recalibrer et remplacer » doit rester
  sous la main. Il n'y a toujours qu'UNE barre de défilement à l'écran — ce qui
  change, c'est qui la porte.

La modale (`ConfigView`) : `recalOpen` est **distinct de `preview`** — elle
s'ouvre au clic et porte l'attente (spinner) pendant que le backend relit le
`.odt`. Son `z-index` (200) passe **au-dessus de la doc-bar** (99) : l'overlay
doit recouvrir « Relancer l'analyse » (proposer une analyse pendant qu'on
reconstruit l'arbre serait contradictoire). Le panneau reste calé sous les deux
barres (`padding-top: calc(var(--bar-size) * 2 + var(--sp-4))`).

`CalibrationNode.vue` (récursif, replié par défaut, liseret de couleur par
niveau) liste les titres dans l'ordre du document. Deux corrections avant commit
(`POST /api/documents/preview/:previewId/commit`) :
- **Les deux bornes du livre** : chaque démarcation porte deux poignées (survol)
  — « Début du contenu » (fin du liminaire) et « Partie finale » (début de la
  ToC/index). La première est pré-positionnée (`suggestedStructureStartIndex`,
  ToC) ; la seconde (`suggestedStructureEndIndex`) **souvent absente** (le backend
  ne suggère une fin que sur le nom du titre — cf. `../../../backend/CLAUDE.md`).
  Re-cliquer la poignée active la retire : la partie finale est facultative. Le
  backend refuse `endIndex <= startIndex`.
- **Niveau par titre** : boutons `−`/`+` (pas de liste — la sémantique
  axe/bloc/article est propre à Marvarid, pas à l'ODT). L'arbre se recalcule en
  direct. Un repère "⤓" signale un saut de page forcé (`hasPageBreak`).

## Éditeur — `FolioView` / `EditorView` / `QuillBlock`

`FolioView.vue` est l'**UNIQUE** rendu paginé (Paged.js dans une `<iframe>`),
modes `read` (aperçu compact d'une page) et `edit` (rangée de pages + édition).
`EditorView.vue` (route `noeud/:nodeId?`) le monte en `mode="edit"` ; l'aperçu
`read` sert aussi dans la config. La logique pure (buildBlocks, registry,
fragment, liveEdit, syncQuill, quillCaret) et le glossaire fragment/bloc/
paragraphe vivent dans `../script/CLAUDE.md` ; le cycle d'édition dans
`../composables/CLAUDE.md`.

À connaître au niveau composant :
- **Le DOM Folio vit dans l'iframe** : le faux curseur / les rects de sélection
  (téléportés dans le body principal) sont recalés par l'offset de la frame
  (`frameOffset`). `getComputedStyle`/`getBoundingClientRect` se lisent dans le
  réalm de l'iframe.
- **Quill est invisible par défaut** (prop `quillVisible`, debug only) : le
  WYSIWYG est le miroir Folio + faux curseur ; Quill ne fait que capter la frappe.
  `syncQuill` aligne ses MÉTRIQUES (wrapping), pas sa position.
- **`fitScale`** ajuste l'échelle sur la largeur (viser `visiblePages`) ET la
  hauteur ; le `clientHeight` vient du flex parent (**indépendant du contenu →
  pas de boucle de rétroaction d'échelle**). `.folio-view--edit` doit garder une
  hauteur définie indépendante du contenu.
- **Liens internes** : un `<a class="lien-interne" href="internal:{id}">` (posé à
  l'import ODT ou par la toolbar Quill) navigue vers le nœud cible plutôt que
  d'activer l'édition (`onFrameClick` intercepte avant `onColumnClick`). La
  CRÉATION d'un lien (`ArticlePickerModal.vue`) reste à rebrancher.

## Tests DOM/layout (e2e)

Playwright (`npm run test:e2e`, specs dans `../../e2e/`) couvre ce que jsdom ne
rend pas — le **layout réel** (hauteurs, débordements, échelle). Backend jamais
requis : `e2e/fixtures.js` mocke `GET /api/documents/:id` et neutralise
l'analyse. Specs : `pagination.spec.js` (plancher de pages, non-débordement d'un
folio), `scrollbar.spec.js` (géométrie `CustomScrollbar` + non-régression de
l'échelle Folio), `sidebar.spec.js`. Pas encore de tests d'intégration DOM/Quill
(Vue Test Utils) : toute interaction clavier/souris de `FolioView`/`QuillBlock`
se vérifie **manuellement en navigateur** (cf. `../../CLAUDE.md`).
