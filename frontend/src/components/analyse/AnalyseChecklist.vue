<template>
  <ProgressChecklist :items="items" :progress="progress" />
</template>

<script setup>
import { computed } from 'vue'
import ProgressChecklist from '../ui/ProgressChecklist.vue'
import { useAnalyse } from '../../composables/useAnalyse'

const { steps, stepStatus, topicsProgress } = useAnalyse()

const items = computed(() => steps.map((step) => ({ label: step.label, status: stepStatus(step) })))

const progress = computed(() =>
  topicsProgress.value
    ? {
        pct: topicsProgress.value.pct,
        label: `${topicsProgress.value.step} (${Math.round(topicsProgress.value.pct)} %)`,
      }
    : null,
)
</script>
