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
  textIndent: 'text-indent',
  lineHeight: 'line-height',
}

function declarations(v) {
  const decls = []
  for (const [key, cssProp] of Object.entries(PROP_MAP)) {
    if (v[key] != null && v[key] !== '') decls.push(`${cssProp}:${v[key]}`)
  }
  if (v.bold) decls.push('font-weight:bold')
  if (v.italic) decls.push('font-style:italic')
  if (v.pageBreakBefore) decls.push('break-before:page')
  return decls.join(';')
}

// La valeur vit entre guillemets dans le sélecteur : espaces/accents/« ? » des
// noms de styles (« Puces ? », « mentions légales ») passent tels quels ; seuls
// un guillemet ou un antislash littéral casseraient la chaîne.
function escapeAttrValue(name) {
  return name.replace(/["\\]/g, '\\$&')
}

// Format de page (dimensions + marges, en cm) → règle @page pour Paged.js.
// Passée à preview() APRÈS paged.css : ses descripteurs @page l'emportent (les
// règles @page fusionnent, la dernière déclaration gagne). Vide si pas de format
// relevé → paged.css garde son A5 par défaut.
export function buildPageCss(page) {
  if (!page) return ''
  const { widthCm, heightCm, marginTopCm, marginRightCm, marginBottomCm, marginLeftCm } = page
  return `@page{size:${widthCm}cm ${heightCm}cm;margin:${marginTopCm}cm ${marginRightCm}cm ${marginBottomCm}cm ${marginLeftCm}cm;}`
}

// Épingle les variables de géométrie de page de Paged.js (`:root`) avec `!important`.
// Paged ré-injecte son polyfill dans le `<head>` PARTAGÉ de l'iframe à CHAQUE
// pagination, et ce polyfill remet ces variables à leur défaut US Letter avant que
// l'override `@page` (A5) ne repasse. Comme le double-buffer garde l'ancien rendu
// affiché pendant la pagination, ce basculement était visible sur le contenu — la
// page « changeait de taille » un instant (cf. useFolioFrame). L'épingle persistante
// neutralise ce transitoire. Valeurs : format du .odt (`page`) ou A5 par défaut
// (paged.css). Marges uniformes (le modèle `page` ne porte pas de miroir recto/verso).
export function buildPagePinCss(page) {
  const w = page ? `${page.widthCm}cm` : '148mm'
  const h = page ? `${page.heightCm}cm` : '210mm'
  const mt = page ? `${page.marginTopCm}cm` : '22mm'
  const mr = page ? `${page.marginRightCm}cm` : '20mm'
  const mb = page ? `${page.marginBottomCm}cm` : '22mm'
  const ml = page ? `${page.marginLeftCm}cm` : '20mm'
  return ':root{'
    + `--pagedjs-width:${w}!important;--pagedjs-height:${h}!important;`
    + `--pagedjs-width-left:${w}!important;--pagedjs-width-right:${w}!important;`
    + `--pagedjs-height-left:${h}!important;--pagedjs-height-right:${h}!important;`
    + `--pagedjs-pagebox-width:${w}!important;--pagedjs-pagebox-height:${h}!important;`
    + `--pagedjs-margin-top:${mt}!important;--pagedjs-margin-right:${mr}!important;`
    + `--pagedjs-margin-bottom:${mb}!important;--pagedjs-margin-left:${ml}!important;`
    + '}'
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
