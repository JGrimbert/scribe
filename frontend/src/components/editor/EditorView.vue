<template>
  <div class="scroll-folio">
    <FolioView
        mode="edit"
        :data="data"
        :node-id="nodeId"
        :visuals="visuals"
        :page="page"
        :quill-visible="quillVisible"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import FolioView from './FolioView.vue'

const route = useRoute()
const trame = inject('documentTrame')
const data = inject('documentData')
const visuals = inject('documentVisuals')
const page = inject('documentPage')
const quillVisible = inject('quillVisible')

// `/noeud` sans chapitre = « ouvre l'éditeur », sans dire où. C'est la seule
// façon pour la topbar d'y entrer : elle n'a pas la trame, donc aucun id de
// nœud à mettre dans l'URL. On ouvre alors le premier chapitre du livre.
const nodeId = computed(() => route.params.nodeId || trame.value?.axes?.[0]?.id)
</script>
