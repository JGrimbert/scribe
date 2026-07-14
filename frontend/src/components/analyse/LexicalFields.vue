<template>
  <div class="lex-module">
    <h4 class="lex-module__title">
      Champs lexicaux
      <UiHint text="Grappes de mots qui co-occurrent densément entre eux (détection de communautés, algorithme de Louvain). Chaque couleur en marque un. Cliquez un champ pour l’isoler dans le réseau." />
    </h4>
    <p v-if="!communities.length" class="lex-module__hint">Aucune grappe détectée.</p>
    <ul v-else class="lex-list">
      <li
          v-for="c in communities"
          :key="c.id"
          :class="{ active: focus?.kind === 'community' && focus.id === c.id }"
          @click="selectCommunity(c.id)"
      >
        <span class="lex-swatch" :style="{ background: c.color }"></span>
        <span class="lex-word field-words">{{ preview(c) }}</span>
        <span class="lex-metric">{{ c.size }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import UiHint from '../ui/UiHint.vue'
import { useLexicalGraph } from '../../composables/useLexicalGraph'

const { communities, focus, selectCommunity } = useLexicalGraph()

const preview = (c) => {
  const head = c.members.slice(0, 4).map((m) => m.lemma).join(', ')
  return c.size > 4 ? `${head}…` : head
}
</script>
