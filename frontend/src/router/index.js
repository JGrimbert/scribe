import { createRouter, createWebHistory } from 'vue-router'
import RegistryView from '../components/RegistryView.vue'
import DocumentLayout from '../components/DocumentLayout.vue'
import AnalyseView from '../components/AnalyseView.vue'
import EditorView from '../components/EditorView.vue'
import StylesView from '../components/StylesView.vue'

const routes = [
  { path: '/', name: 'registry', component: RegistryView },
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
