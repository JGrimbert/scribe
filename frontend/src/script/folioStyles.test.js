import { describe, it, expect } from 'vitest'
import { buildVisualsCss, buildHyphenationCss, buildPageCss, buildRunningTitlesCss, buildFormatGuidesCss, runningReserves } from './folioStyles.js'

describe('buildVisualsCss', () => {
  it('traduit un StyleVisual en règle préfixée .pagedjs_page_content', () => {
    const css = buildVisualsCss({
      Definition: { fontFamily: 'Calibri', fontSize: '10.5pt', align: 'justify', textIndent: '0cm' },
    })
    expect(css).toBe(
      '.pagedjs_page_content [data-style="Definition"]{font-family:Calibri;font-size:10.5pt;text-align:justify;text-indent:0cm}',
    )
  })

  it('émet font-weight/font-style depuis les booléens bold/italic', () => {
    const css = buildVisualsCss({ 'Heading 3': { bold: true, italic: false, align: 'center', fontSize: '16pt' } })
    expect(css).toContain('[data-style="Heading 3"]')
    expect(css).toContain('font-weight:bold')
    expect(css).toContain('text-align:center')
    expect(css).not.toContain('font-style:italic')
  })

  it('ignore les clés vides/absentes et n’émet pas de règle vide', () => {
    const css = buildVisualsCss({ Vide: {}, Standard: { align: 'start', fontSize: '' } })
    expect(css).toBe('.pagedjs_page_content [data-style="Standard"]{text-align:start}')
  })

  it('échappe les guillemets/antislash dans le nom de style', () => {
    const css = buildVisualsCss({ 'a"b': { align: 'left' } })
    expect(css).toContain('[data-style="a\\"b"]')
  })

  it('rend une chaîne vide pour des visuals nuls/vides', () => {
    expect(buildVisualsCss(null)).toBe('')
    expect(buildVisualsCss({})).toBe('')
  })

  it('émet widows/orphans et break-after:avoid (garder avec le suivant)', () => {
    const css = buildVisualsCss({ Titre: { widows: 3, orphans: 2, keepWithNext: true } })
    expect(css).toContain('widows:3')
    expect(css).toContain('orphans:2')
    expect(css).toContain('break-after:avoid')
  })
})

describe('buildHyphenationCss', () => {
  const visuals = {
    Standard: { fontSize: '11pt' }, // muet sur la césure
    Corps: { hyphenate: true }, // explicitement césuré
    Titre: { hyphenate: false }, // explicitement non césuré
  }

  it('global OFF : ne césure que les styles explicitement à true', () => {
    const css = buildHyphenationCss(visuals, { global: false })
    expect(css).toBe('.pagedjs_page_content [data-style="Corps"]{-webkit-hyphens:auto;hyphens:auto}')
  })

  it('global ON : césure d’ensemble + exceptions manual pour les styles à false', () => {
    const css = buildHyphenationCss(visuals, { global: true })
    expect(css).toContain('.pagedjs_page_content{-webkit-hyphens:auto;hyphens:auto}')
    expect(css).toContain('[data-style="Titre"]{-webkit-hyphens:manual;hyphens:manual}')
    // Un style muet n'a pas d'exception : le défaut global le prend.
    expect(css).not.toContain('[data-style="Standard"]')
    // Un style déjà à true n'a pas besoin d'exception non plus.
    expect(css).not.toContain('[data-style="Corps"]')
  })

  it('défaut global absent = OFF', () => {
    expect(buildHyphenationCss(visuals)).toBe('.pagedjs_page_content [data-style="Corps"]{-webkit-hyphens:auto;hyphens:auto}')
  })

  it('rend une chaîne vide sans visuals ou sans césure déclarée', () => {
    expect(buildHyphenationCss(null)).toBe('')
    expect(buildHyphenationCss({ Standard: { fontSize: '11pt' } }, { global: false })).toBe('')
  })
})

describe('buildPageCss', () => {
  const odt = { widthCm: 14.801, heightCm: 21.001, marginTopCm: 1, marginRightCm: 2, marginBottomCm: 1.199, marginLeftCm: 2 }

  it('produit un @page size + margin .odt (ordre haut/droite/bas/gauche)', () => {
    expect(buildPageCss(odt)).toBe('@page{size:14.801cm 21.001cm;margin:1cm 2cm 1.199cm 2cm;}')
  })

  it('rend une chaîne vide sans format ni marges (repli paged.css A5)', () => {
    expect(buildPageCss(null)).toBe('')
  })

  it('marges MIROIR : recto (intérieur à gauche) + verso inversé', () => {
    const css = buildPageCss(odt, { topCm: 2, bottomCm: 2, innerCm: 1.5, outerCm: 3 })
    // recto : haut / extérieur(droite) / bas / intérieur(gauche)
    expect(css).toContain('@page{size:14.801cm 21.001cm;margin:2cm 3cm 2cm 1.5cm;}')
    // verso : miroir (intérieur à droite, extérieur à gauche)
    expect(css).toContain('@page:left{margin:2cm 1.5cm 2cm 3cm;}')
  })

  it('marges miroir symétriques : pas de règle @page:left superflue', () => {
    const css = buildPageCss(odt, { topCm: 2, bottomCm: 2, innerCm: 2, outerCm: 2 })
    expect(css).not.toContain('@page:left')
  })

  it('réserves des titres courants : ajoutées au haut/bas seulement (le corps se réduit)', () => {
    const css = buildPageCss({ ...odt, marginTopCm: 2, marginBottomCm: 2 }, null, { top: 1, bottom: 1.2 })
    // haut = 2 + 1 = 3 ; bas = 2 + 1.2 = 3.2 ; droite/gauche inchangées
    expect(css).toBe('@page{size:14.801cm 21.001cm;margin:3cm 2cm 3.2cm 2cm;}')
  })
})

describe('runningReserves', () => {
  const band = (o = {}) => ({ enabled: false, recto: 'chapitre', verso: 'titre', heightCm: null, justification: 'centre', ...o })
  const rt = (o = {}) => ({ header: band(), footer: band(), ...o })

  it('rien d’actif → aucune réserve', () => {
    expect(runningReserves(null)).toEqual({ top: 0, bottom: 0 })
    expect(runningReserves(rt())).toEqual({ top: 0, bottom: 0 })
  })

  it('en-tête → réserve en haut (hauteur défaut 0,6 + blanc 0,4 = 1)', () => {
    expect(runningReserves(rt({ header: band({ enabled: true }) }))).toEqual({ top: 1, bottom: 0 })
    expect(runningReserves(rt({ header: band({ enabled: true, heightCm: 1 }) })).top).toBeCloseTo(1.4)
  })

  it('pied → réserve en bas (hauteur fixée + blanc)', () => {
    expect(runningReserves(rt({ footer: band({ enabled: true, heightCm: 0.8 }) })).bottom).toBeCloseTo(1.2)
    expect(runningReserves(rt({ footer: band({ enabled: true }) }))).toEqual({ top: 0, bottom: 1 })
  })
})

describe('buildRunningTitlesCss', () => {
  const opts = { bookTitle: 'Le Livre', chapterTitle: "L'aube" }
  const band = (o = {}) => ({ enabled: false, recto: 'chapitre', verso: 'titre', heightCm: null, justification: 'centre', ...o })
  const rt = (o = {}) => ({ header: band(), footer: band(), ...o })

  it('rend rien si tout est désactivé ou absent', () => {
    expect(buildRunningTitlesCss(null, opts)).toBe('')
    expect(buildRunningTitlesCss(rt(), opts)).toBe('')
  })

  it('en-tête centré : verso = titre du livre (paires), recto = chapitre (impaires)', () => {
    const css = buildRunningTitlesCss(rt({ header: band({ enabled: true }) }), opts)
    expect(css).toContain('@page:right{@top-center{content:"L\'aube";')
    expect(css).toContain('@page:left{@top-center{content:"Le Livre";')
  })

  it('justification « en regard » : bord extérieur (droite recto, gauche verso)', () => {
    const css = buildRunningTitlesCss(rt({ header: band({ enabled: true, justification: 'regard' }) }), opts)
    expect(css).toContain('@page:right{@top-right{content:"L\'aube";')
    expect(css).toContain('@page:left{@top-left{content:"Le Livre";')
    // Pas de contenu au centre (le seul @top-center est la suppression :first).
    expect(css).not.toContain('@top-center{content:"')
  })

  it('folio = contenu du pied ; « XX » placeholder', () => {
    const centre = buildRunningTitlesCss(rt({ footer: band({ enabled: true, recto: 'folio', verso: 'folio' }) }), opts)
    expect(centre).toContain('@page:right{@bottom-center{content:"XX";')
    expect(centre).toContain('@page:left{@bottom-center{content:"XX";')

    const regard = buildRunningTitlesCss(rt({ footer: band({ enabled: true, recto: 'folio', verso: 'folio', justification: 'regard' }) }), opts)
    expect(regard).toContain('@page:right{@bottom-right{content:"XX";')
    expect(regard).toContain('@page:left{@bottom-left{content:"XX";')
  })

  it('swapParity échange la PAGE ciblée (planche), pas le côté logique', () => {
    // regard : recto→droite, verso→gauche ; swap → recto sur @page:left, verso sur :right.
    const css = buildRunningTitlesCss(
      rt({ footer: band({ enabled: true, recto: 'folio', verso: 'folio', justification: 'regard' }) }),
      { ...opts, swapParity: true },
    )
    expect(css).toContain('@page:left{@bottom-right{content:"XX";')
    expect(css).toContain('@page:right{@bottom-left{content:"XX";')
  })

  it('l’en-tête colle au bas de sa marge, le pied au haut (vers l’empagement)', () => {
    const h = buildRunningTitlesCss(rt({ header: band({ enabled: true }) }), opts)
    expect(h).toContain('vertical-align:bottom')
    expect(h).toContain('padding-bottom:0.4cm')
    const f = buildRunningTitlesCss(rt({ footer: band({ enabled: true, recto: 'titre', verso: 'titre' }) }), opts)
    expect(f).toContain('vertical-align:top')
    expect(f).toContain('padding-top:0.4cm')
  })

  it('supprime toutes les margin boxes sur la première page (chapitre)', () => {
    const css = buildRunningTitlesCss(rt({ header: band({ enabled: true }) }), opts)
    expect(css).toContain('@page:first{')
    expect(css).toContain('@top-center{content:none}')
    expect(css).toContain('@bottom-right{content:none}')
  })

  it('« aucun » n’émet pas de margin box pour ce côté', () => {
    const css = buildRunningTitlesCss(rt({ header: band({ enabled: true, verso: 'aucun', recto: 'chapitre' }) }), opts)
    expect(css).toContain('@page:right{@top-center{content:"L\'aube"')
    expect(css).not.toContain('@page:left{@top-center')
  })

  it('échappe les guillemets du titre', () => {
    const css = buildRunningTitlesCss(rt({ header: band({ enabled: true, recto: 'aucun', verso: 'titre' }) }), { bookTitle: 'a"b', chapterTitle: '' })
    expect(css).toContain('content:"a\\"b"')
  })
})

describe('buildFormatGuidesCss', () => {
  const band = (o = {}) => ({ enabled: false, recto: 'chapitre', verso: 'titre', heightCm: null, justification: 'centre', ...o })
  const rt = (o = {}) => ({ header: band(), footer: band(), ...o })

  it('bandes désactivées : croix + masquage seuls, aucun cadre', () => {
    const css = buildFormatGuidesCss(rt())
    expect(css).toContain('.pagedjs_margin-content{display:none;}')
    expect(css).not.toContain('::before')
    expect(css).not.toContain('::after')
  })

  it('en-tête : CADRE bordé pleine largeur conservé + gris interne centré réduit', () => {
    const css = buildFormatGuidesCss(rt({ header: band({ enabled: true }) }))
    // Le cadre : pleine largeur, bordé (ne PAS le supprimer).
    expect(css).toContain('.pagedjs_page_content::before{')
    expect(css).toMatch(/::before\{[^}]*left:0;right:0;/)
    expect(css).toMatch(/::before\{[^}]*border:1px solid/)
    // Le gris typographique interne : largeur d'une ligne, centré.
    expect(css).toContain('background-size:40% 100%')
    expect(css).toContain('background-position:center center')
  })

  it('« en regard » : gris interne au bord extérieur, en miroir (recto gauche, verso droite)', () => {
    const css = buildFormatGuidesCss(rt({ header: band({ enabled: true, justification: 'regard' }) }))
    expect(css).toMatch(/\.pagedjs_right_page[^}]*background-position:left center;/)
    expect(css).toMatch(/\.pagedjs_left_page[^}]*background-position:right center;/)
  })

  it('respecte « aucun » : cadre présent mais aucun gris du côté sans contenu', () => {
    const css = buildFormatGuidesCss(rt({ header: band({ enabled: true, recto: 'chapitre', verso: 'aucun' }) }))
    expect(css).toContain('.pagedjs_page_content::before{') // cadre toujours là
    expect(css).toContain('.pagedjs_right_page .pagedjs_page_content::before')
    expect(css).not.toContain('.pagedjs_left_page .pagedjs_page_content::before')
  })

  it('folio en pied → gris à la largeur d’un numéro de page (pas 40%)', () => {
    const css = buildFormatGuidesCss(rt({ footer: band({ enabled: true, recto: 'folio', verso: 'folio' }) }))
    expect(css).toContain('.pagedjs_page_content::after{')
    expect(css).toContain('background-size:1.2cm 100%')
    expect(css).not.toContain('background-size:40% 100%')
  })

  it('pied → ::after ancré sous l’empagement, hauteur fixée respectée', () => {
    const css = buildFormatGuidesCss(rt({ footer: band({ enabled: true, heightCm: 0.8 }) }))
    expect(css).toContain('.pagedjs_page_content::after')
    expect(css).toContain('top:calc(100% + 0.4cm)')
    expect(css).toContain('height:0.8cm')
  })
})
