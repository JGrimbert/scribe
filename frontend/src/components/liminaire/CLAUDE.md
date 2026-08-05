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

**⚠️ Supprimés le 2026-08-05** (avec `ConfigView`, leur seul hôte) :
`LiminaireComposer`, `LiminaireAccordeon`, `AccordeonRail`, `AccordeonFinalSlide`,
`LimBorderButton`, `LiminaireEligibilite`. La maquette monte directement les
survivants ci-dessous — l'accordéon des vis-à-vis liminaire est celui de
`../maquette/` (`MaquetteAccordeon` + `MaquetteLiminaireCell`), pas un composant
propre au liminaire.

- **`AccordeonControls.vue`** — la barre SOUS la scène (flèches · type(s)),
  révélée au survol de l'aperçu par `MaquetteView` (`.lim-hover__controls`). Porte
  `focusedControls` (dérive les 2 slots taguables du vis-à-vis focusé, largeur FIXE
  pour que les flèches ne bougent jamais). Émet `set-type`. La pastille côté R/V/·
  a été **retirée** (remplacée par `precedes` par style, cf. ci-dessus).
- **`LiminaireFolio.vue`** — UN folio physique, sans état ni contrôle : la page
  ne porte que son verdict (type/suggestion/aperçu). Monté par
  `../maquette/MaquetteLiminaireCell.vue`. Gère couverture / page blanche /
  blanche implicite (belle page).
- **`LiminaireDecoupage.vue`** — le découpage des SEULES pages du vis-à-vis
  focusé : la seule vue qui montre les entrées, donc la seule où scinder. Le
  **type** se pose dans l'accordéon (une page a un type, pas une entrée) ; ici on
  scinde / rattache une frontière (mêmes gestes, même gouttière). Config mutée en
  place. Monté par `MaquetteView` (survol de l'aperçu).
- **`../../composables/useWheelStepper.js`** — molette : un cran par palier
  (seuil d'accumulation), avec cible anticipée pour un geste vif de pavé tactile.

⚠️ **Reste à faire** (items 2/3) : sortir le select de type d'`AccordeonControls`
et le découpage de la carte du bas (`.lim-hover__controls` de `MaquetteView`) pour
les poser SUR les folios / dans les marges, ancrés sur `spreadGeometry`.
