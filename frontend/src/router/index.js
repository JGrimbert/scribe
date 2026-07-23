import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../components/home/HomeView.vue'
import DocumentLayout from '../components/layout/DocumentLayout.vue'
import AnalyseView from '../components/analyse/AnalyseView.vue'
import EditorView from '../components/editor/EditorView.vue'
import ConfigView from '../components/config/ConfigView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  {
    path: '/documents/:id',
    name: 'document-layout',
    component: DocumentLayout,
    children: [
      { path: '', name: 'document', component: AnalyseView },
      { path: 'config', name: 'config', component: ConfigView },
      // L'ancien écran de typologie a fondu dans la config (plus de volets).
      // Redirection plutôt que suppression : les liens posés (dashboard,
      // favoris) visent encore /styles.
      {
        path: 'styles',
        redirect: (to) => ({ name: 'config', params: to.params }),
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
