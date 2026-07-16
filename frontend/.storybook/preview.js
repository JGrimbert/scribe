import { setup } from '@storybook/vue3-vite'
import { createMemoryHistory, createRouter } from 'vue-router'
import 'primeicons/primeicons.css'
import '../src/assets/base.css'

// Routeur en mémoire, attrape-tout : les composants métier consomment
// useRoute()/RouterLink (renvoi vers la typologie, ouverture d'un chapitre) et
// ne se montent pas sans routeur installé. Rien à voir avec le routage réel de
// l'app — juste de quoi faire tenir les stories debout.
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
})

setup((app) => app.use(router))

export default {
  decorators: [
    // même fond que l'app (base.css stylise le body de l'iframe) + respiration
    (story) => ({
      components: { story },
      template: '<div style="padding: 1.5rem;"><story /></div>',
    }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
}
