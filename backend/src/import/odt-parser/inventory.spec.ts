import { describe, it, expect } from 'vitest'
import { buildFlatNodes } from './flatten'

// Même enveloppe que flatten.spec.ts : `styles` va dans office:automatic-styles,
// `body` dans office:text.
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

// Style automatique héritant d'un style nommé (ce que produit LibreOffice dès
// qu'un paragraphe porte la moindre mise en forme directe).
const auto = (name: string, parent: string, background?: string) =>
  `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${parent}">${
    background ? `<style:text-properties fo:background-color="${background}"/>` : ''
  }</style:style>`

const span = (name: string, background: string) =>
  `<style:style style:name="${name}" style:family="text"><style:text-properties fo:background-color="${background}"/></style:style>`

describe('résolution des styles', () => {
  it('résout un style automatique vers son style nommé parent', () => {
    const { flatNodes } = buildFlatNodes(
      odt('<text:p text:style-name="P26">Du texte.</text:p>', auto('P26', 'Paragraphes')),
    )
    expect(flatNodes[0]).toMatchObject({ styleName: 'P26', effectiveStyle: 'Paragraphes' })
  })

  it('garde le style brut comme source de la détection de niveau', () => {
    // Le style brut reste « Heading_20_1 » (ce que lit headingLevel) alors que
    // l'affichage voit « Titre maison ».
    const { flatNodes } = buildFlatNodes(
      odt('<text:p text:style-name="Heading_20_1">Axe</text:p>'),
    )
    expect(flatNodes[0]).toMatchObject({ level: 1, styleName: 'Heading_20_1', effectiveStyle: 'Heading 1' })
  })

  it('décode les caractères échappés du nom de style (_20_, _3f_)', () => {
    const { inventory } = buildFlatNodes(
      odt('<text:p text:style-name="Puces_20__3f_">Item</text:p>'),
    )
    expect(inventory.styles[0].name).toBe('Puces ?')
  })
})

describe('inventaire des styles', () => {
  it('compte les usages, repère les titres et garde un extrait', () => {
    const { inventory } = buildFlatNodes(
      odt(
        `<text:p text:style-name="P1">Premier paragraphe.</text:p>
         <text:p text:style-name="P2">Second.</text:p>
         <text:h text:outline-level="1" text:style-name="P3">Un titre</text:h>`,
        auto('P1', 'Paragraphes') + auto('P2', 'Paragraphes') + auto('P3', 'Heading_20_1'),
      ),
    )
    expect(inventory.styles).toEqual([
      { name: 'Paragraphes', count: 2, headings: 0, sample: 'Premier paragraphe.' },
      { name: 'Heading 1', count: 1, headings: 1, sample: 'Un titre' },
    ])
  })

  it('inventorie les styles employés DANS les tableaux', () => {
    // Régression : ces paragraphes n'existent pas en tant que FlatNode (le
    // tableau est aplati en données) — construire l'inventaire sur les
    // FlatNode faisait disparaître le style « Voir » du manuscrit témoin.
    const { inventory } = buildFlatNodes(
      odt(
        `<table:table><table:table-row><table:table-cell>
           <text:p text:style-name="Voir">Super-héros : Zorro</text:p>
         </table:table-cell></table:table-row></table:table>`,
      ),
    )
    expect(inventory.styles).toContainEqual({
      name: 'Voir',
      count: 1,
      headings: 0,
      sample: 'Super-héros : Zorro',
    })
  })

  it('écarte les styles de la table des matières (posés par LibreOffice, pas par l’auteur)', () => {
    const { inventory } = buildFlatNodes(
      odt(
        `<text:table-of-content><text:index-body>
           <text:p text:style-name="Contents_20_1">Sylvestres\t3</text:p>
         </text:index-body></text:table-of-content>
         <text:p text:style-name="Paragraphes">Du corps.</text:p>`,
      ),
    )
    expect(inventory.styles.map((s) => s.name)).toEqual(['Paragraphes'])
  })

  it('compte un paragraphe vide comme usage, sans en faire un extrait', () => {
    const { inventory } = buildFlatNodes(
      odt(
        `<text:p text:style-name="Vide"></text:p><text:p text:style-name="Vide">Enfin du texte.</text:p>`,
      ),
    )
    expect(inventory.styles[0]).toEqual({ name: 'Vide', count: 2, headings: 0, sample: 'Enfin du texte.' })
  })
})

describe('inventaire des surlignages', () => {
  it('sépare surlignage de paragraphe entier et surlignage inline', () => {
    const { inventory } = buildFlatNodes(
      odt(
        `<text:p text:style-name="P7">Paragraphe entier surligné.</text:p>
         <text:p text:style-name="P1">Un mot <text:span text:style-name="T47">surligné</text:span> ici.</text:p>`,
        auto('P7', 'Paragraphes', '#ffff00') + auto('P1', 'Paragraphes') + span('T47', '#ffff00'),
      ),
    )
    expect(inventory.highlights).toEqual([
      { color: '#ffff00', paragraphs: 1, spans: 1, sample: 'Paragraphe entier surligné.' },
    ])
  })

  it('ne prend pas le fond blanc pour un surlignage', () => {
    // LibreOffice pose fo:background-color="#ffffff" sur quantité de styles :
    // le retenir noierait la typologie sous une couleur qui ne veut rien dire.
    const { inventory } = buildFlatNodes(
      odt('<text:p text:style-name="P6">Fond blanc.</text:p>', auto('P6', 'Paragraphes', '#ffffff')),
    )
    expect(inventory.highlights).toEqual([])
  })

  it('classe les couleurs par usage total décroissant', () => {
    const { inventory } = buildFlatNodes(
      odt(
        `<text:p text:style-name="Pa">Ambre.</text:p>
         <text:p text:style-name="Pj">Jaune un.</text:p>
         <text:p text:style-name="Pj">Jaune deux.</text:p>`,
        auto('Pa', 'Paragraphes', '#ffe994') + auto('Pj', 'Paragraphes', '#ffff00'),
      ),
    )
    expect(inventory.highlights.map((h) => [h.color, h.paragraphs])).toEqual([
      ['#ffff00', 2],
      ['#ffe994', 1],
    ])
  })
})

describe('surlignages inline dans le texte', () => {
  it('préserve un span surligné en <mark data-hl>', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:p text:style-name="P1">Un mot <text:span text:style-name="T47">à reprendre</text:span> ici.</text:p>',
        auto('P1', 'Paragraphes') + span('T47', '#ffff00'),
      ),
    )
    expect(flatNodes[0].text).toBe('Un mot <mark data-hl="#ffff00">à reprendre</mark> ici.')
  })

  it('n’enveloppe pas un span sans surlignage', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:p text:style-name="P1">Un mot <text:span text:style-name="Emphasis">accentué</text:span> ici.</text:p>',
        auto('P1', 'Paragraphes'),
      ),
    )
    expect(flatNodes[0].text).toBe('Un mot accentué ici.')
  })

  it('préserve un lien interne à l’intérieur d’un surlignage', () => {
    const { flatNodes } = buildFlatNodes(
      odt(
        '<text:p text:style-name="P1"><text:span text:style-name="T47">voir <text:a xlink:href="#sig">le blaireau</text:a></text:span></text:p>',
        auto('P1', 'Paragraphes') + span('T47', '#ffff00'),
      ),
    )
    expect(flatNodes[0].text).toBe(
      '<mark data-hl="#ffff00">voir <a data-bookmark="sig">le blaireau</a></mark>',
    )
  })
})
