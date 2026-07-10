<template>
  <div class="scroll-folio">
    <FolioComposer
        :trame="trame"
        :data="data"
        :axe-id="route.params.axeId"
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
import { inject } from 'vue'
import { useRoute } from 'vue-router'
import FolioComposer from './FolioComposer.vue'
import Scroll from './Scroll.vue'

const route = useRoute()
const trame = inject('documentTrame')
const data = inject('documentData')
const quillVisible = inject('quillVisible')

function onContenuUpdate() {
  console.log("update")
}
</script>
