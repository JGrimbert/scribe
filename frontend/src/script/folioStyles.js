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
