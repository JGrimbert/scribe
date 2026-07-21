<template>
  <div class="scroll-folio">
    <!-- Migration Phase 4 (non destructive) : `?frame=1` bascule sur le rendu
         iframe unifié (FolioView), le défaut reste l'éditeur éprouvé. À ce stade
         FolioView edit ne fait que RENDRE les pages — l'édition (Quill, curseur,
         sélection) viendra par incréments vérifiés en navigateur. -->
    <FolioView
        v-if="useFrame"
        mode="edit"
        :data="data"
        :node-id="nodeId"
    />
    <FolioComposer
        v-else
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
import FolioView from './FolioView.vue'
import Scroll from './Scroll.vue'

const route = useRoute()
const trame = inject('documentTrame')
const data = inject('documentData')
const quillVisible = inject('quillVisible')

// Flag de migration : `?frame=1` sur la route éditeur. Non persisté, purement
// pour comparer/valider le nouveau rendu iframe sans toucher au défaut.
const useFrame = computed(() => route.query.frame === '1')

// `/noeud` sans chapitre = « ouvre l'éditeur », sans dire où. C'est la seule
// façon pour la topbar d'y entrer : elle n'a pas la trame, donc aucun id de
// nœud à mettre dans l'URL. On ouvre alors le premier chapitre du livre.
const nodeId = computed(() => route.params.nodeId || trame.value?.axes?.[0]?.id)

function onContenuUpdate() {
  console.log("update")
}
</script>
