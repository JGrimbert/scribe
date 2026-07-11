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

  it('marque hasPageBreak sur un style à fo:break-before', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:h text:outline-level="1" text:style-name="Pbreak">Axe</text:h>',
        '<style:style style:name="Pbreak"><style:paragraph-properties fo:break-before="page"/></style:style>',
      ),
    )
    expect(flatNodes[0].hasPageBreak).toBe(true)
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
