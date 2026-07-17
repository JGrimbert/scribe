import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../components/HomeView.vue'
import ImportView from '../components/ImportView.vue'
import DocumentLayout from '../components/DocumentLayout.vue'
import AnalyseView from '../components/AnalyseView.vue'
import EditorView from '../components/EditorView.vue'
import StylesView from '../components/StylesView.vue'
import { useRegistry } from '../composables/useRegistry'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  {
    path: '/import',
    name: 'import',
    component: ImportView,
    // Le preview d'import ne vit qu'en mémoire (ici comme côté backend) : entrer
    // sur /import par l'URL ou après un rechargement n'a rien à calibrer.
    beforeEnter: () => (useRegistry().pendingPreview.value ? true : '/'),
  },
  {
    path: '/documents/:id',
    name: 'document-layout',
    component: DocumentLayout,
    children: [
      { path: '', name: 'document', component: AnalyseView },
      { path: 'styles', name: 'styles', component: StylesView },
      { path: 'noeud/:nodeId', name: 'editor', component: EditorView },
    ],
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
