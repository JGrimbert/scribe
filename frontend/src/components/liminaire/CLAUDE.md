# Liminaire — `components/liminaire/`

Typage et composition des pages liminaires (avant/après le récit), monté dans la
**maquette** (`../maquette/MaquetteView.vue` : accordéon des vis-à-vis + contrôles
en survol de l'aperçu — l'ancien écran de config a été supprimé). Le liminaire
N'EST PAS de la structure : il vit en colonnes `Json` sur `Document`, pas en
`Node` (backend : `../../../../backend/CLAUDE.md`). Feature en cours.

## Vocabulaire — `../../script/liminaire-vocab.js`

`LIMINAIRE_PAGES` : les pages conventionnelles dans l'ordre de lecture,
vocabulaire **FERMÉ** (comme `STYLE_ROLES`) — les règles de composition les
visent, une étiquette libre casserait une vérification en silence. Chaque page
porte `obligatoire`, `position` (avant/après le récit) et **`side`** : le côté
ATTENDU par la convention (recto = impaire, verso = paire), ou `null` — encore
lu par `deriveEligibility` (verdict), mais **plus par l'imposition**.

**⚠️ Refonte 2026-08-05 — le côté CHOISI par l'utilisateur est SUPPRIMÉ.** La
pastille recto/verso/auto par entrée (`config.side`, `effectiveSide`, blanches de
parité) a été remplacée par une propriété **PAR STYLE** : `precedes` ∈
`rien | saut de page | page blanche` (`PRECEDES_KINDS`/`PRECEDES_LABELS` dans
`liminaire-vocab.js`), réglée dans la table des styles (`stylePrecedence`, persistée
dans la typologie — backend `typology.ts`). Le premier style d'une page dit ce qui
la précède ; l'imposition est désormais **explicite, sans parité** (`blank` insère
exactement une blanche). Voir `../config/CLAUDE.md` (colonne `show-precedes`).

La logique liminaire est éclatée par thème (chacun testé, `*.test.js`
colocalisé) : `liminaire-vocab.js` (vocabulaire + `typeOfStyleName` /
`sideOfPageStart` / `PRECEDES_KINDS`), `liminaire-pages.js` (`entryPlainText` /
`withEntryKeys` / `groupLiminairePages(entries, config, precedesOf)` — un style à
`precedes` ≠ `none` ouvre une page), `liminaire-imposition.js` (`computeImposition`
explicite / `toSpreads` / `pagesOfSpread` — `effectiveSide` et la parité SUPPRIMÉS),
`liminaire-eligibilite.js` (`deriveEligibility`), `liminaire-config.js` (accès à la
config de tagging ; `sideOfPage`/`setPageSide`/`expectedSideOf`/`isConflicting`
subsistent mais ne sont plus consommés par l'imposition), plus `liminaire-bornes.js`
(absorption des bornes) et `liminaire-suggest.js` (suggestions de type).

## Composants

**⚠️ Supprimés** (avec `ConfigView`, leur seul hôte, le 2026-08-05) :
`LiminaireComposer`, `LiminaireAccordeon`, `AccordeonRail`, `AccordeonFinalSlide`,
`LimBorderButton`, `LiminaireEligibilite`. **Puis `AccordeonControls` et
`LiminaireDecoupage` (2026-08-05, items 2/3)** : la barre sous la scène et la
liste de découpage ont été remplacées par des contrôles posés SUR la planche
(`LiminaireControls`). La maquette monte directement les survivants ci-dessous —
l'accordéon des vis-à-vis liminaire est celui de `../maquette/`
(`MaquetteAccordeon` + `MaquetteLiminaireCell`), pas un composant propre au liminaire.

- **`LiminaireControls.vue`** — overlay des contrôles posé SUR la planche du
  `FolioView` (écran Maquette), **visible en permanence** (conteneur
  `.lim-hover__controls` de `MaquetteView` : `z-index:3` au-dessus de l'iframe,
  racine inerte `pointer-events:none`, chaque contrôle rétablit son pointeur).
  Enfants positionnés ancrés sur la géométrie émise par FolioView, ramenée en
  coords locales via l'origine de l'overlay (même patron que
  `../maquette/MaquetteFormatCallouts`). Trois familles :
  - **select de type** par page taguable, centré SOUS la page (`@spread-geometry`
    → rects des pages ; `pages[0]` = verso/left, `pages[1]` = recto/right) ;
  - **chevrons** de navigation aux bords extérieurs de la planche, bornés ;
  - **découpage** : chaque élément rendu (paragraphe) reçoit un **outline visible
    par défaut** ; sa **flèche** renvoi (rattacher la page) / nouvelle page
    (scinder) n'apparaît qu'au survol de SON outline (flèche = enfant → pas de
    clignotement, `:hover` CSS seul), centrée verticalement au bord extérieur
    (gauche du verso, droite du recto). Ancré au grain paragraphe via
    `@block-geometry` (rect par `entry.key`, cf. `../../script/paginate.js` qui
    stampe `data-entry-key` dans `buildImpositionBlocks`, lu et émis par `FolioView`).
  Émet `set-type`/`update:focused` ; `toggleBreak` mute la config EN PLACE.
- **`LiminaireFolio.vue`** — UN folio physique, sans état ni contrôle : la page
  ne porte que son verdict (type/suggestion/aperçu). Monté par
  `../maquette/MaquetteLiminaireCell.vue` (cellule d'accordéon, pas l'aperçu
  principal). Gère couverture / page blanche / blanche implicite (belle page).
- **`../../composables/useWheelStepper.js`** — molette : un cran par palier
  (seuil d'accumulation), avec cible anticipée pour un geste vif de pavé tactile.
