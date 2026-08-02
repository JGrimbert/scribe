<template>
  <!-- Panneau du dock, monté pendant la recherche dans l'espace laissé par
       l'accordéon replié : le nuage de lemmes. Les CHIFFRES du document, qui s'y
       trouvaient en regard, ont rejoint le lambeau de statut de la planche de
       résultats (cf. statusEntry) — la recherche porte son propre en-tête. -->
  <div class="maq-spanel">
    <div ref="bodyEl" class="maq-spanel__body">
      <VocabulaireCloud compact :width="bodyW" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import VocabulaireCloud from '../analyse/lexical/VocabulaireCloud.vue'

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
.maq-spanel {
  position: relative;
  height: 100%;
}

/* Le nuage garde sa gouttière à gauche (il se pose contre la pellicule repliée en
   onglets) mais plus la réserve de tête du jalon, qui n'existe plus. */
.maq-spanel__body {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 2.6em;
  overflow: hidden;
}
</style>
