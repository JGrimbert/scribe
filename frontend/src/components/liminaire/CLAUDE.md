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
la précède ; l'imposition est **explicite, sans parité** (`blank` insère exactement une
blanche). Libellés (2026-08-30) : `PRECEDES_LABELS` = `aucun / saut / page blanche`.
La flèche de découpage par-paragraphe a été retirée : la scission se fait via ce select.

> ⚠️ **Tentatives ANNULÉES (2026-08-30/31), à ne pas réintroduire sans en parler.**
> Deux pistes ont été essayées puis rebroussées après vérif utilisateur : (1) *absorber*
> les blanches intérieures du .odt dans le `precedes` du style suivant (map
> `effectivePrecedes`, `precedesOf` rendant `undefined`, `setPrecedes` stockant `'none'`)
> → résultats antinomiques ; (2) *réintroduire la parité* (`computeImposition` respectant
> `sideFromOdt`) → « tout foutu en l'air ». Le code est **revenu au modèle explicite
> sans parité**. La reproduction fidèle du recto/verso .odt reste un problème OUVERT :
> ne pas re-tenter parité/absorption sans cadrage précis avec l'utilisateur.

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
  `FolioView` (écran Maquette), **visible en permanence**, monté par
  `../maquette/MaquetteCallouts` DANS le slot du folio (conteneur `.mc__lim` :
  `z-index:3` au-dessus de l'iframe, racine inerte `pointer-events:none`, chaque
  contrôle rétablit son pointeur) → il glisse avec la planche pendant une bascule.
  Enfants positionnés ancrés sur la géométrie émise par FolioView, ramenée en
  coords locales via l'origine de l'overlay (même patron que
  `../maquette/MaquetteFormatCallouts`). **Réduit au SELECT DE TYPE** (2026-08-30) : un
  par page taguable, centré SOUS la page (`@spread-geometry` → rects des pages ;
  `pages[0]` = verso/left, `pages[1]` = recto/right). Émet `set-type`. Les **chevrons**
  de nav et la **flèche de découpage** par-paragraphe ont été retirés : la scission se
  fait via le select « ce qui précède » des styles (cf. absorption ci-dessus). Les
  **cadres de paragraphe** ne vivent plus ici — c'est `../maquette/BlockOutlines` (le
  MÊME composant qu'en chapitrage), monté à côté par `MaquetteCallouts`, nourri par
  `@block-geometry`.
- **`LiminaireFolio.vue`** — UN folio physique, sans état ni contrôle : la page
  ne porte que son verdict (type/suggestion/aperçu). Monté par
  `../maquette/MaquetteLiminaireCell.vue` (cellule d'accordéon, pas l'aperçu
  principal). Gère couverture / page blanche / blanche implicite (belle page).
- **`../../composables/useWheelStepper.js`** — molette : un cran par palier
  (seuil d'accumulation), avec cible anticipée pour un geste vif de pavé tactile.
