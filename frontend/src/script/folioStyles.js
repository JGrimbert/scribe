// Apparence des styles ODT → CSS pour la couche Folio. Le backend renvoie
// `visuals` (par nom de style effectif, cf. GET /documents/:id) ; on stampe
// `data-style="<styleName>"` sur chaque bloc (cf. useFolioFrame) et cette feuille
// applique la police/le corps/l'alignement d'origine. Rendu FIDÈLE au .odt plutôt
// que le look générique de paged.css.

// StyleVisual → propriété CSS. `bold`/`italic`/`pageBreakBefore` sont des
// booléens, traités à part.
const PROP_MAP = {
  fontFamily: 'font-family',
  fontSize: 'font-size',
  color: 'color',
  align: 'text-align',
  marginTop: 'margin-top',
  marginBottom: 'margin-bottom',
  marginLeft: 'margin-left',
  marginRight: 'margin-right',
  textIndent: 'text-indent',
  lineHeight: 'line-height',
  fontVariant: 'font-variant',
  letterSpacing: 'letter-spacing',
  widows: 'widows',
  orphans: 'orphans',
}

// Un nom de police multi-mots ou à chiffre (« Florals 2 », « Times New Roman »)
// DOIT être quoté, sinon la déclaration CSS est invalide et silencieusement ignorée
// → repli sur la police générique (Georgia). Les identifiants simples (Georgia,
// Arial, serif) et les valeurs déjà quotées restent tels quels ; on quote chaque
// famille d'une liste séparée par des virgules.
function cssFontFamily(val) {
  return String(val)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => (/^['"].*['"]$/.test(f) || /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(f) ? f : `"${f}"`))
    .join(', ')
}

// Déclarations d'APPARENCE (police/corps/alignement/marges/emphase), sans les
// propriétés de FLUX (break-before/keep-with-next). Partagé par la feuille visuals
// et le rendu inline par paragraphe.
function appearanceDeclarations(v) {
  const decls = []
  for (const [key, cssProp] of Object.entries(PROP_MAP)) {
    if (v[key] != null && v[key] !== '') {
      const value = key === 'fontFamily' ? cssFontFamily(v[key]) : v[key]
      decls.push(`${cssProp}:${value}`)
    }
  }
  if (v.bold) decls.push('font-weight:bold')
  if (v.italic) decls.push('font-style:italic')
  return decls
}

function declarations(v) {
  const decls = appearanceDeclarations(v)
  if (v.pageBreakBefore) decls.push('break-before:page')
  // « Garder avec le suivant » : empêche une coupure de page APRÈS ce bloc (un
  // titre ne reste pas seul en bas de page, détaché de son paragraphe).
  if (v.keepWithNext) decls.push('break-after:avoid')
  return decls.join(';')
}

// Apparence d'un StyleVisual en CSS INLINE, pour l'appliquer PAR PARAGRAPHE dans
// l'aperçu d'imposition : le liminaire porte son apparence COMPLÈTE (mise en forme
// directe comprise) sur chaque entrée (`TexteEntry.visual`, backend). Inline →
// l'emporte sur la feuille visuals ET sur le `text-align:justify` de repli du boot.
// Les propriétés de flux sont écartées : l'imposition gère elle-même ses sauts.
export function styleVisualToInlineCss(v) {
  return v ? appearanceDeclarations(v).join(';') : ''
}

// La valeur vit entre guillemets dans le sélecteur : espaces/accents/« ? » des
// noms de styles (« Puces ? », « mentions légales ») passent tels quels ; seuls
// un guillemet ou un antislash littéral casseraient la chaîne.
function escapeAttrValue(name) {
  return name.replace(/["\\]/g, '\\$&')
}

// Encre du surlignage (--c-accent-alt) en littéral : l'iframe est isolée
// (about:blank), les tokens CSS de l'app n'y sont pas résolus.
const HIGHLIGHT_INK = '#138297'

// Surlignage du style survolé dans l'aside : son texte vire au teal, cerné d'un
// pointillé POSÉ EN DEHORS. `outline` et non `border` : il ne prend aucune place
// dans le flux — un border décalerait le texte sous le curseur et pourrait le
// pousser à la page suivante, alors qu'on ne fait que le désigner.
export function buildHighlightCss(styleName) {
  if (!styleName) return ''
  const sel = `[data-style="${escapeAttrValue(styleName)}"]`
  return [
    // `!important` : l'imposition liminaire pose l'apparence .odt EN INLINE sur
    // chaque entrée (couleur comprise, cf. styleVisualToInlineCss) — sans lui, un
    // paragraphe coloré par le document ne s'allumerait pas.
    `${sel},${sel} *{color:${HIGHLIGHT_INK}!important;}`,
    `${sel}{outline:1px dotted ${HIGHLIGHT_INK};outline-offset:3px;}`,
  ].join('')
}

// Marges effectives (recto) en cm : marges MIROIR de l'utilisateur (`margins`,
// { topCm, bottomCm, innerCm, outerCm }) si présentes, sinon celles du .odt
// (`page`, symétriques). Sur une page RECTO (droite), l'intérieur (petit fond) est
// à gauche, l'extérieur (grand fond) à droite. Renvoie null si rien de connu.
function rectoMargins(page, margins) {
  if (margins) return { top: margins.topCm, right: margins.outerCm, bottom: margins.bottomCm, left: margins.innerCm }
  if (page) return { top: page.marginTopCm, right: page.marginRightCm, bottom: page.marginBottomCm, left: page.marginLeftCm }
  return null
}

// Réserve (en cm) que les titres courants retirent au CORPS. Convention (Imprimerie
// nationale) : la marge (blanc de tête/pied) va jusqu'au bord de l'EMPAGEMENT, qui
// contient le titre courant + le folio. Activer l'en-tête pousse donc le corps vers
// le bas de sa hauteur + un blanc ; le pied/folio le remonte de même. Le blanc de
// tête/pied (la marge réglée) reste constant.
const DEFAULT_BAND_CM = 0.6 // hauteur d'une ligne de titre courant, si non fixée
const RUNNING_GAP_CM = 0.4 // blanc entre le titre courant et le corps

function bandHeightCm(band) {
  return band && band.heightCm ? band.heightCm : DEFAULT_BAND_CM
}

export function runningReserves(runningTitles) {
  const rt = runningTitles || {}
  const top = rt.header?.enabled ? bandHeightCm(rt.header) + RUNNING_GAP_CM : 0
  const bottom = rt.footer?.enabled ? bandHeightCm(rt.footer) + RUNNING_GAP_CM : 0
  return { top, bottom }
}

// Guides « maquette » de l'aperçu de FORMAT (pages vides, `bodyCross`) : l'aperçu
// est un GABARIT — on ne veut QUE du gris typographique. Empagement lisible + croix
// du corps ; en-tête/pied matérialisés par un RECTANGLE GRIS schématique (pas un
// vrai titre courant ni folio, masqués via `.pagedjs_margin-content`). Les pages
// étant VIDES, `overflow:visible` sur la zone de contenu laisse le rectangle, posé
// dans le blanc de tête/pied (hors zone de contenu), s'afficher sans être rogné.
const GUIDE_LINE = '#b8b8b8'
const GUIDE_FILL = '#c9c9c9' // gris typographique du rectangle en-tête/pied
const GUIDE_TEXT_WIDTH = '40%' // titre courant : ligne courte (pas toute la largeur)
const GUIDE_FOLIO_WIDTH = '1.2cm' // numéro de page : largeur d'un folio
const BODY_CROSS =
  'linear-gradient(to top right,transparent calc(50% - .5px),#d9d9d9 calc(50% - .5px),#d9d9d9 calc(50% + .5px),transparent calc(50% + .5px)),'
  + 'linear-gradient(to bottom right,transparent calc(50% - .5px),#d9d9d9 calc(50% - .5px),#d9d9d9 calc(50% + .5px),transparent calc(50% + .5px))'

export function buildFormatGuidesCss(runningTitles) {
  const rt = runningTitles || {}
  const parts = [
    `.pagedjs_page_content{position:relative;overflow:visible;outline:1px solid ${GUIDE_LINE};background-image:${BODY_CROSS};}`,
    // Que du gris typographique : pas de vrai titre courant / folio sur le format.
    '.pagedjs_margin-content{display:none;}',
  ]

  // Une bande = un CADRE bordé pleine largeur (matérialise la zone en-tête/pied,
  // comme `.band` du PageDiagram), calé au bord de l'empagement (séparé du corps par
  // le blanc `RUNNING_GAP_CM`, cf. runningReserves). Le gris typographique est peint
  // À L'INTÉRIEUR, en background, seulement si le côté porte un contenu : largeur d'une
  // ligne de titre (`40%`) ou d'un folio (`1.2cm`). Placement : `centre` = centré ;
  // `regard` = bord EXTÉRIEUR, en miroir. En planche (mode spread), le recto (page
  // impaire = `pagedjs_right_page`) s'affiche à GAUCHE et le verso (`pagedjs_left_page`)
  // à DROITE — « extérieur » (loin de la reliure) = gauche au recto, droite au verso
  // (cf. `swapParity`, buildRunningTitlesCss).
  const addBand = (band, pseudo, offset) => {
    if (!band?.enabled) return
    parts.push(
      `.pagedjs_page_content::${pseudo}{content:"";position:absolute;left:0;right:0;`
      + `${offset}:calc(100% + ${RUNNING_GAP_CM}cm);height:${bandHeightCm(band)}cm;`
      + `border:1px solid ${GUIDE_LINE};box-sizing:border-box;background-repeat:no-repeat;}`,
    )
    const regard = band.justification === 'regard'
    const side = (pageClass, content, outer) => {
      if (!content || content === 'aucun') return
      const width = content === 'folio' ? GUIDE_FOLIO_WIDTH : GUIDE_TEXT_WIDTH
      const posX = regard ? outer : 'center'
      parts.push(
        `.${pageClass} .pagedjs_page_content::${pseudo}{`
        + `background-image:linear-gradient(${GUIDE_FILL},${GUIDE_FILL});`
        + `background-size:${width} 100%;background-position:${posX} center;}`,
      )
    }
    side('pagedjs_right_page', band.recto, 'left')
    side('pagedjs_left_page', band.verso, 'right')
  }
  addBand(rt.header, 'before', 'bottom')
  addBand(rt.footer, 'after', 'top')
  return parts.join('')
}

// Format de page (dimensions + marges) → règles @page pour Paged.js. Passées à
// preview() APRÈS paged.css : leurs descripteurs @page l'emportent (les règles
// @page fusionnent, la dernière gagne). Avec marges MIROIR (`margins`), la base
// vaut pour le recto et `@page:left` inverse gauche/droite pour le verso.
// `reserves` (titres courants) s'ajoute au HAUT/BAS seulement — le corps se réduit,
// le titre courant occupe l'espace réservé dans la marge. Vide si ni dimensions
// ni marges → paged.css garde son A5 par défaut.
export function buildPageCss(page, margins = null, reserves = { top: 0, bottom: 0 }) {
  if (!page && !margins) return ''
  const size = page ? `size:${page.widthCm}cm ${page.heightCm}cm;` : ''
  const m = rectoMargins(page, margins)
  if (!m) return size ? `@page{${size}}` : ''
  const top = m.top + (reserves.top || 0)
  const bottom = m.bottom + (reserves.bottom || 0)
  // recto : haut / extérieur (droite) / bas / intérieur (gauche)
  const base = `@page{${size}margin:${top}cm ${m.right}cm ${bottom}cm ${m.left}cm;}`
  // verso : miroir (intérieur à droite, extérieur à gauche) — seulement si les
  // marges diffèrent gauche/droite (sinon inutile).
  if (m.left === m.right) return base
  const verso = `@page:left{margin:${top}cm ${m.left}cm ${bottom}cm ${m.right}cm;}`
  return base + verso
}

// Épingle les variables de géométrie de page de Paged.js (`:root`) avec `!important`.
// Paged ré-injecte son polyfill dans le `<head>` PARTAGÉ de l'iframe à CHAQUE
// pagination, et ce polyfill remet ces variables à leur défaut US Letter avant que
// l'override `@page` (A5) ne repasse. Comme le double-buffer garde l'ancien rendu
// affiché pendant la pagination, ce basculement était visible sur le contenu — la
// page « changeait de taille » un instant (cf. useFolioFrame). L'épingle persistante
// neutralise ce transitoire. Valeurs : format du .odt/utilisateur ou A5 par défaut
// (paged.css). Les marges épinglées sont celles du RECTO ; le verso miroir est
// posé par `@page:left` (buildPageCss) après le polyfill — un très bref transitoire
// de marge peut subsister sur le verso, sans conséquence sur les dimensions.
export function buildPagePinCss(page, margins = null, reserves = { top: 0, bottom: 0 }) {
  const w = page ? `${page.widthCm}cm` : '148mm'
  const h = page ? `${page.heightCm}cm` : '210mm'
  const m = rectoMargins(page, margins) ?? { top: 2.2, right: 2, bottom: 2.2, left: 2 }
  const cm = (v) => `${v}cm`
  const top = m.top + (reserves.top || 0)
  const bottom = m.bottom + (reserves.bottom || 0)
  return ':root{'
    + `--pagedjs-width:${w}!important;--pagedjs-height:${h}!important;`
    + `--pagedjs-width-left:${w}!important;--pagedjs-width-right:${w}!important;`
    + `--pagedjs-height-left:${h}!important;--pagedjs-height-right:${h}!important;`
    + `--pagedjs-pagebox-width:${w}!important;--pagedjs-pagebox-height:${h}!important;`
    + `--pagedjs-margin-top:${cm(top)}!important;--pagedjs-margin-right:${cm(m.right)}!important;`
    + `--pagedjs-margin-bottom:${cm(bottom)}!important;--pagedjs-margin-left:${cm(m.left)}!important;`
    + '}'
}

// Césure → feuille pour l'iframe Paged.js. Cascade par style :
// valeur .odt EXPLICITE du style (`visuals[name].hyphenate`) > défaut global.
// (La surcharge par rôle Scribe s'insère entre les deux en phase 2.)
// `hyphens:auto` n'agit que si un `lang` est posé sur le contenu (cf.
// useFolioFrame, `lang="fr"` sur le <html> de l'iframe) et se voit surtout sur du
// texte justifié — la zone de contenu l'est déjà.
//
// Deux stratégies d'émission selon le défaut, pour ne cibler que les exceptions :
//  - global ON  : césure d'ensemble sur `.pagedjs_page_content`, + `manual` pour
//    les styles que le .odt déclare explicitement à false ;
//  - global OFF : rien d'ensemble, + `auto` pour les styles explicitement à true.
export function buildHyphenationCss(visuals, { global = false } = {}) {
  const explicit = Object.entries(visuals || {})
    .filter(([, v]) => v.hyphenate != null)
  const rules = []
  if (global) {
    rules.push('.pagedjs_page_content{-webkit-hyphens:auto;hyphens:auto}')
    for (const [name, v] of explicit) {
      if (!v.hyphenate) rules.push(`.pagedjs_page_content [data-style="${escapeAttrValue(name)}"]{-webkit-hyphens:manual;hyphens:manual}`)
    }
  } else {
    for (const [name, v] of explicit) {
      if (v.hyphenate) rules.push(`.pagedjs_page_content [data-style="${escapeAttrValue(name)}"]{-webkit-hyphens:auto;hyphens:auto}`)
    }
  }
  return rules.join('\n')
}

// Échappe une chaîne pour un descripteur CSS `content:"…"` : guillemets et
// antislash littéraux, plus les sauts de ligne (interdits dans un token string).
function cssString(s) {
  return `"${String(s ?? '').replace(/[\\"]/g, '\\$&').replace(/\n/g, ' ')}"`
}

// Titres courants → règles @page (margin boxes) pour Paged.js. Rendu FIDÈLE aux
// règles typographiques du livre :
//  - `header`/`footer` : chaque bande, activable seule, porte son contenu par côté
//    (recto = pages IMPAIRES = `@page:right` ; verso = paires = `@page:left`) —
//    titre / chapitre / FOLIO (numéro de page = « ? » en attendant la pagination
//    livre entier) / rien ;
//  - `justification` par bande : `centre` = boîte centrale ; `regard` = bord
//    EXTÉRIEUR (droite en recto, gauche en verso) ;
//  - le corps est réduit en amont (`runningReserves`/`buildPageCss`) pour que le
//    titre courant occupe le bord de l'empagement sans mordre sur le texte : les
//    boîtes du haut collent au bas de leur marge (`vertical-align:bottom`), celles
//    du bas au haut (`vertical-align:top`), séparées du corps par le même blanc ;
//  - IMPÉRATIF : ni en-tête, ni pied sur la PREMIÈRE page (`@page:first`) — c'est
//    une première page de chapitre. Le liminaire et les pages blanches sont rendus
//    hors de cette couche (LiminaireComposer), donc déjà nus.
//
// Contenu LITTÉRAL (pas de `string-set`) : FolioView pagine un seul chapitre, on
// tient déjà le titre du livre et le nom du chapitre — inutile de les faire
// remonter par un compteur de chaîne nommée.
const RUNNING_BOX_BASE = 'font-size:9pt;color:#666;'
// Aligne le titre courant au bord de l'empagement (près du corps), séparé par le
// même blanc que la réserve. `vertical-align` sur une margin box : appui Paged.js
// à confirmer en navigateur — sans effet, le contenu reste dans la marge élargie.
const TOP_BOX = `${RUNNING_BOX_BASE}vertical-align:bottom;padding-bottom:${RUNNING_GAP_CM}cm;`
const BOTTOM_BOX = `${RUNNING_BOX_BASE}vertical-align:top;padding-top:${RUNNING_GAP_CM}cm;`

// `swapParity` : dans l'aperçu de planche (mode `spread`), les pages sont affichées
// dans l'ordre séquentiel (page 1 recto à GAUCHE, page 2 verso à DROITE), inversé
// d'une vraie planche livre (verso à gauche, recto à droite). Pour que le folio et
// les titres courants tombent au bon coin (extérieur), on échange la PAGE ciblée
// (@page:left ↔ :right) — le côté logique et le contenu, eux, ne changent pas.
export function buildRunningTitlesCss(running, { bookTitle = '', chapterTitle = '', swapParity = false } = {}) {
  if (!running) return ''
  const { header, footer } = running
  if (!header?.enabled && !footer?.enabled) return ''

  const contentFor = (which) => {
    if (which === 'titre') return cssString(bookTitle)
    if (which === 'chapitre') return cssString(chapterTitle)
    if (which === 'folio') return '"XX"' // numéro de page (placeholder ; XX à paginer)
    return 'none' // 'aucun'
  }
  const rules = []

  // Une bande : son contenu par côté, placé selon la justification. `regard` =
  // bord extérieur (droite en recto, gauche en verso).
  const addBand = (band, edge, box) => {
    if (!band?.enabled) return
    const regard = band.justification === 'regard'
    const place = (side, pageSel, value) => {
      if (value === 'none') return
      const pos = regard ? (side === 'recto' ? 'right' : 'left') : 'center'
      const sel = swapParity ? (pageSel === 'right' ? 'left' : 'right') : pageSel
      rules.push(`@page:${sel}{@${edge}-${pos}{content:${value};${box}}}`)
    }
    place('recto', 'right', contentFor(band.recto))
    place('verso', 'left', contentFor(band.verso))
  }
  addBand(header, 'top', TOP_BOX)
  addBand(footer, 'bottom', BOTTOM_BOX)

  // Supprime TOUTES les margin boxes sur la première page (chapitre). Placé APRÈS
  // pour l'emporter (les règles @page fusionnent, la dernière gagne).
  rules.push('@page:first{'
    + '@top-left{content:none}@top-center{content:none}@top-right{content:none}'
    + '@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}')
  return rules.join('\n')
}

// visuals (map nom→StyleVisual) → feuille de style pour l'iframe Paged.js.
// Sélecteur préfixé `.pagedjs_page_content ` : spécificité (0,2,0), au-dessus des
// règles génériques de paged.css (`article`, `article p`) qui, sinon,
// l'emporteraient sur un simple `[data-style]`.
export function buildVisualsCss(visuals) {
  if (!visuals) return ''
  return Object.entries(visuals)
    .map(([name, v]) => {
      const d = declarations(v)
      return d ? `.pagedjs_page_content [data-style="${escapeAttrValue(name)}"]{${d}}` : ''
    })
    .filter(Boolean)
    .join('\n')
}
