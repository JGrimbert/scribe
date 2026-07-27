import PageDiagram from './PageDiagram.vue'

// Aperçu schématique recto/verso (marges miroir, en-tête/pied, folio). Composant
// présentationnel pur — idéal pour Storybook.
export default {
  title: 'Config/PageDiagram',
  component: PageDiagram,
}

const A5 = { widthCm: 14.8, heightCm: 21 }

const band = (o = {}) => ({ enabled: false, recto: 'chapitre', verso: 'titre', heightCm: null, justification: 'centre', ...o })
const rt = (o = {}) => ({
  header: band(o.header),
  footer: band(o.footer),
})

export const MargesSymetriques = {
  args: {
    pageSize: A5,
    margins: { topCm: 2, bottomCm: 2, innerCm: 2, outerCm: 2 },
    runningTitles: rt(),
  },
}

export const MargesMiroir = {
  args: {
    pageSize: A5,
    margins: { topCm: 2, bottomCm: 2.4, innerCm: 1.2, outerCm: 3 },
    runningTitles: rt({ header: { enabled: true, justification: 'regard' } }),
  },
}

export const EnteteChapitrePiedFolioCentre = {
  args: {
    pageSize: A5,
    margins: { topCm: 2, bottomCm: 2, innerCm: 1.5, outerCm: 2.5 },
    runningTitles: rt({
      header: { enabled: true, justification: 'regard' },
      footer: { enabled: true, recto: 'folio', verso: 'folio', justification: 'centre' },
    }),
  },
}

export const FolioEnRegard = {
  args: {
    pageSize: A5,
    margins: { topCm: 2, bottomCm: 2, innerCm: 1.2, outerCm: 3 },
    runningTitles: rt({
      header: { enabled: true, justification: 'regard' },
      footer: { enabled: true, recto: 'folio', verso: 'folio', justification: 'regard' },
    }),
  },
}

export const A4PaysageParFormat = {
  args: {
    pageSize: { widthCm: 21, heightCm: 29.7 },
    margins: { topCm: 2.5, bottomCm: 2.5, innerCm: 2, outerCm: 3 },
    runningTitles: rt({
      header: { enabled: true, heightCm: 1, justification: 'regard' },
      footer: { enabled: true, recto: 'folio', verso: 'folio', justification: 'centre' },
    }),
  },
}
