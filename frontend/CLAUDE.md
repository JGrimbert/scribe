# Scribe — frontend

Éditeur de texte Vue destiné à l'édition print (rendu paginé, WYSIWYG). Stack :
Vue 3 (`<script setup>`) + Vite, Quill 2 (édition), Paged.js / `pagedjs`
(pagination livre), ECharts, PrimeIcons.

Fait partie du monorepo `scribe` (voir `../CLAUDE.md` pour les règles générales,
l'organisation frontend/backend et les deux chemins de données qui coexistent —
registre backend vs fichiers statiques `Marvarid/` historiques).

## Carte des sous-docs (chargés à la demande)

Ce fichier ne garde que le transverse ; le détail vit près du code et ne se
charge que quand on y travaille :

- **`src/router/CLAUDE.md`** — routing + rôle de chaque vue.
- **`src/components/CLAUDE.md`** — carte des sous-dossiers de composants (tout est
  éclaté par famille, chaque doc chargé à la demande) + note e2e transverse :
  - `src/components/editor/CLAUDE.md` — rendu paginé + édition (`FolioView`, Quill).
  - `src/components/import/CLAUDE.md` — import `.odt` + calibration/recalibration.
  - `src/components/structure/CLAUDE.md` — aside arborescente (`StructureView`).
  - `src/components/layout/CLAUDE.md` — coquille d'un document (`DocumentLayout`,
    `DocumentBar` : asides, fil d'Ariane, validation, scope).
  - `src/components/home/CLAUDE.md` — accueil + registre (`HomeView`, `DocumentList`).
  - `src/components/config/CLAUDE.md` — écran de configuration (typologie,
    styles, modèles, règles, recalibration).
  - `src/components/analyse/CLAUDE.md` — dashboard (cards, `AnalyseBlock`, echarts).
  - `src/components/ui/CLAUDE.md` — design system atomique + Storybook + `BaseChart`.
  - `src/components/liminaire/CLAUDE.md` — typage/composition des pages liminaires.
- **`src/script/CLAUDE.md`** — logique pure : moteur d'édition (pagination,
  registry, fragment, caret), vocabulaires (`typology`/`zones`/`shapes`),
  helpers d'analyse, + **glossaire détaillé** de l'édition.
- **`src/composables/CLAUDE.md`** — logique Vue à état (édition, registre,
  typologie, analyse).

## Vocabulaire — Quill vs Folio

Deux couches, deux mots, à ne jamais mélanger :
- **Quill** : l'éditeur WYSIWYG flottant (`QuillBlock.vue`), invisible en usage
  réel — il n'édite qu'UN fragment à la fois et ne fait que capter la frappe.
- **Folio** : la couche de rendu paginé (Paged.js), celle qu'on regarde.
  « Paged »/« Paged.js » désigne la librairie ; **« Folio » est le mot à utiliser
  en code et en discussion**. L'unique composant de rendu est `FolioView.vue`
  (Paged.js en iframe). (L'ancien trio `FolioComposer`/`Folia`/`Folio` a été
  supprimé.)

Un changement touche Quill (comportement d'édition, clavier, contenu du fragment)
XOR Folio (mise en page, pagination, rendu) — identifier laquelle avant de
chercher le bug évite de fouiller le mauvais fichier.

**Glossaire fragment/bloc/paragraphe** (version courte) : un **paragraphe** =
une entrée de `article.texte[]` ; un **bloc** = un paragraphe avant pagination ;
un **fragment** = un morceau de bloc quand Paged.js le coupe entre deux pages.
L'édition se fait fragment par fragment. Détail dans `src/script/CLAUDE.md`.

## Design system (résumé)

`src/assets/base.css` est la source unique des tokens (couleurs, typo, échelles,
radius). Ne pas introduire de couleur/taille en dur. Composants réutilisables
dans `src/components/ui/` (atomic design + Storybook). Conventions : radius ≤ 4 px,
**pas de scrollbars internes multiples**, transitions compositor-only, sans-serif
partout dans l'UI (`--font-serif` réservé au contenu du manuscrit). La couche
Folio/Quill est hors périmètre `ui/`/Storybook. Détail : `src/components/ui/CLAUDE.md`.

## Tests

- **Vitest + jsdom** (`npm test`, `npm run test:watch`, config `vitest.config.js`) :
  logique pure colocalisée `*.test.js` dans `src/script/` (fusion/split,
  ventilation par zone…) — pas de dépendance DOM/Quill/Paged.js réelle, volontaire.
- **Playwright** (`npm run test:e2e`, specs `e2e/`) : le layout réel que jsdom ne
  rend pas. Backend mocké (`e2e/fixtures.js`). Détail dans `src/components/CLAUDE.md`.
- Pas de tests d'intégration DOM/Quill : toute interaction clavier/souris de
  l'éditeur se vérifie **manuellement en navigateur** (il n'y a pas d'outil de
  pilotage navigateur ici — cf. `../CLAUDE.md`).

## Commandes

Depuis `frontend/` :
```
npm run dev          # serveur de dev Vite
npm test             # vitest run
npm run test:watch   # vitest en mode watch
npm run test:e2e     # Playwright
npm run storybook    # Storybook (port 6006)
npm run build        # build de prod (supprimer dist/ après une build de vérif)
```
Depuis la racine : équivalent via `--workspace frontend`, ou `npm run dev` pour
lancer frontend + backend ensemble.

## Conventions de code

- Logique pure sans état Vue → `src/script/*.js`. Logique avec état/cycle de vie
  Vue → `src/composables/use*.js`. Composants → `src/components/*.vue`.
- Éviter la duplication en isolant le protocole commun dans une fonction partagée
  (ex : `mergeFragment(direction)` plutôt que deux variantes copiées-collées).
- Commentaires en français, uniquement quand le « pourquoi » n'est pas évident
  (contrainte cachée, contournement, comportement surprenant). Ne pas commenter
  ce que le code dit déjà.
- Ne pas créer de fichiers `*.md` de documentation/plan sauf demande explicite.
