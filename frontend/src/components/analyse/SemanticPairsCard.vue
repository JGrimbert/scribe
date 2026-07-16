<template>
  <UiCard :title="title" :wide="!bare" :bare="bare" :busy="running === 'semantic'">
    <UiNote v-if="stepErrors.semantic" variant="error">{{ stepErrors.semantic }}</UiNote>
    <UiNote v-if="!semantic">
      Proximité sémantique pas encore calculée.
    </UiNote>

    <template v-else>
      <UiNote v-if="hint" variant="hint">{{ hint }}</UiNote>
      <UiNote v-if="!pairs.length" variant="hint">Aucune paire pour ce critère.</UiNote>

      <UiTable v-else>
        <tbody>
          <tr
              v-for="pair in pairs"
              :key="pair.key"
              class="row-link"
              title="Cliquer pour recentrer la proximité sémantique"
              @click="focusNodeId = pair.a"
          >
            <td>{{ titreOf(pair.a) }}</td>
            <td>{{ titreOf(pair.b) }}</td>
            <td class="num">{{ formatPercent(pair.score) }}</td>
          </tr>
        </tbody>
      </UiTable>
    </template>
  </UiCard>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import UiCard from '../ui/UiCard.vue'
import UiNote from '../ui/UiNote.vue'
import UiTable from '../ui/UiTable.vue'
import { useAnalyse } from '../../composables/useAnalyse'
import { formatPercent } from '../../script/format'
import { buildPairs, DUPLICATE_THRESHOLD } from '../../script/semanticPairs'

const props = defineProps({
  title: { type: String, required: true },
  // 'duplicates' : textes (quasi) identiques ; 'closest' : paires proches.
  mode: { type: String, required: true },
  hint: { type: String, default: null },
  // Monté dans la colonne étroite d'un bloc (pas dans la grille de cards) :
  // sans cadre propre, et sans `wide` qui n'y voudrait rien dire.
  bare: { type: Boolean, default: false },
})

const { analysis, running, stepErrors, focusNodeId, settle } = useAnalyse()

const semantic = computed(() => analysis.value?.semantic ?? null)

const semanticTitreById = computed(
  () => new Map((semantic.value?.units ?? []).map((u) => [u.nodeId, u.titre])),
)

function titreOf(nodeId) {
  return semanticTitreById.value.get(nodeId) ?? '(sans titre)'
}

const pairs = computed(() => {
  const all = buildPairs(semantic.value?.units)
  return props.mode === 'duplicates'
    ? all.filter((p) => p.score >= DUPLICATE_THRESHOLD).slice(0, 10)
    : all.filter((p) => p.score < DUPLICATE_THRESHOLD).slice(0, 15)
})

onMounted(() => settle('pairs'))
</script>
