<template>
  <div class="page-content">

        <component
            :is="'div'"
            v-html="html"
        />


<!--    <div
        v-for="section in sections"
        :key="section.id"
        class="section"
    >

      <h3 class="titre">
        {{ section.titre }}
      </h3>

      <div class="texte">
        <p v-for="(p, i) in section.texte" :key="i">
          {{ p }}
        </p>
      </div>

      <div v-if="section.connexe?.pistes?.length" class="pistes">
        <p v-for="(p, i) in section.connexe.pistes" :key="i">
          {{ p }}
        </p>
      </div>

    </div>-->

  </div>
</template>

<script setup>
const props = defineProps({
  html: String,
})
</script>