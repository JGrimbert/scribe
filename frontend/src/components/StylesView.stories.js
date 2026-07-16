import { onUnmounted } from 'vue'
import StylesView from './StylesView.vue'
import '../assets/base.css'

// Écran de typologie. Le fetch est bouchonné ici (pas de backend en
// Storybook) ; les chiffres et les noms de styles sont ceux du manuscrit
// témoin, pour que la story montre la densité réelle et pas trois lignes
// inventées.

export default {
  title: 'Views/StylesView',
}

const INVENTORY = {
  styles: [
    { name: 'Paragraphes', count: 1789, headings: 0, sample: 'Introduction' },
    { name: 'Heading 3', count: 821, headings: 821, sample: 'Le Blaireau' },
    { name: 'mention sous titre', count: 586, headings: 0, sample: 'Essai' },
    { name: 'Text body', count: 498, headings: 0, sample: 'Axe suivanr :(b)L’Amorce' },
    { name: 'Voir', count: 183, headings: 0, sample: 'Super-héros : Zorro' },
    { name: 'Heading 2', count: 75, headings: 75, sample: 'Sylvestres' },
    { name: 'Premier paragraphe de thématique', count: 67, headings: 0, sample: 'Des crépuscules aux aurores, dans la sylve profonde…' },
    { name: 'Standard', count: 36, headings: 0, sample: 'A. −1. Petit mustélidé carnivore du nord' },
    { name: 'Table Contents', count: 28, headings: 0, sample: 'Chat noir ?' },
    { name: 'Chapeau Chapitre', count: 22, headings: 0, sample: 'Où par un coups du sort, les amoureux…' },
    { name: 'Puces ?', count: 15, headings: 0, sample: 'Sylvestres : La première ouverture' },
    { name: 'Citation paragraphe', count: 14, headings: 0, sample: '« Le ver luisant montre que le matin approche »' },
    { name: 'Tab bloc semantique', count: 13, headings: 0, sample: 'I. Les Phosphènes' },
    { name: 'Heading 1', count: 10, headings: 10, sample: 'La Lisière' },
    { name: 'Definition', count: 3, headings: 0, sample: 'A.− ZOOL.OGIE : Petit mammifère carnassier…' },
    { name: 'Couyard', count: 6, headings: 0, sample: '' },
  ],
  highlights: [
    { color: '#ffff00', paragraphs: 62, spans: 93, sample: '→ Pourquoi écrire, écrire sur soi ?' },
    { color: '#ffe994', paragraphs: 87, spans: 24, sample: '→ Tarentelle, vieille, trinaire, ternaire ?' },
    { color: '#ffff99', paragraphs: 14, spans: 43, sample: 'Plus encore que l’absence de borne…' },
    { color: '#ffff66', paragraphs: 1, spans: 0, sample: '' },
  ],
}

const SUGGESTED = {
  styles: {
    Paragraphes: 'corps',
    'Heading 3': 'titre',
    'mention sous titre': 'titre',
    'Text body': 'corps',
    Voir: 'renvoi',
    'Heading 2': 'titre',
    'Premier paragraphe de thématique': 'chapeau',
    Standard: 'corps',
    'Table Contents': 'tableau',
    'Chapeau Chapitre': 'chapeau',
    'Puces ?': 'liste',
    'Citation paragraphe': 'citation',
    'Tab bloc semantique': 'tableau',
    'Heading 1': 'titre',
    Definition: 'définition',
    Couyard: 'ornement',
  },
  highlights: { '#ffff00': 'annotation', '#ffe994': 'annotation', '#ffff99': 'annotation', '#ffff66': 'annotation' },
}

// Bouchon de fetch, restauré au démontage — sans quoi une story contaminerait
// les suivantes.
const withApi = (payload, { failSave = false } = {}) => (story) => ({
  components: { story },
  setup() {
    const real = window.fetch
    window.fetch = async (url, options) =>
      options?.method === 'PUT'
        ? failSave
          ? new Response(JSON.stringify({ message: ['Rôle inconnu : « nimportequoi »'] }), { status: 400 })
          : new Response(JSON.stringify({ ...payload, settled: true }), { status: 200 })
        : new Response(JSON.stringify(payload), { status: 200 })
    onUnmounted(() => { window.fetch = real })
  },
  template: '<story />',
})

export const NonArbitree = {
  decorators: [withApi({ inventory: INVENTORY, typology: null, suggested: SUGGESTED, settled: false })],
  render: () => ({ components: { StylesView }, template: '<StylesView />' }),
}

export const DejaArbitree = {
  decorators: [
    withApi({
      inventory: INVENTORY,
      // Décisions déjà prises, qui écrasent les suggestions : « mention sous
      // titre » n'est pas un titre pour l'auteur, c'est du chapeau.
      typology: { styles: { ...SUGGESTED.styles, 'mention sous titre': 'chapeau' }, highlights: SUGGESTED.highlights },
      suggested: SUGGESTED,
      settled: true,
    }),
  ],
  render: () => ({ components: { StylesView }, template: '<StylesView />' }),
}

// Document importé avant que le parseur ne relève les styles : rien à
// configurer, et le .odt n'est pas conservé pour rattraper le coup.
export const SansInventaire = {
  decorators: [
    withApi({ inventory: { styles: [], highlights: [] }, typology: null, suggested: { styles: {}, highlights: {} }, settled: false }),
  ],
  render: () => ({ components: { StylesView }, template: '<StylesView />' }),
}

export const EchecEnregistrement = {
  decorators: [
    withApi({ inventory: INVENTORY, typology: null, suggested: SUGGESTED, settled: false }, { failSave: true }),
  ],
  render: () => ({ components: { StylesView }, template: '<StylesView />' }),
}
