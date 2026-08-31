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

## Modèle « DISPOSITION » — imposition explicite, réglage PAR ÉLÉMENT (2026-08-31)

État courant, **verrouillé par une batterie de tests** (`liminaire-disposition.test.js`,
fixture fidèle au témoin Johanan). Ne pas dévier sans cadrage utilisateur — ce modèle est
l'aboutissement d'un long va-et-vient (voir « Historique » plus bas).

**Imposition EXPLICITE, sans parité** (`computeImposition`, `liminaire-imposition.js`) :
les pages sont numérotées à la suite (recto = impair, verso = pair) ; une blanche
n'apparaît que si le .odt en porte une (`isBlank`) ou pour une **belle page**. Le côté
`sideFromOdt` est calculé mais **ne contraint rien** (la parité a été essayée puis
abandonnée). Le défaut reproduit déjà l'imposition d'OpenOffice sur le témoin (les vides
du .odt tombant aux bons folios) — cf. le 1er cas du cahier de tests.

**DISPOSITION par ÉLÉMENT** (`liminaireConfig[clé].disposition` ∈ `none|break|blank`,
libellés `continu / saut de page / belle page` dans `PRECEDES_LABELS`), lue par
`groupLiminairePages(entries, config)` :
- **continu** (`none`) : l'élément RECOLLE à la page en cours (désarme tout saut, y compris
  celui du .odt) — absorbe une blanche qui le précédait ;
- **saut de page** (`break`) : ouvre un nouveau folio, sans blanche ;
- **belle page** (`blank`) : ouvre un folio + une blanche, et le contenu tombe à DROITE
  (recto) — `computeImposition` pose 1 blanche, ou 2 si le contenu retombait au verso ;
- **absent** (défaut) : l'élément suit le .odt (`pageStart`, ou changement de type de style).

**Affichage du select = disposition EFFECTIVE** (`dispositionByStyle(pages)`, fonction PURE
dans `liminaire-imposition.js`) : par style, sa 1re occurrence ; l'ouvreur d'une page vaut
`blank` s'il est précédé d'une vraie blanche (ni couverture ni contenu), sinon `break` ; un
élément interne vaut `none`. Reflète .odt ET overrides. `MaquetteView` en dérive
`limDispositionByStyle` (fournie via `maq`) ; le select de `MaquetteStyleCallouts` l'affiche
et écrit `liminaireConfig[clé].disposition` (⚠️ `liminaireConfig` est fourni en `provide`
de premier niveau — sans lui l'écriture tombait dans le vide). La flèche de découpage
par-paragraphe et le `stylePrecedence` PAR STYLE ont été retirés du liminaire (ce dernier
subsiste, cosmétique, côté chapitrage).

> **Historique (à NE PAS re-tenter sans cadrage)** : côté recto/verso PAR ENTRÉE puis
> `precedes` PAR STYLE (2026-08-05) ; puis, sur retours utilisateur (2026-08-30/31),
> **absorption** des blanches dans le style suivant → antinomique, ANNULÉE ; **parité**
> (`computeImposition` respectant `sideFromOdt`) → « tout foutu en l'air », ANNULÉE.
> Reproduire fidèlement le recto/verso .odt reste un problème OUVERT. Le modèle
> ci-dessus (disposition par élément) est ce qui a été retenu.

La logique liminaire est éclatée par thème (chacun testé, `*.test.js`
colocalisé) : `liminaire-vocab.js` (vocabulaire + `typeOfStyleName` /
`sideOfPageStart` / `PRECEDES_KINDS` / `PRECEDES_LABELS`), `liminaire-pages.js`
(`entryPlainText` / `withEntryKeys` / `groupLiminairePages(entries, config)` — DISPOSITION
par élément), `liminaire-imposition.js` (`computeImposition` explicite / `toSpreads` /
`pagesOfSpread` / **`dispositionByStyle`** — `effectiveSide` et la parité SUPPRIMÉS),
`liminaire-eligibilite.js` (`deriveEligibility`), `liminaire-config.js` (accès à la
config de tagging ; `sideOfPage`/`setPageSide`/`breakOfKey`/`toggleBreak` subsistent mais
ne sont plus consommés), plus `liminaire-bornes.js` (absorption des bornes) et
`liminaire-suggest.js` (suggestions de type).

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
