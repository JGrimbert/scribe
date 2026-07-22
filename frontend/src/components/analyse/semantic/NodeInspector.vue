<template>
  <div class="lex-module">
    <template v-if="!inspected" class="lex-module__hint">
      Cliquez un mot du réseau pour voir ses associations les plus fortes.
    </template>
    <template v-else>
      <div class="insp-head">
        <span class="lex-swatch" :style="{ background: communityColor(inspected.node.community) }"></span>
        <span class="insp-word">{{ inspected.node.lemma }}</span>
        <span class="lex-metric">{{ inspected.node.count }} phrases</span>
      </div>
      <ul class="lex-list assoc">
        <li v-for="a in inspected.associations.slice(0, 8)" :key="a.lemma" @click="selectNode(a.lemma)">
          <span class="lex-word">{{ a.lemma }}</span>
          <ScoreBar class="lex-metric" :pct="a.npmi * 100" :label="npmi(a.npmi)" track-width="3.5em" />
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup>
import ScoreBar from '../../ui/atoms/ScoreBar.vue'
import { useLexicalGraph } from '../../../composables/useLexicalGraph'

const { inspected, communityColor, selectNode } = useLexicalGraph()

const npmi = (v) => v.toFixed(2).replace('.', ',')
</script>

<style scoped>
.insp-head {
  display: flex;
  align-items: center;
  gap: 0.55em;
  margin-bottom: 0.5em;
}

.insp-word {
  font-family: var(--font-serif);
  font-size: var(--fs-md);
  font-weight: 600;
}

/* Le label de ScoreBar tient déjà la métrique : neutraliser l'opacité muette
   de .lex-metric sur la barre elle-même. */
.assoc .lex-metric {
  opacity: 1;
}
</style>
