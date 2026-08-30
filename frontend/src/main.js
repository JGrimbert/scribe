import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
// Global et explicite : le primitif `.split` sert aux cards d'analyse (montées
// par la maquette) ET au volet Styles de la config. L'importer ici plutôt que
// dans un composant le garde indépendant du lazy-loading des routes — sans quoi
// passer la maquette en lazy décoifferait la config, sans que rien ne relie la
// cause à l'effet.
import './assets/analyse.css'
createApp(App).use(router).mount('#app')
