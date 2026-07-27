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

function declarations(v) {
  const decls = []
  for (const [key, cssProp] of Object.entries(PROP_MAP)) {
    if (v[key] != null && v[key] !== '') decls.push(`${cssProp}:${v[key]}`)
  }
  if (v.bold) decls.push('font-weight:bold')
  if (v.italic) decls.push('font-style:italic')
  if (v.pageBreakBefore) decls.push('break-before:page')
  // « Garder avec le suivant » : empêche une coupure de page APRÈS ce bloc (un
  // titre ne reste pas seul en bas de page, détaché de son paragraphe).
  if (v.keepWithNext) decls.push('break-after:avoid')
  return decls.join(';')
}

// La valeur vit entre guillemets dans le sélecteur : espaces/accents/« ? » des
// noms de styles (« Puces ? », « mentions légales ») passent tels quels ; seuls
// un guillemet ou un antislash littéral casseraient la chaîne.
function escapeAttrValue(name) {
  return name.replace(/["\\]/g, '\\$&')
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

export function buildRunningTitlesCss(running, { bookTitle = '', chapterTitle = '' } = {}) {
  if (!running) return ''
  const { header, footer } = running
  if (!header?.enabled && !footer?.enabled) return ''

  const contentFor = (which) => {
    if (which === 'titre') return cssString(bookTitle)
    if (which === 'chapitre') return cssString(chapterTitle)
    if (which === 'folio') return '"?"' // numéro de page (placeholder)
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
      rules.push(`@page:${pageSel}{@${edge}-${pos}{content:${value};${box}}}`)
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
