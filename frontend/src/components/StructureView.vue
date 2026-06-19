<template>
  <main v-if="structure" class="main-view">
    <div v-for="(axe, i) in structure.axes" :key="axe.slug" class="axe">
      <template v-if="axe.titre.length && (axe.intro.length || axe.paragraphes && axe.paragraphes.length)">
      <h2 class="axe-title">{{ axe.titre }}</h2>
      <div
          v-if="axeCurrent === i"
          class="blocs"
      >
        <div
            v-for="bloc in axe.blocs"
            :key="bloc.slug"
            class="blocc"
            @click="$emit('openBloc', { axe, bloc })"
        >
          <div class="bloc-title">{{ bloc.titre }}</div>
          <!--
          <div class="dots">
            <span
                v-for="(a, i) in bloc.articles"
                :key="i"
                class="dot"
            />
          </div>

          <div class="meta">
            {{ bloc.articles.length }} articles
          </div>
          -->
        </div>
      </div>
      </template>
    </div>

    <label class="load">
      Charger structure.json
      <input type="file" accept=".json" @change="$emit('load', $event)" hidden />
    </label>
  </main>

  <div v-else class="empty">
    <p>Chargement ou absence de structure…</p>
  </div>
</template>

<script setup>
defineProps({
  structure: Object,
  axeCurrent: Number,
})

defineEmits(['openBloc', 'load'])
</script>

<style scoped>
.main-view {
  width:240px;
  margin: 1em;
  border-radius: 1em;
  padding: 1em;
  position: fixed;
  z-index: 1;
  background: var(--c-surface4);
  backdrop-filter: var(--c-backdrop-filter-blur);
  visibility: hidden;
}

/* ── Axe ──────────────────────────────────────────────── */
.axe {
  margin-bottom: 0.2rem;
}


/* ── Loader ──────────────────────────────────────────── */
.load {
  display: inline-block;
  font-size: 0.66em;
  margin-top: 2rem;
  padding: 0.6rem 1rem;
  background: var(--c-accent);
  color: white;
  border-radius: 6px;
  cursor: pointer;
}
</style>