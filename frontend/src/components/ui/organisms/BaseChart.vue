<template>
  <div ref="root" class="base-chart" :style="{ height }"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// Import modulaire volontaire : `import * as echarts from 'echarts'` embarque
// tous les types de graphes (~1 Mo). On n'enregistre que ce que l'app utilise
// réellement — ajouter ici (et seulement ici) le module d'un nouveau type de
// graphe le jour où on en introduit un.
echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  // Option echarts complète. Reconstruire l'objet plutôt que le muter : le
  // watch est en `deep: false` (voir plus bas).
  option: { type: Object, required: true },
  height: { type: String, default: '16em' },
})

const root = ref(null)
// shallowRef : l'instance echarts est un gros objet non réactif qui se pilote
// par ses méthodes — la rendre réactive coûterait cher pour rien.
const chart = shallowRef(null)
let observer = null

onMounted(() => {
  chart.value = echarts.init(root.value)
  chart.value.setOption(props.option)

  // echarts mesure son conteneur à l'init et ne se réajuste jamais seul : sans
  // ça, un graphe monté dans un bloc encore replié garde une taille de 0.
  observer = new ResizeObserver(() => chart.value?.resize())
  observer.observe(root.value)
})

// notMerge : les séries d'un document à l'autre n'ont ni le même nombre de
// barres ni les mêmes catégories — un merge laisserait traîner les résidus du
// document précédent.
watch(
  () => props.option,
  (option) => chart.value?.setOption(option, { notMerge: true }),
)

onBeforeUnmount(() => {
  observer?.disconnect()
  chart.value?.dispose() // echarts ne se nettoie pas au retrait du DOM (fuite de canvas)
})
</script>

<style scoped>
.base-chart {
  width: 100%;
}
</style>
