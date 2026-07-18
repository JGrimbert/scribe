import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../components/HomeView.vue'
import ImportView from '../components/ImportView.vue'
import DocumentLayout from '../components/DocumentLayout.vue'
import AnalyseView from '../components/AnalyseView.vue'
import EditorView from '../components/EditorView.vue'
import ConfigView from '../components/ConfigView.vue'
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
      { path: 'config', name: 'config', component: ConfigView },
      // L'ancien écran de typologie a fondu dans la config (plus de volets).
      // Redirection plutôt que suppression : les liens posés (dashboard,
      // favoris) visent encore /styles.
      {
        path: 'styles',
        redirect: (to) => ({ name: 'config', params: to.params }),
      },
      { path: 'noeud/:nodeId', name: 'editor', component: EditorView },
    ],
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
