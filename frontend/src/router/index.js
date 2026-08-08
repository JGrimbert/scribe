import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../components/home/HomeView.vue'
import DocumentLayout from '../components/layout/DocumentLayout.vue'
import AnalyseView from '../components/analyse/AnalyseView.vue'
import EditorView from '../components/editor/EditorView.vue'
import MaquetteView from '../components/maquette/MaquetteView.vue'
import MaquetteVocabulairePane from '../components/maquette/panes/MaquetteVocabulairePane.vue'
import MaquetteFormatPane from '../components/maquette/panes/MaquetteFormatPane.vue'
import MaquetteLiminairePane from '../components/maquette/panes/MaquetteLiminairePane.vue'
import MaquetteChapitragePane from '../components/maquette/panes/MaquetteChapitragePane.vue'
import MaquetteAnnotationsPane from '../components/maquette/panes/MaquetteAnnotationsPane.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  {
    path: '/documents/:id',
    name: 'document-layout',
    component: DocumentLayout,
    children: [
      // La maquette est la vue par défaut du document : une COQUILLE
      // (MaquetteView) qui garde barres, sommaire, dock et l'UNIQUE FolioView
      // persistant, et route ses JALONS en enfants. Chaque jalon = une route ; le
      // jalon de tête « titredulivre » (vocabulaire/recherche) est le défaut, hors
      // URL et hors fil d'Ariane. Le leaf par défaut garde le name `maquette` :
      // tous les `{name:'maquette'}` / `/documents/:id` existants y atterrissent.
      // L'analyse garde son name `document` mais vit sur `/analyse` — plus aucune
      // icône n'y mène, on n'y accède qu'en tapant l'URL (choix délibéré).
      {
        path: '',
        component: MaquetteView,
        children: [
          { path: '', name: 'maquette', component: MaquetteVocabulairePane },
          { path: 'Format', name: 'maquette-format', component: MaquetteFormatPane },
          { path: 'Liminaire/:n(\\d+)?', name: 'maquette-liminaire', component: MaquetteLiminairePane },
          { path: 'Chapitrage/:n(\\d+)?', name: 'maquette-chapitrage', component: MaquetteChapitragePane },
          // Annotations : le folio coule les fragments ANNOTÉS en lambeaux (comme la
          // recherche) ; le pane pose EN REGARD le panneau de validation (avancement ·
          // seuil · chapitres en attente) et, en tête des lambeaux, le menu de filtres.
          { path: 'Annotations', name: 'maquette-annotations', component: MaquetteAnnotationsPane },
        ],
      },
      { path: 'analyse', name: 'document', component: AnalyseView },
      // L'écran de config a fondu dans la maquette (styles, règles, recalibrage
      // y vivent désormais). Redirection plutôt que 404 : les liens posés
      // (dashboard, favoris, ancien /config, ancien /styles) visent encore ces URL.
      {
        path: 'config',
        redirect: (to) => ({ name: 'maquette', params: to.params }),
      },
      {
        path: 'styles',
        redirect: (to) => ({ name: 'maquette', params: to.params }),
      },
      // `:nodeId` OPTIONNEL : le menu doit pouvoir ouvrir l'éditeur sans savoir
      // sur quel chapitre (il n'a pas la trame). Sans chapitre, EditorView
      // retombe sur le premier du livre.
      { path: 'noeud/:nodeId?', name: 'editor', component: EditorView },
    ],
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
