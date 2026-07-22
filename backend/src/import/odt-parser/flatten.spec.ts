import { describe, it, expect } from 'vitest'
import { buildFlatNodes } from './flatten'

// Enveloppe un fragment de corps ODT dans un content.xml minimal complet
// (namespaces + automatic-styles optionnels). `styles` : XML brut inséré dans
// office:automatic-styles ; `body` : XML brut inséré dans office:text.
function odt(body: string, styles = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:automatic-styles>${styles}</office:automatic-styles>
  <office:body><office:text>${body}</office:text></office:body>
</office:document-content>`
}

describe('buildFlatNodes — détection des titres', () => {
  it('détecte le niveau via text:outline-level (balise h)', () => {
    const { flatNodes } = buildFlatNodes(odt('<text:h text:outline-level="2">Bloc</text:h>'))
    expect(flatNodes[0]).toMatchObject({ kind: 'heading', level: 2, text: 'Bloc' })
  })

  it('détecte le niveau via le nom de style (Heading 1/2/3)', () => {
    const { flatNodes } = buildFlatNodes(
      odt('<text:p text:style-name="Heading 1">Axe</text:p><text:p text:style-name="Heading 3">Art</text:p>'),
    )
    expect(flatNodes.map((n) => [n.kind, n.level])).toEqual([
      ['heading', 1],
      ['heading', 3],
    ])
  })

  it('traite un paragraphe ordinaire comme paragraph (level 0)', () => {
    const { flatNodes } = buildFlatNodes(odt('<text:p text:style-name="Standard">Du texte.</text:p>'))
    expect(flatNodes[0]).toMatchObject({ kind: 'paragraph', level: 0, text: 'Du texte.' })
  })
})

describe('buildFlatNodes — méta, listes, tableaux', () => {
  it('extrait auteur/titre depuis les styles méta sans les émettre en nœuds', () => {
    const { flatNodes, meta } = buildFlatNodes(
      odt('<text:p text:style-name="auteur">Jean Grimbert</text:p><text:p text:style-name="titre principal">Mon Livre</text:p>'),
    )
    expect(meta).toEqual({ auteur: 'Jean Grimbert', titreLivre: 'Mon Livre' })
    expect(flatNodes).toHaveLength(0)
  })

  it('aplati une liste et détecte son caractère ordonné via le style', () => {
    const { flatNodes } = buildFlatNodes(
      odt('<text:list text:style-name="L1"><text:list-item><text:p>Premier</text:p></text:list-item><text:list-item><text:p>Second</text:p></text:list-item></text:list>', '<text:list-style style:name="L1"><text:list-level-style-number/></text:list-style>'),
    )
    expect(flatNodes[0]).toMatchObject({ kind: 'list', listOrdered: true })
    expect(flatNodes[0].listItems).toEqual([
      { text: 'Premier', depth: 0 },
      { text: 'Second', depth: 0 },
    ])
  })

  it('préserve le gras/italique inline en <strong>/<em> (styles de caractère)', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:p text:style-name="Standard">' +
          '<text:span text:style-name="Tb">gras</text:span> ' +
          '<text:span text:style-name="Ti">ital</text:span> ' +
          '<text:span text:style-name="Tn">normal</text:span>' +
          '</text:p>',
        '<style:style style:name="Tb" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>' +
          '<style:style style:name="Ti" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>' +
          // Annule explicitement : ne doit PAS être enveloppé.
          '<style:style style:name="Tn" style:family="text"><style:text-properties fo:font-weight="normal" fo:font-style="normal"/></style:style>',
      ),
    )
    expect(flatNodes[0].text).toBe('<strong>gras</strong> <em>ital</em> normal')
  })

  it('compose gras + italique + surlignage inline sur un même span', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:p text:style-name="Standard"><text:span text:style-name="Tx">mot</text:span></text:p>',
        '<style:style style:name="Tx" style:family="text"><style:text-properties fo:font-weight="bold" fo:font-style="italic" fo:background-color="#ffff00"/></style:style>',
      ),
    )
    expect(flatNodes[0].text).toBe('<mark data-hl="#ffff00"><strong><em>mot</em></strong></mark>')
  })

  it('extrait le contenu d’un tableau', () => {
    const { flatNodes } = buildFlatNodes(
      odt('<table:table><table:table-row><table:table-cell><text:p>a</text:p></table:table-cell><table:table-cell><text:p>b</text:p></table:table-cell></table:table-row></table:table>'),
    )
    expect(flatNodes[0]).toMatchObject({ kind: 'table', tableData: [['a', 'b']] })
  })
})

describe('buildFlatNodes — signets, saut de page, ToC', () => {
  it('collecte les signets rattachés à un titre', () => {
    const { flatNodes } = buildFlatNodes(
      odt('<text:h text:outline-level="1">Cible<text:bookmark-start text:name="sig1"/></text:h>'),
    )
    expect(flatNodes[0].bookmarkNames).toEqual(['sig1'])
  })

  it('marque pageStart « page » sur un style à fo:break-before', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:h text:outline-level="1" text:style-name="Pbreak">Axe</text:h>',
        '<style:style style:name="Pbreak"><style:paragraph-properties fo:break-before="page"/></style:style>',
      ),
    )
    expect(flatNodes[0].pageStart).toBe('page')
  })

  it('laisse pageStart null sans saut ni contrainte', () => {
    const { flatNodes } = buildFlatNodes(odt('<text:p text:style-name="Standard">Rien.</text:p>'))
    expect(flatNodes[0].pageStart).toBeNull()
  })

  it('ne promeut pas un paragraphe vide à saut, mais le rattache en blanksBefore', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:p text:style-name="Blank"></text:p><text:p text:style-name="Standard">Contenu</text:p>',
        '<style:style style:name="Blank"><style:paragraph-properties fo:break-before="page"/></style:style>',
      ),
    )
    // Le vide n'est pas un nœud ; sa page blanche voyage sur le nœud suivant.
    expect(flatNodes).toHaveLength(1)
    expect(flatNodes[0]).toMatchObject({ text: 'Contenu', blanksBefore: ['page'] })
  })

  // Le recto-verso n'est PAS encodé par fo:break-before dans les .odt
  // LibreOffice, mais par un style:master-page-name → page-usage (validé sur le
  // manuscrit témoin). La contrainte vit sur le style NOMMÉ (« Heading 1 »),
  // héritée par les styles automatiques des axes.
  const stylesXml = (namedStyles: string) => `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:styles>${namedStyles}</office:styles>
  <office:automatic-styles>
    <style:page-layout style:name="LR" style:page-usage="right"/>
    <style:page-layout style:name="LL" style:page-usage="left"/>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Recto" style:page-layout-name="LR"/>
    <style:master-page style:name="Verso" style:page-layout-name="LL"/>
  </office:master-styles>
</office:document-styles>`

  it('résout recto/verso via master-page, et le côté prime un simple saut hérité', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        // Axe : style auto héritant de « Heading 1 » (recto), qui porte EN PLUS
        // son propre fo:break-before « page » — le côté doit l'emporter.
        '<text:h text:outline-level="1" text:style-name="Pax">Axe</text:h>' +
          '<text:p text:style-name="Pv">verso</text:p>' +
          '<text:p text:style-name="Pc">corps</text:p>',
        '<style:style style:name="Pax" style:parent-style-name="Heading_20_1"><style:paragraph-properties fo:break-before="page"/></style:style>' +
          '<style:style style:name="Pv" style:master-page-name="Verso"/>' +
          // Pc hérite d'un style de base à master-page VIDE : ce n'est pas un
          // saut (le piège « Paragraphes » du témoin, 846 paragraphes).
          '<style:style style:name="Pc" style:parent-style-name="Corps"/>',
      ),
      stylesXml(
        '<style:style style:name="Heading_20_1" style:family="paragraph" style:master-page-name="Recto"/>' +
          '<style:style style:name="Corps" style:family="paragraph" style:master-page-name=""/>',
      ),
    )
    expect(flatNodes.map((n) => n.pageStart)).toEqual(['recto', 'verso', null])
  })

  it('exclut la table des matières du flux mais en extrait les textes', () => {
    const { flatNodes, tocTexts } = buildFlatNodes(
      odt(
        '<text:table-of-content><text:index-body><text:p>1.Sylvestres\t3</text:p><text:p>2.Autres\t8</text:p></text:index-body></text:table-of-content><text:h text:outline-level="1">Sylvestres</text:h>',
      ),
    )
    // La ToC ne produit aucun nœud (sinon titres dupliqués) ; seul le vrai titre subsiste.
    expect(flatNodes).toHaveLength(1)
    expect(flatNodes[0].text).toBe('Sylvestres')
    expect(tocTexts).toEqual(['1.Sylvestres', '2.Autres'])
  })
})
