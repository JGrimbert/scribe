# Coquille d'un document — `components/layout/`

`DocumentLayout.vue` : la coquille d'un document ouvert (asides + topbar
`DocumentBar` + `<router-view>`). Charge `trame`/`data` (`GET /documents/:id`) et
les distribue ; fournit le store d'analyse (`provideAnalyse`, cf.
`../analyse/CLAUDE.md`) — monté ici, à la racine du document, pour que
`DocumentBar` et la maquette (cards, CTA) y accèdent.

## Aside gauche — structure

L'aside porte **toujours** `../structure/StructureView.vue` (arbre des nœuds), sauf
en maquette (pleine largeur, son propre sommaire flottant). Le mode registre
(`DocumentList` dans l'aside) a été **entièrement retiré** le 2026-08-30, avec
`DocumentList` lui-même : depuis la suppression de l'écran de config (2026-08-05)
il n'était plus jamais rendu, et l'accueil porte désormais son propre tableau de
registre (cf. `../home/CLAUDE.md`). `DocumentBar` reçoit `asideLabel` (« la
structure »).

## Bandeau de chargement — la barre ne saute pas

`DocumentBar` attend `trame && data` (cf. « Cycle trame/data »), donc pendant le
fetch d'un document elle n'est pas rendue. Un `.doc-bar-loading` (même hauteur,
même fond `--c-ui-light`, même filet que la doc-bar) prend alors sa place : sans
lui, la 2e barre DISPARAÎT entre l'accueil et le document, et l'interface saute
d'une barre.

## Cycle trame/data — piège du démontage

`DocumentLayout` ne bloque plus son rendu entier sur `v-if="trame && data"` —
seuls `DocumentBar` et le `<router-view>` attendent, sinon changer de document
depuis l'aside la ferait disparaître le temps du fetch. **Corollaire, piège déjà
refermé une fois** : ce `v-if` fait que vider `trame`/`data` DÉMONTE la vue
enfant. `loadDocument(id, { silent })` existe pour ça — un rechargement en place
(après recalibration) ne vide rien, sans quoi il détruit l'écran qui l'a demandé.
Le vidage reste le défaut pour un vrai changement de document.

## Menus — topbar, `DocumentBar`, scope d'analyse

- **Deux barres empilées, hauteur == largeur du rail** : la topbar globale
  (`App.vue`, `.menu`) et la sidebar repliée partagent le token `--bar-size`
  (`base.css`).
- `DocumentBar.vue` — **seconde topbar** (pleine largeur, sous `.menu`, montée par
  `DocumentLayout`), fond `--c-subbar`. Chevron de repli (largeur `--bar-size`)
  puis **fil d'Ariane** : titre du livre → niveaux jusqu'au nœud courant
  (`pathToInAxes`, `../../script/trame.js`, partagé avec `StructureView`). Le titre
  vient de `GET /documents/:id` (`content.title`).
- **CTA global à droite, contextuel** — le slot d'action à l'extrémité droite
  porte **un** CTA par écran. Par défaut le bouton d'analyse (« Relancer /
  Lancer l'analyse » + checklist, `useAnalyse`). Une vue routée peut le remplacer
  en posant une action : `DocumentLayout` fournit `provide('documentBarAction')`
  (un `ref`), la vue le renseigne via `inject` tant qu'elle est montée
  (`{ label, icon, disabled, busy, title, run }`), `DocumentBar` le reçoit en prop
  et l'affiche à la place du CTA d'analyse. Aujourd'hui seule la **config** s'en
  sert (« Redéfinir les bornes ») ; le `null` au démontage rend le slot à
  l'analyse.
- **Recherche + volet (`DocSearchPanel.vue`)** — le champ inline de la barre ouvre
  au focus un volet plein écran (téléporté dans `body` : le `backdrop-filter` de
  la barre clipperait un enfant `fixed`) portant stats discrètes + onglets +
  nuage de mots. Ce contenu est extrait dans `DocSearchPanel` parce qu'il a
  **deux hôtes** : ce volet, et — en **maquette** — le sommaire flottant
  (`../maquette/MaquetteStructureNav.vue`), qui héberge aussi le champ (rangée
  nue au-dessus de sa carte) ; là, la `DocumentBar` masque le sien (un spacer
  prend sa place). Le panneau n'a ni fond ni cadre — l'hôte porte le décor — et
  déclenche lui-même l'étape `lexical` à son montage si elle manque.
  - **Onglets** : « Nuage » en permanence, « Résultats » **seulement pendant une
    saisie** et prioritaire tant qu'il existe (un choix manuel n'est retenu que
    jusqu'à la fin de la saisie). Recherche floue `fuzzy-search` sur les **titres
    de chapitres uniquement** — indexer le texte intégral ferait un scan de
    plusieurs milliers de paragraphes à chaque frappe. Les titres sont indexés
    sous forme repliée (sans accents) : la lib compare caractère à caractère et
    ne déplie rien. Un résultat cliqué émet `select-node`, que chaque hôte
    interprète (navigation/scope via `select` dans la barre, focus de série en
    maquette).
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
    lien « livre » ramène à la racine du document.
  - **Hors édition** (maquette) : pose le **scope** (`scopeNodeId`, fourni via
    `provide('analyseScopeNodeId')`) sans naviguer. ⚠️ Largement dormant depuis la
    suppression du dashboard `AnalyseView` qui le consommait — et le recalcul NLP
    restreint au sous-arbre n'avait de toute façon jamais été branché.
