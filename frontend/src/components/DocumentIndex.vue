<template>
  <p class="loading">Chargement…</p>
</template>

<script setup>
// Étape transitoire : pas encore d'écran "chapitrage", on retombe sur le
// premier axe (comportement identique à l'ancien flux). À remplacer par le
// futur écran de sélection d'axe.
import { inject, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const trame = inject('documentTrame')
const route = useRoute()
const router = useRouter()

watch(
    trame,
    (t) => {
      const firstAxeId = t?.axes?.[0]?.id
      if (firstAxeId) {
        router.replace(`/documents/${route.params.id}/axe/${firstAxeId}`)
      }
    },
    { immediate: true },
)
</script>

<style scoped>
.loading {
  padding: 1.5em;
  opacity: 0.6;
}
</style>
