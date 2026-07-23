# Coquille d'un document — `components/layout/`

`DocumentLayout.vue` : la coquille d'un document ouvert (asides + topbar
`DocumentBar` + `<router-view>`). Charge `trame`/`data` (`GET /documents/:id`) et
les distribue ; fournit le store d'analyse (`provideAnalyse`, cf.
`../analyse/CLAUDE.md`) — monté ici et non dans `AnalyseView` pour que
`DocumentBar`, présent hors dashboard, y accède.

## Aside contextuelle — registre vs structure

L'aside porte `../structure/StructureView.vue` **partout sauf en config**, seul
écran qui puisse reconstruire l'arbre des nœuds ; là elle porte le registre
(`../home/DocumentList.vue`), **là et seulement là où l'arbre des nœuds ne sert à
rien**. L'arbitrage tient dans `asideMode` ; `DocumentBar` reçoit `asideLabel`
(son chevron ne peut pas dire « Replier la structure » là où il replie le
registre).

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
