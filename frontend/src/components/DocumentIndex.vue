<template>
  <div class="document-index">
    <p v-if="!trame" class="loading">Chargement…</p>

    <template v-else>
      <div class="tabs">
        <button
            class="tab"
            :class="{ 'tab--active': tab === 'chapitrage' }"
            @click="tab = 'chapitrage'"
        >
          Chapitrage
        </button>
        <button
            class="tab"
            :class="{ 'tab--active': tab === 'analyse' }"
            @click="tab = 'analyse'"
        >
          Analyse
        </button>
      </div>

      <table v-if="tab === 'chapitrage' && axes.length" class="axes-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Sous-titres</th>
            <th>Mots</th>
          </tr>
        </thead>
        <tbody>
          <tr
              v-for="axe in axes"
              :key="axe.id"
              class="axe-row"
              @click="router.push(`/documents/${route.params.id}/noeud/${axe.id}`)"
          >
            <td>{{ axe.titre }}</td>
            <td>{{ axe.nbDescendants }}</td>
            <td>{{ axe.mots.toLocaleString('fr') }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else-if="tab === 'chapitrage'" class="empty">Aucun axe dans ce document.</p>

      <AnalyseView v-else-if="tab === 'analyse'" />
    </template>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AnalyseView from './AnalyseView.vue'

const trame = inject('documentTrame')
const data = inject('documentData')
const route = useRoute()
const router = useRouter()

const tab = ref('chapitrage')

function countDescendants(node) {
  let count = node.children.length
  for (const child of node.children) {
    count += countDescendants(child)
  }
  return count
}

const axes = computed(() => {
  if (!trame.value || !data.value) return []
  return trame.value.axes.map((axe) => ({
    id: axe.id,
    titre: data.value[axe.id]?.titre ?? '(sans titre)',
    nbDescendants: countDescendants(axe),
    mots: data.value[axe.id]?.stats?.mots ?? 0,
  }))
})
</script>

<style scoped>
.document-index {
  padding: 1.5em;
  max-width: 80ch;
  margin: 0 auto;
  width: 100%;
}

.loading {
  padding: 1.5em;
  opacity: 0.6;
}

.tabs {
  display: flex;
  gap: 0.5em;
  margin-bottom: 1.5em;
  border-bottom: 1px solid var(--c-border, #e0d8cc);
}

.tab {
  padding: 0.5em 1em;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.95em;
  opacity: 0.6;
}

.tab--active {
  opacity: 1;
  font-weight: 600;
  border-bottom: 2px solid var(--c-accent);
}

.axes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.axes-table th,
.axes-table td {
  text-align: left;
  padding: 0.5em 0.75em;
  border-bottom: 1px solid var(--c-border, #e0d8cc);
}

.axe-row {
  cursor: pointer;
}

.axe-row:hover {
  background: var(--c-surface4, rgba(0, 0, 0, 0.04));
}

.empty {
  opacity: 0.6;
}
</style>
