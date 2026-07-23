import { describe, it, expect } from 'vitest'
import { buildVisualsCss, buildPageCss } from './folioStyles.js'

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
})

describe('buildPageCss', () => {
  it('produit un @page size + margin (ordre haut/droite/bas/gauche)', () => {
    const css = buildPageCss({
      widthCm: 14.801,
      heightCm: 21.001,
      marginTopCm: 1,
      marginRightCm: 2,
      marginBottomCm: 1.199,
      marginLeftCm: 2,
    })
    expect(css).toBe('@page{size:14.801cm 21.001cm;margin:1cm 2cm 1.199cm 2cm;}')
  })

  it('rend une chaîne vide sans format (repli paged.css A5)', () => {
    expect(buildPageCss(null)).toBe('')
  })
})
