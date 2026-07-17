import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
// Global et explicite : le primitif `.split` sert au dashboard ET au volet
// Styles de la config. Il ne tenait jusqu'ici que parce qu'AnalyseView est
// importé statiquement par le routeur — passer cette route en lazy aurait
// décoiffé la config, sans que rien ne relie la cause à l'effet.
import './assets/analyse.css'
createApp(App).use(router).mount('#app')
