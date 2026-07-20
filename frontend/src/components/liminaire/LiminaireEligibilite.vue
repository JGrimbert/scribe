<template>
  <!-- Le verdict, dérivé du tagging (cf. deriveEligibility) : il porte sur TOUT
       le liminaire, pas sur le vis-à-vis focusé — un manquant se juge sur
       l'ensemble. -->
  <div>
    <div class="elig-block">
      <span class="elig-label">Pages obligatoires</span>
      <ul class="elig-list">
        <li v-for="o in elig.obligatoires" :key="o.key" :class="o.present ? 'ok' : 'ko'">
          <i class="pi" :class="o.present ? 'pi-check' : 'pi-times'"></i>
          {{ o.label }}
        </li>
      </ul>
    </div>

    <div class="elig-block">
      <span class="elig-label">Composition recto-verso</span>
      <p v-if="!elig.conflicts.length && !elig.duplicates.length" class="elig-ok">Aucun conflit.</p>
      <ul v-else class="elig-list">
        <li v-for="c in elig.conflicts" :key="`c-${c.key}`" class="ko">
          <i class="pi pi-exclamation-triangle"></i>
          {{ c.label }} : {{ c.chosen }} choisi, {{ c.expected }} attendu
        </li>
        <li v-for="d in elig.duplicates" :key="`d-${d.type}`" class="ko">
          <i class="pi pi-exclamation-triangle"></i>
          {{ d.label }} en {{ d.count }} exemplaires
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
defineProps({
  // Le résultat de deriveEligibility — calculé par le composer, qui détient les
  // pages et la config.
  elig: { type: Object, required: true },
})
</script>

<style scoped>
.elig-block + .elig-block { margin-top: var(--sp-4); }

.elig-label {
  display: block;
  font-size: var(--fs-sm);
  font-weight: 600;
  margin-bottom: var(--sp-2);
}

.elig-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
}

.elig-list li {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}

.elig-list .pi { font-size: 0.85em; }

.ok { color: var(--c-ink2); }
.ok .pi { color: var(--c-accent); }
.ko { color: var(--c-danger); }

.elig-ok {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}
</style>
