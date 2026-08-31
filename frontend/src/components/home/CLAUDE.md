# Accueil & registre — `components/home/`

`HomeView.vue` (route `/`) : l'accueil, désormais un **écran de registre pleine
largeur** (2026-08-30). L'ancienne aside sauge (`--c-aside-bck`) a été retirée —
une colonne verticale verte qui jurait avec le chrome de la maquette. Deux zones
empilées :

- une **barre de tête** qui reprend le chrome de la `doc-bar` (fond `--c-ui-light`,
  encre `--c-bar-accent` thématisée, hauteur `--bar-size-2`) : fil d'Ariane
  « Scribe › Accueil » + témoin « Invité ». But : l'accueil n'est plus le seul
  écran sans 2e barre — la transition vers un document ouvert ne fait plus
  « sauter » l'interface de ~74 px.
- une **zone de travail crème** (`--c-paper-cream`, comme la zone d'un document
  ouvert) : en-tête (« Vos manuscrits » + compte + CTA `../import/ImportButton.vue`)
  puis le **tableau détaillé** des manuscrits.

Le registre n'a pas d'écran à lui : il vit ici (l'aside registre de la config a
disparu avec l'écran de config, cf. `../layout/CLAUDE.md`).

- **`../../composables/useRegistry.js` est un état de MODULE** : `documents`,
  `loading`, `error`, `deletingId`, `confirmAndDelete` — partagés avec le bouton
  d'import (monté ici ; l'aside de config qui le montait aussi a disparu).
  `pendingPreview` y vit également (l'outline fait des milliers d'entrées, hors
  URL). `HomeView` fait son fetch au montage (`ensureLoaded`).
- **Tableau sur mesure, pas `UiTable`** : le style encadré de `UiTable` (anneau +
  en-tête cyan + double cadre) est trop lourd pour un registre. Ici en-tête sobre
  gris (`--c-surface2`, uppercase `--c-muted`) sur cadre papier (`--c-paper` +
  `--c-border`, radius `--radius-md`). Colonnes = stats du `DocumentSummary` (axes,
  blocs, articles, mots, poids `--` si `!hasSource`, date) + **deux colonnes
  réservées aux comptes** (`Dernier accès`, `Accès` = nb d'utilisateurs autorisés),
  grisées et à `—` tant que l'authentification n'existe pas (placeholders assumés,
  cf. témoin « Invité »). Table large → `overflow-x` DANS sa boîte : la page ne
  scrolle jamais horizontalement (cible desktop, tout tient sans barre).
- **Le clic sur une ligne ouvre le document** (`/documents/:id` → sa maquette : de
  l'accueil on vient LIRE). La poubelle, révélée au survol de la ligne, appelle
  `confirmAndDelete` (formulation unique dans `useRegistry`, jamais dupliquée dans
  la vue) ; l'accueil n'ayant pas de document ouvert, supprimer ne fait que
  raccourcir la liste (pas de « quitter l'écran » comme sous `DocumentLayout`).

`DocumentList.vue` (ancienne liste compacte d'aside) a été **supprimé** le
2026-08-30, en même temps que le bloc `registry-aside` mort de
`../layout/DocumentLayout.vue` (l'aside d'un document ne porte plus que la
structure). Le composant n'était plus monté nulle part depuis que l'accueil porte
son propre tableau.
