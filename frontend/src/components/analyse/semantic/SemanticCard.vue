<template>
  <AnalyseBlock

      aside="right"
  >
    <template #main>
      <SemanticPairsCard
          bare
          title="Textes identiques ou quasi identiques"
          mode="duplicates"
          hint="Ces articles partagent un texte (presque) mot pour mot — doublons ou gabarits recopiés en attente de rédaction."
      />
    </template>

    <template #aside>
      <SemanticPairsCard
          title="Paires d’articles les plus proches"
          mode="closest"
      />
    </template>
  </AnalyseBlock>
</template>

<script>
import AnalyseBlock from "../AnalyseBlock.vue";
import SemanticPairsCard from "./SemanticPairsCard.vue";

export default {
  name: "SemanticCard",
  components: {SemanticPairsCard, AnalyseBlock}
}

</script>

<style scoped>

</style>