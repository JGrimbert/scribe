import { describe, expect, it } from 'vitest'
import { DOMParser } from 'xmldom'
import { buildVisualStyles, readPageFormat, toCm } from './visual'

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml')

// Chaîne réelle du manuscrit témoin : « Heading 1 » → « Heading » → « Standard »,
// chaque cran n'apportant qu'une partie de la mise en forme. C'est le cas qui
// condamne le saut unique d'`effectiveStyleName`.
const STYLES_XML = `<?xml version="1.0"?>
<office:document-styles
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:font-face-decls>
    <style:font-face style:name="Garamond" svg:font-family="Garamond, serif"/>
    <style:font-face style:name="Georgia2" svg:font-family="&apos;Google Sans&apos;, Roboto, Arial"/>
  </office:font-face-decls>
  <office:styles>
    <style:style style:name="Standard" style:family="paragraph">
      <style:paragraph-properties fo:line-height="100%" fo:text-align="start"/>
      <style:text-properties style:font-name="Garamond" fo:font-size="11pt"/>
    </style:style>
    <style:style style:name="Heading" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-top="0.423cm" fo:margin-bottom="0.212cm"/>
      <style:text-properties fo:hyphenate="true"/>
    </style:style>
    <style:style style:name="Heading_20_1" style:family="paragraph" style:parent-style-name="Heading">
      <style:paragraph-properties fo:text-align="center" fo:break-before="page"/>
      <style:text-properties style:font-name="Georgia2" fo:font-size="18pt" fo:font-weight="bold" fo:hyphenate="false"/>
    </style:style>
    <style:style style:name="Puces_20__3f_" style:family="paragraph" style:parent-style-name="Standard"/>
    <style:style style:name="Spacieux" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:margin-left="1cm" fo:margin-right="0.5cm"
          fo:widows="3" fo:orphans="2" fo:keep-with-next="always"/>
      <style:text-properties fo:font-variant="small-caps" fo:letter-spacing="0.05cm"/>
    </style:style>
    <style:style style:name="Souligne" style:family="text">
      <style:text-properties fo:font-style="italic"/>
    </style:style>
  </office:styles>
  <office:automatic-styles>
    <style:page-layout style:name="Mpm1">
      <style:page-layout-properties fo:page-width="14.801cm" fo:page-height="21.001cm"
          fo:margin-top="1cm" fo:margin-bottom="1.199cm" fo:margin-left="2cm" fo:margin-right="2cm"/>
    </style:page-layout>
    <style:page-layout style:name="Mpm5">
      <style:page-layout-properties fo:page-width="22cm" fo:page-height="11cm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Envelope" style:page-layout-name="Mpm5"/>
    <style:master-page style:name="Standard" style:page-layout-name="Mpm1"/>
  </office:master-styles>
</office:document-styles>`

const CONTENT_XML = `<?xml version="1.0"?>
<office:document-content
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:automatic-styles>
    <style:style style:name="P26" style:family="paragraph" style:parent-style-name="Heading_20_1"/>
  </office:automatic-styles>
</office:document-content>`

describe('buildVisualStyles', () => {
  const visuals = buildVisualStyles(parse(CONTENT_XML), parse(STYLES_XML))

  it("résout la chaîne d'héritage en entier, pas un seul saut", () => {
    // Le centrage vient de Heading 1, les marges de Heading, l'interligne de
    // Standard : les trois crans doivent être présents dans le même objet.
    expect(visuals['Heading 1']).toMatchObject({
      align: 'center',
      marginTop: '0.423cm',
      lineHeight: '100%',
    })
  })

  it('résout style:font-name via les font-face, en vraie famille CSS', () => {
    // « Georgia2 » n'est pas une police : c'est une référence interne. Telle
    // quelle, le navigateur l'ignore et rend tout en police par défaut.
    expect(visuals['Heading 1'].fontFamily).toBe("'Google Sans', Roboto, Arial")
    expect(visuals['Standard'].fontFamily).toBe('Garamond, serif')
  })

  it("laisse l'enfant écraser son parent, propriété par propriété", () => {
    expect(visuals['Heading 1'].fontSize).toBe('18pt') // Standard disait 11pt
    expect(visuals['Heading 1'].bold).toBe(true)
    expect(visuals['Heading 1'].lineHeight).toBe('100%') // hérité, jamais redéfini
  })

  it('décode les noms de styles ODT', () => {
    expect(visuals['Puces ?']).toBeDefined()
    expect(visuals['Puces_20__3f_']).toBeUndefined()
  })

  it('ignore les styles qui ne sont pas de paragraphe', () => {
    // Un style de caractère porte des surlignages (cf. xml.ts), pas
    // l'apparence d'un paragraphe : le mélanger fausserait l'aperçu.
    expect(visuals['Souligne']).toBeUndefined()
  })

  it('rend fo:break-before en booléen', () => {
    expect(visuals['Heading 1'].pageBreakBefore).toBe(true)
    expect(visuals['Standard'].pageBreakBefore).toBeUndefined()
  })

  it('lit retraits G/D, petites capitales et interlettrage', () => {
    expect(visuals['Spacieux']).toMatchObject({
      marginLeft: '1cm',
      marginRight: '0.5cm',
      fontVariant: 'small-caps',
      letterSpacing: '0.05cm',
    })
  })

  it('lit veuves/orphelines (nombres) et garder-avec-le-suivant (booléen)', () => {
    expect(visuals['Spacieux']).toMatchObject({ widows: 3, orphans: 2, keepWithNext: true })
  })

  it('rend fo:hyphenate en booléen, propagé par héritage, undefined si jamais déclaré', () => {
    // La cascade Folio distingue « défini » (le style ou un ancêtre le porte) de
    // « muet » (laisse le niveau moins spécifique décider).
    expect(visuals['Heading'].hyphenate).toBe(true) // déclaré
    expect(visuals['Heading 1'].hyphenate).toBe(false) // l'enfant surcharge à false
    expect(visuals['Puces ?'].hyphenate).toBeUndefined() // parent Standard muet
    expect(visuals['Standard'].hyphenate).toBeUndefined() // jamais déclaré
  })
})

describe('readPageFormat', () => {
  it('lit le master-page « Standard », pas le premier venu', () => {
    // L'enveloppe (22 × 11) est déclarée AVANT Standard dans master-styles :
    // prendre le premier page-layout donnerait un livre au format enveloppe.
    expect(readPageFormat(parse(STYLES_XML))).toEqual({
      widthCm: 14.801,
      heightCm: 21.001,
      marginTopCm: 1,
      marginBottomCm: 1.199,
      marginLeftCm: 2,
      marginRightCm: 2,
    })
  })

  it('rend undefined plutôt que d’inventer une page', () => {
    const noMaster = `<?xml version="1.0"?><office:document-styles
        xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>`
    expect(readPageFormat(parse(noMaster))).toBeUndefined()
  })
})

describe('toCm', () => {
  it('convertit les unités ODT courantes', () => {
    expect(toCm('2cm')).toBe(2)
    expect(toCm('10mm')).toBeCloseTo(1)
    expect(toCm('1in')).toBeCloseTo(2.54)
    expect(toCm('72pt')).toBeCloseTo(2.54)
  })

  it('rend null sur une valeur inexploitable', () => {
    expect(toCm('auto')).toBeNull()
    expect(toCm('')).toBeNull()
    expect(toCm(null)).toBeNull()
  })
})
