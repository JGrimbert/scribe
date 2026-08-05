import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../components/home/HomeView.vue'
import DocumentLayout from '../components/layout/DocumentLayout.vue'
import AnalyseView from '../components/analyse/AnalyseView.vue'
import EditorView from '../components/editor/EditorView.vue'
import MaquetteView from '../components/maquette/MaquetteView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  {
    path: '/documents/:id',
    name: 'document-layout',
    component: DocumentLayout,
    children: [
      // La maquette est la vue par défaut du document ; l'analyse garde son
      // name `document` (scope, labels…) mais vit sur `/analyse` — plus aucune
      // icône n'y mène, on n'y accède qu'en tapant l'URL (choix délibéré).
      { path: '', name: 'maquette', component: MaquetteView },
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
