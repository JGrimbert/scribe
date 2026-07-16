<template>
  <!-- Bloc thèmes : carte des segments (2/3) à gauche, détail au clic (1/3) à
       droite — même orientation que le bloc-nuage. -->
  <AnalyseBlock
      step="themes"
      aside="right"
      :ready="!!topics?.projection?.length"
      run-label="Lancer l'analyse des thèmes"
      run-hint="l'extraction d'un manuscrit complet prend plusieurs minutes, l'avancement s'affiche ici."
      unavailable="Carte des segments indisponible sur cette analyse — relancer l'analyse pour l'obtenir."
  >
    <template #main>
      <ThemesMap />
    </template>

    <template #aside>
      <ThemeList />
      <ThemeDetail />
    </template>
  </AnalyseBlock>
</template>

<script setup>
import AnalyseBlock from './AnalyseBlock.vue'
import ThemesMap from './ThemesMap.vue'
import ThemeList from './ThemeList.vue'
import ThemeDetail from './ThemeDetail.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { topics } = useAnalyse()
</script>
