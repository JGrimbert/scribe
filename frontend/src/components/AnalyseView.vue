<template>
  <div class="analyse-view">
    <!-- Bandeau global : présent dès l'arrivée (tuiles « — » tant que les
         données manquent), même pendant le chargement de l'analyse. Une tuile
         par stat + relance séquentielle de toutes les analyses (chaque card
         affiche son spinner quand vient son tour). -->
    <div class="stats-banner">
      <StatItem
          v-for="item in statItems"
          :key="item.label"
          :value="item.value"
          :label="item.label"
          :hint="item.hint"
          :empty="item.empty"
      />

      <BaseButton
          variant="solid-alt"
          class="run-all"
          :icon="running ? null : 'pi-play'"
          :busy="!!running"
          @click="runAll"
      >
        {{ running ? `Analyse : ${STEP_LABELS[running]}…` : hasAny ? 'Relancer l’analyse' : 'Lancer l’analyse' }}
      </BaseButton>
    </div>

    <UiNote v-if="error" variant="error">{{ error }}</UiNote>

    <template v-else>
      <!-- La checklist de progression vit désormais dans DocumentBar (à droite
           du fil d'Ariane), plus en overlay sur le nuage. Chaque bloc-split
           (VocabulaireCard / LexicalCard) encapsule son propre cadre et sa
           révélation ; AnalyseView les aligne sans layout spécifique. -->
      <VocabulaireCard />

      <LexicalCard />

      <ThemesCard />

      <div class="split">
        <Transition name="reveal" appear>
          <SemanticPairsCard
              v-if="isRevealed('pairs')"
              title="Textes identiques ou quasi identiques"
              mode="duplicates"
              hint="Ces articles partagent un texte (presque) mot pour mot — doublons ou refrains du manuscrit."
          />
        </Transition>
      </div>

      <div class="split">
        <Transition name="reveal" appear>
          <AnomaliesCard v-if="isRevealed('pairs')" />
        </Transition>
        <Transition name="reveal" appear>
          <SemanticPairsCard
              v-if="isRevealed('pairs')"
              title="Paires d’articles les plus proches"
              mode="closest"
          />
        </Transition>
      </div>

      <!-- Bas de page : cards en lecture seule, « à trier plus tard ». Le
           tableau par article (sorti du bloc Analyse linguistique) et les
           entités non migrées vers les filtres du nuage. -->
      <LexicalUnitsCard v-if="isRevealed('lexical')" class="leftover-entities" />
      <EntitiesLeftoverCard v-if="isRevealed('lexical')" class="leftover-entities" />
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAnalyse } from '../composables/useAnalyse'
import { formatInt, formatPercent } from '../script/format'
import BaseButton from './ui/BaseButton.vue'
import StatItem from './ui/StatItem.vue'
import UiNote from './ui/UiNote.vue'
import VocabulaireCard from './analyse/VocabulaireCard.vue'
import EntitiesLeftoverCard from './analyse/EntitiesLeftoverCard.vue'
import LexicalCard from './analyse/LexicalCard.vue'
import LexicalUnitsCard from './analyse/LexicalUnitsCard.vue'
import SemanticPairsCard from './analyse/SemanticPairsCard.vue'
import AnomaliesCard from './analyse/AnomaliesCard.vue'
import ThemesCard from './analyse/ThemesCard.vue'

const STEP_LABELS = {
  lexical: 'analyse linguistique',
  semantic: 'proximité sémantique',
  topics: 'thèmes',
}

const route = useRoute()
const { error, analysis, running, isRevealed, fetchAnalysis, runAll } = useAnalyse()

// Structure du document (fournie par DocumentLayout) : source des stats
// structurelles (caractères, paragraphes, chapitres), absentes du NLP.
const trame = inject('documentTrame', ref(null))
const data = inject('documentData', ref(null))

onMounted(fetchAnalysis)
watch(() => route.params.id, (id) => { if (id) fetchAnalysis() })

const hasAny = computed(() => {
  const a = analysis.value
  return !!(a?.lexical || a?.semantic || a?.topics)
})

// Caractères/mots déjà agrégés récursivement côté backend (somme sur les axes
// de tête = total) ; paragraphes et chapitres (tous les nœuds-titres) en un
// seul parcours de l'arbre.
const structure = computed(() => {
  const axes = trame.value?.axes
  const d = data.value
  if (!axes || !d) return null

  let caracteres = 0
  let paragraphes = 0
  let titres = 0
  const walk = (node) => {
    titres++
    paragraphes += d[node.id]?.texte?.length ?? 0
    node.children.forEach(walk)
  }
  for (const axe of axes) {
    caracteres += d[axe.id]?.stats?.caracteres ?? 0
    walk(axe)
  }
  return { caracteres, paragraphes, titres }
})

const HINTS = {
  lemmes: 'Formes de base distinctes — un lemme regroupe les flexions d’un mot (chante, chantait → chanter).',
  diversite: 'TTR : mots distincts / mots totaux. Plus c’est élevé, plus le vocabulaire est varié.',
  densite: 'Part des mots porteurs de sens (noms, verbes, adjectifs, adverbes) sur le total.',
}

// Ligne toujours affichée : chaque tuile porte sa valeur si calculée, sinon
// « — » centré (StatItem `empty`). Structure dispo dès le chargement, stats
// NLP après l'analyse lexicale.
const statItems = computed(() => {
  const g = analysis.value?.lexical?.global
  const s = structure.value
  const tile = (label, value, hint = null) => ({ label, value, hint, empty: value == null })
  return [
    tile('caractères', s ? formatInt(s.caracteres) : null),
    tile('mots', g ? formatInt(g.words) : null),
    tile('phrases', g ? formatInt(g.sentences) : null),
    tile('paragraphes', s ? formatInt(s.paragraphes) : null),
    tile('chapitres', s ? formatInt(s.titres) : null),
    tile('lemmes', g ? formatInt(g.uniqueLemmas) : null, HINTS.lemmes),
    tile('mots / phrase', g ? g.avgSentenceLength.toLocaleString('fr') : null),
    tile('diversité', g ? formatPercent(g.ttr) : null, HINTS.diversite),
    tile('densité', g ? formatPercent(g.lexicalDensity) : null, HINTS.densite),
  ]
})
</script>

<style>
@import '../assets/analyse.css';
</style>

<style scoped>
.analyse-view {
  padding: 1.25em;
}

/* Tuiles + bouton se partagent 100 % de la largeur (chaque case flex: 1,
   min 8em, retour à la ligne au besoin). */
.stats-banner {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: 0.6em;
  margin-bottom: 1em;
}

.stats-banner > * {
  flex: 1 1 8em;
}

/* Le bouton « Relancer » est la dernière case, centré comme une tuile. */
.run-all {
  justify-content: center;
}

.leftover-entities {
  display: block;
  margin-top: 1em;
}

</style>
