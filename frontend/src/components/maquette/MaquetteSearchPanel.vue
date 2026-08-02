<template>
  <!-- Panneau du dock, monté pendant la recherche dans l'espace laissé par
       l'accordéon replié. Par défaut les CHIFFRES du document ; l'onglet « Nuage »
       — le même objet que les onglets de zone — bascule vers le nuage de lemmes. -->
  <div class="maq-spanel">
    <MaquetteJalon
        label="Nuage"
        :active="cloud"
        :title="cloud ? 'Voir les chiffres' : 'Voir le nuage'"
        @click="cloud = !cloud"
    />

    <div ref="bodyEl" class="maq-spanel__body">
      <VocabulaireCloud v-if="cloud" compact :width="bodyW" />
      <DocStats v-else :items="statItems" variant="grid" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MaquetteJalon from './MaquetteJalon.vue'
import DocStats from '../layout/DocStats.vue'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'
import { useDocStats } from '../../composables/useDocStats'

const { statItems } = useDocStats()

const cloud = ref(false)

// Le nuage se dimensionne en px (nombre de mots par défaut) : on lui donne la
// largeur réelle du corps, qui dépend du repli de l'accordéon.
const bodyEl = ref(null)
const bodyW = ref(0)
let ro
onMounted(() => {
  const measure = () => { bodyW.value = bodyEl.value?.clientWidth ?? 0 }
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(bodyEl.value)
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<style scoped>
/* Repère du jalon (posé en absolu par `MaquetteJalon`) ; le corps se décale de sa
   largeur pour ne pas passer dessous. */
.maq-spanel {
  position: relative;
  height: 100%;
}

.maq-spanel__body {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2.4em 0 0 2.6em;
  overflow: hidden;
}
</style>
