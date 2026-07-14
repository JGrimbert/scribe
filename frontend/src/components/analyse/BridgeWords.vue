<template>
  <div class="lex-module">
    <h4 class="lex-module__title">Mots-ponts</h4>
    <p class="lex-module__hint">Les mots par qui transitent les liens entre champs.</p>
    <ul v-if="bridges.length" class="lex-list">
      <li
          v-for="b in bridges"
          :key="b.lemma"
          :class="{ active: focus?.kind === 'node' && focus.lemma === b.lemma }"
          @click="selectNode(b.lemma)"
      >
        <span class="lex-swatch" :style="{ background: communityColor(b.community) }"></span>
        <span class="lex-word">{{ b.lemma }}</span>
        <ScoreBar class="bridge-bar" :pct="b.centrality * 100" track-width="3.5em" />
      </li>
    </ul>
    <p v-else class="lex-module__hint">Aucun pont marqué sur ce réseau.</p>
  </div>
</template>

<script setup>
import ScoreBar from '../ui/ScoreBar.vue'
import { useLexicalGraph } from '../../composables/useLexicalGraph'

const { bridges, focus, communityColor, selectNode } = useLexicalGraph()
</script>

<style scoped>
.bridge-bar {
  margin-left: auto;
}
</style>
