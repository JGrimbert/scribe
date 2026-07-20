<template>
  <div class="scroll-folio">
    <FolioComposer
        :trame="trame"
        :data="data"
        :node-id="nodeId"
        :quill-visible="quillVisible"
    />
    <Scroll
        v-if="false === true"
        :trame="trame"
        :data="data"
        @update="onContenuUpdate"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import FolioComposer from './FolioComposer.vue'
import Scroll from './Scroll.vue'

const route = useRoute()
const trame = inject('documentTrame')
const data = inject('documentData')
const quillVisible = inject('quillVisible')

// `/noeud` sans chapitre = « ouvre l'éditeur », sans dire où. C'est la seule
// façon pour la topbar d'y entrer : elle n'a pas la trame, donc aucun id de
// nœud à mettre dans l'URL. On ouvre alors le premier chapitre du livre.
const nodeId = computed(() => route.params.nodeId || trame.value?.axes?.[0]?.id)

function onContenuUpdate() {
  console.log("update")
}
</script>
