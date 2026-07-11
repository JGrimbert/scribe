<template>
  <div class="analyse-view">
    <p v-if="loading" class="state">Chargement…</p>
    <p v-else-if="error" class="state state--error">{{ error }}</p>

    <template v-else>
      <!-- ── Volet vocabulaire (fréquence lexicale, calcul local backend) ── -->
      <section class="volet">
        <div class="analyse-toolbar">
          <h2>Vocabulaire</h2>
          <button type="button" class="relancer" :disabled="computing" @click="relancer">
            <i v-if="computing" class="pi pi-spin pi-spinner"></i>
            {{ computing ? 'Calcul en cours…' : wordFrequency ? "Relancer l'analyse" : "Lancer l'analyse" }}
          </button>
          <span v-if="wordFrequency" class="computed-at">Calculée le {{ formatDate(wordFrequency.computedAt) }}</span>
        </div>

        <p v-if="wfError" class="state state--error">{{ wfError }}</p>
        <p v-if="!wordFrequency" class="state">Analyse pas encore calculée pour ce document.</p>
        <p v-else-if="!displayedWords.length" class="state">Pas assez de texte pour une analyse lexicale.</p>

        <template v-else>
          <div class="word-cloud">
            <button
                v-for="entry in displayedWords"
                :key="entry.word"
                type="button"
                class="word-chip"
                :class="{ 'word-chip--active': selected === entry.word }"
                :style="{ fontSize: sizeFor(entry.count) + 'rem' }"
                :title="`${entry.word} — ${entry.count} occurrence${entry.count > 1 ? 's' : ''}`"
                @click="selected = selected === entry.word ? null : entry.word"
            >
              {{ entry.word }}
            </button>
          </div>

          <div v-if="selectedEntry" class="word-detail">
            <h3>« {{ selectedEntry.word }} » — {{ selectedEntry.count }} occurrence{{ selectedEntry.count > 1 ? 's' : '' }}</h3>
            <NodesTable :nodes="selectedEntry.nodes" @open="goToNode" />
          </div>
        </template>
      </section>

      <!-- ── Volet analyse linguistique (spaCy via nlp-service) ── -->
      <section class="volet">
        <div class="analyse-toolbar">
          <h2>Analyse linguistique</h2>
          <button type="button" class="relancer" :disabled="computingLexical" @click="relancerLexical">
            <i v-if="computingLexical" class="pi pi-spin pi-spinner"></i>
            {{ computingLexical ? 'Analyse en cours…' : lexical ? "Relancer l'analyse" : "Lancer l'analyse" }}
          </button>
          <span v-if="lexical" class="computed-at">
            Calculée le {{ formatDate(lexical.computedAt) }} — modèle {{ lexical.model }}
          </span>
        </div>

        <p v-if="lexicalError" class="state state--error">{{ lexicalError }}</p>
        <p v-if="!lexical" class="state">
          Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
          le calcul peut prendre quelques minutes sur un manuscrit complet.
        </p>

        <template v-else>
          <div class="stats-grid">
            <div v-for="tile in statTiles" :key="tile.label" class="stat-tile">
              <span class="stat-value">{{ tile.value }}</span>
              <span class="stat-label">{{ tile.label }}</span>
            </div>
          </div>

          <h3>Catégories grammaticales</h3>
          <table class="data-table pos-table">
            <tbody>
              <tr v-for="pos in posRows" :key="pos.tag">
                <td>{{ pos.label }}</td>
                <td class="num">{{ formatInt(pos.count) }}</td>
                <td class="num">{{ pos.percent }} %</td>
              </tr>
            </tbody>
          </table>

          <h3>Entités nommées</h3>
          <p v-if="!lexical.entities.length" class="state">Aucune entité détectée.</p>
          <div v-for="group in entityGroups" :key="group.label" class="entity-group">
            <h4>{{ group.title }} <span class="entity-group-count">({{ group.entities.length }})</span></h4>
            <div class="entity-chips">
              <button
                  v-for="entity in group.entities"
                  :key="entity.text"
                  type="button"
                  class="entity-chip"
                  :class="{ 'entity-chip--active': isSelectedEntity(entity) }"
                  @click="toggleEntity(entity)"
              >
                {{ entity.text }} <span class="entity-count">{{ entity.count }}</span>
              </button>
            </div>
          </div>

          <div v-if="selectedNamedEntity" class="word-detail">
            <h3>
              « {{ selectedNamedEntity.text }} » ({{ entityLabelFr(selectedNamedEntity.label) }})
              — {{ selectedNamedEntity.count }} occurrence{{ selectedNamedEntity.count > 1 ? 's' : '' }}
            </h3>
            <NodesTable :nodes="selectedNamedEntity.nodes" @open="goToNode" />
          </div>

          <h3>Par article</h3>
          <table class="data-table units-table">
            <thead>
              <tr>
                <th>Article</th>
                <th class="num">Phrases</th>
                <th class="num">Mots</th>
                <th class="num">Mots / phrase</th>
                <th class="num">Diversité (TTR)</th>
                <th class="num">Densité lexicale</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="unit in lexical.units" :key="unit.nodeId" class="word-node-row" @click="goToNode(unit.nodeId)">
                <td>{{ unit.titre }}</td>
                <td class="num">{{ formatInt(unit.sentences) }}</td>
                <td class="num">{{ formatInt(unit.words) }}</td>
                <td class="num">{{ unit.avgSentenceLength.toLocaleString('fr') }}</td>
                <td class="num">{{ formatPercent(unit.ttr) }}</td>
                <td class="num">{{ formatPercent(unit.lexicalDensity) }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </section>

      <!-- ── Volet proximité sémantique (sentence-camembert via nlp-service) ── -->
      <section class="volet">
        <div class="analyse-toolbar">
          <h2>Proximité sémantique</h2>
          <button type="button" class="relancer" :disabled="computingSemantic" @click="relancerSemantic">
            <i v-if="computingSemantic" class="pi pi-spin pi-spinner"></i>
            {{ computingSemantic ? 'Analyse en cours…' : semantic ? "Relancer l'analyse" : "Lancer l'analyse" }}
          </button>
          <span v-if="semantic" class="computed-at">
            Calculée le {{ formatDate(semantic.computedAt) }} — modèle {{ semantic.model }}
          </span>
        </div>

        <p v-if="semanticError" class="state state--error">{{ semanticError }}</p>
        <p v-if="!semantic" class="state">
          Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
          le premier calcul vectorise tous les paragraphes (plusieurs minutes) ; les suivants
          repartent du cache et ne recalculent que ce qui a changé.
        </p>

        <template v-else>
          <div class="semantic-picker">
            <label for="semantic-focus">Article :</label>
            <select id="semantic-focus" v-model="semanticFocusId">
              <option v-for="unit in semantic.units" :key="unit.nodeId" :value="unit.nodeId">
                {{ unit.titre }}
              </option>
            </select>
            <button v-if="focusUnit" type="button" class="open-node" @click="goToNode(focusUnit.nodeId)">
              Ouvrir <i class="pi pi-arrow-right"></i>
            </button>
          </div>

          <table v-if="focusUnit" class="data-table neighbors-table">
            <thead>
              <tr><th>Article proche</th><th class="score-col">Proximité</th></tr>
            </thead>
            <tbody>
              <tr
                  v-for="neighbor in focusNeighbors"
                  :key="neighbor.nodeId"
                  class="word-node-row"
                  title="Cliquer pour explorer cet article"
                  @click="semanticFocusId = neighbor.nodeId"
              >
                <td>{{ neighbor.titre }}</td>
                <td class="score-col">
                  <span class="score-bar-track">
                    <span class="score-bar" :style="{ width: Math.max(0, neighbor.score * 100) + '%' }"></span>
                  </span>
                  <span class="score-value">{{ formatPercent(neighbor.score) }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <template v-if="duplicatePairs.length">
            <h3>Textes identiques ou quasi identiques</h3>
            <p class="hint">
              Ces articles partagent un texte (presque) mot pour mot — doublons ou refrains du manuscrit.
            </p>
            <table class="data-table pairs-table">
              <tbody>
                <tr
                    v-for="pair in duplicatePairs"
                    :key="pair.key"
                    class="word-node-row"
                    @click="semanticFocusId = pair.a"
                >
                  <td>{{ titreOf(pair.a) }}</td>
                  <td>{{ titreOf(pair.b) }}</td>
                  <td class="num">{{ formatPercent(pair.score) }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <h3>Paires d'articles les plus proches</h3>
          <table class="data-table pairs-table">
            <tbody>
              <tr
                  v-for="pair in topPairs"
                  :key="pair.key"
                  class="word-node-row"
                  title="Cliquer pour explorer cette paire"
                  @click="semanticFocusId = pair.a"
              >
                <td>{{ titreOf(pair.a) }}</td>
                <td>{{ titreOf(pair.b) }}</td>
                <td class="num">{{ formatPercent(pair.score) }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </section>

      <!-- ── Volet thèmes (BERTopic via nlp-service, job asynchrone) ── -->
      <section class="volet">
        <div class="analyse-toolbar">
          <h2>Thèmes</h2>
          <button type="button" class="relancer" :disabled="computingTopics" @click="relancerTopics">
            <i v-if="computingTopics" class="pi pi-spin pi-spinner"></i>
            {{ computingTopics ? 'Extraction en cours…' : topics ? "Relancer l'analyse" : "Lancer l'analyse" }}
          </button>
          <span v-if="topics" class="computed-at">
            Calculée le {{ formatDate(topics.computedAt) }} — {{ topics.segmentsTotal }} segments
          </span>
        </div>

        <div v-if="computingTopics && topicsProgress" class="topics-progress">
          <span class="score-bar-track topics-progress-track">
            <span class="score-bar" :style="{ width: topicsProgress.pct + '%' }"></span>
          </span>
          <span class="topics-progress-label">{{ topicsProgress.step }} ({{ Math.round(topicsProgress.pct) }} %)</span>
        </div>

        <p v-if="topicsError" class="state state--error">{{ topicsError }}</p>
        <p v-if="!topics && !computingTopics" class="state">
          Analyse pas encore calculée. Nécessite le service NLP local (<code>npm run dev:nlp</code>) —
          l'extraction d'un manuscrit complet prend plusieurs minutes, l'avancement s'affiche ici.
        </p>

        <template v-if="topics && !computingTopics">
          <p class="hint">
            {{ topics.topics.length }} thèmes détectés —
            {{ topics.outliers.count }} segments hors thème ({{ formatPercent(topics.outliers.share) }}).
            Les mots listés sont les plus caractéristiques de chaque thème (c-TF-IDF), pas des titres.
          </p>

          <div class="entity-chips topic-chips">
            <button
                v-for="topic in topics.topics"
                :key="topic.topicId"
                type="button"
                class="entity-chip"
                :class="{ 'entity-chip--active': selectedTopicId === topic.topicId }"
                @click="selectedTopicId = selectedTopicId === topic.topicId ? null : topic.topicId"
            >
              {{ topic.label }} <span class="entity-count">{{ topic.count }}</span>
            </button>
          </div>

          <div v-if="selectedTopic" class="word-detail">
            <h3>Thème « {{ selectedTopic.label }} » — {{ selectedTopic.count }} segments ({{ formatPercent(selectedTopic.share) }})</h3>

            <div class="topic-words">
              <span
                  v-for="word in selectedTopic.words"
                  :key="word.word"
                  class="topic-word"
                  :style="{ opacity: 0.55 + 0.45 * (word.weight / selectedTopic.words[0].weight) }"
              >
                {{ word.word }}
              </span>
            </div>

            <h3>Présence par axe</h3>
            <table class="data-table topic-axes-table">
              <tbody>
                <tr v-for="row in selectedTopicByAxe" :key="row.axeId ?? 'liminaire'">
                  <td>{{ row.titre }}</td>
                  <td class="score-col">
                    <span class="score-bar-track">
                      <span class="score-bar" :style="{ width: row.pct + '%' }"></span>
                    </span>
                    <span class="score-value">{{ row.count }} / {{ row.segments }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const MAX_DISPLAYED_WORDS = 150
const MAX_ENTITIES_PER_GROUP = 40

const POS_FR = {
  NOUN: 'Noms', VERB: 'Verbes', ADJ: 'Adjectifs', ADV: 'Adverbes',
  PROPN: 'Noms propres', PRON: 'Pronoms', DET: 'Déterminants',
  ADP: 'Prépositions', AUX: 'Auxiliaires', CCONJ: 'Conjonctions (coord.)',
  SCONJ: 'Conjonctions (subord.)', NUM: 'Numéraux', INTJ: 'Interjections',
  PART: 'Particules', SYM: 'Symboles', X: 'Autres',
}
const ENTITY_LABELS_FR = { PER: 'Personnes', LOC: 'Lieux', ORG: 'Organisations', MISC: 'Divers' }

// Table nœud/occurrences partagée par le détail d'un mot et celui d'une entité.
const NodesTable = (props, { emit }) =>
  h('table', { class: 'word-nodes-table' }, [
    h('thead', [h('tr', [h('th', 'Article'), h('th', 'Occurrences')])]),
    h('tbody', props.nodes.map((n) =>
      h('tr', { key: n.nodeId, class: 'word-node-row', onClick: () => emit('open', n.nodeId) }, [
        h('td', n.titre),
        h('td', String(n.count)),
      ]),
    )),
  ])
NodesTable.props = { nodes: { type: Array, required: true } }
NodesTable.emits = ['open']

const loading = ref(true)
const error = ref(null)
const analysis = ref(null)

const computing = ref(false)
const wfError = ref(null)
const selected = ref(null)

const computingLexical = ref(false)
const lexicalError = ref(null)
const selectedEntityKey = ref(null)

const computingSemantic = ref(false)
const semanticError = ref(null)
const semanticFocusId = ref(null)

const computingTopics = ref(false)
const topicsError = ref(null)
const topicsProgress = ref(null)
const selectedTopicId = ref(null)

const wordFrequency = computed(() => analysis.value?.wordFrequency ?? null)
const lexical = computed(() => analysis.value?.lexical ?? null)
const semantic = computed(() => analysis.value?.semantic ?? null)
const topics = computed(() => analysis.value?.topics ?? null)

async function readJsonOrThrow(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    throw new Error(message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function fetchAnalysis() {
  loading.value = true
  error.value = null
  selected.value = null
  selectedEntityKey.value = null
  try {
    const res = await fetch(`/api/documents/${route.params.id}/analyse`)
    analysis.value = await readJsonOrThrow(res)
  } catch (e) {
    error.value = `Impossible de charger l'analyse : ${e.message}`
  } finally {
    loading.value = false
  }
}

async function relancer() {
  computing.value = true
  wfError.value = null
  try {
    const res = await fetch(`/api/documents/${route.params.id}/analyse`, { method: 'POST' })
    analysis.value = await readJsonOrThrow(res)
    selected.value = null
  } catch (e) {
    wfError.value = `Échec du calcul : ${e.message}`
  } finally {
    computing.value = false
  }
}

async function relancerLexical() {
  computingLexical.value = true
  lexicalError.value = null
  try {
    const res = await fetch(`/api/documents/${route.params.id}/analyse/lexical`, { method: 'POST' })
    analysis.value = await readJsonOrThrow(res)
    selectedEntityKey.value = null
  } catch (e) {
    lexicalError.value = `Échec de l'analyse : ${e.message}`
  } finally {
    computingLexical.value = false
  }
}

async function relancerSemantic() {
  computingSemantic.value = true
  semanticError.value = null
  try {
    const res = await fetch(`/api/documents/${route.params.id}/analyse/semantic`, { method: 'POST' })
    analysis.value = await readJsonOrThrow(res)
  } catch (e) {
    semanticError.value = `Échec de l'analyse : ${e.message}`
  } finally {
    computingSemantic.value = false
  }
}

// Job asynchrone : POST → jobId, puis polling du statut jusqu'à done/error.
// `alive` coupe le polling si la vue est démontée en cours de route.
let alive = true
onUnmounted(() => {
  alive = false
})

const POLL_INTERVAL_MS = 2500

async function relancerTopics() {
  computingTopics.value = true
  topicsError.value = null
  topicsProgress.value = { pct: 0, step: 'démarrage' }
  try {
    const res = await fetch(`/api/documents/${route.params.id}/analyse/topics`, { method: 'POST' })
    const { jobId } = await readJsonOrThrow(res)

    while (alive) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      const statusRes = await fetch(`/api/documents/${route.params.id}/analyse/topics/jobs/${jobId}`)
      const status = await readJsonOrThrow(statusRes)
      topicsProgress.value = { pct: status.pct, step: status.step }
      if (status.status === 'error') throw new Error(status.error)
      if (status.status === 'done') {
        analysis.value = status.analysis
        selectedTopicId.value = null
        break
      }
    }
  } catch (e) {
    topicsError.value = `Échec de l'extraction : ${e.message}`
  } finally {
    computingTopics.value = false
    topicsProgress.value = null
  }
}

onMounted(fetchAnalysis)
watch(() => route.params.id, fetchAnalysis)

// Recale le focus quand l'analyse (re)charge ou que l'article visé disparaît.
watch(
  () => semantic.value?.units,
  (units) => {
    if (!units?.length) {
      semanticFocusId.value = null
    } else if (!units.some((u) => u.nodeId === semanticFocusId.value)) {
      semanticFocusId.value = units[0].nodeId
    }
  },
  { immediate: true },
)

// ── Vocabulaire ──
const displayedWords = computed(() => wordFrequency.value?.entries.slice(0, MAX_DISPLAYED_WORDS) ?? [])
const maxCount = computed(() => displayedWords.value[0]?.count ?? 1)

// Taille = canal principal du nuage de mots (échelle en racine carrée : les
// écarts de fréquence sont souvent très déséquilibrés, une échelle linéaire
// écraserait tous les mots sauf le premier). Couleur volontairement fixe
// (var(--c-accent), même teinte que le reste de l'UI) : faire varier
// l'opacité du texte pour coder la fréquence ferait tomber sous le seuil de
// contraste lisible (4.5:1) pour les mots les moins fréquents — le nombre
// exact reste de toute façon accessible via le titre (survol) et le clic.
function sizeFor(count) {
  const ratio = Math.sqrt(count) / Math.sqrt(maxCount.value)
  return (0.85 + ratio * 1.65).toFixed(2)
}

const selectedEntry = computed(
  () => wordFrequency.value?.entries.find((e) => e.word === selected.value) ?? null,
)

// ── Analyse linguistique ──
const statTiles = computed(() => {
  const g = lexical.value?.global
  if (!g) return []
  return [
    { label: 'mots', value: formatInt(g.words) },
    { label: 'phrases', value: formatInt(g.sentences) },
    { label: 'lemmes uniques', value: formatInt(g.uniqueLemmas) },
    { label: 'mots / phrase', value: g.avgSentenceLength.toLocaleString('fr') },
    { label: 'diversité lexicale (TTR)', value: formatPercent(g.ttr) },
    { label: 'densité lexicale', value: formatPercent(g.lexicalDensity) },
  ]
})

// Tri côté client : le Json persiste en jsonb, qui ne préserve pas l'ordre
// des clés renvoyé par le service Python.
const posRows = computed(() => {
  const counts = lexical.value?.global.posCounts ?? {}
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0) || 1
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([tag, count]) => ({
      tag,
      label: POS_FR[tag] ?? tag,
      count,
      percent: ((count / total) * 100).toFixed(1).replace('.', ','),
    }))
})

const entityGroups = computed(() => {
  const byLabel = new Map()
  for (const entity of lexical.value?.entities ?? []) {
    if (!byLabel.has(entity.label)) byLabel.set(entity.label, [])
    byLabel.get(entity.label).push(entity)
  }
  return Array.from(byLabel.entries()).map(([label, entities]) => ({
    label,
    title: entityLabelFr(label),
    entities: entities.slice(0, MAX_ENTITIES_PER_GROUP),
  }))
})

function entityLabelFr(label) {
  return ENTITY_LABELS_FR[label] ?? label
}

function entityKey(entity) {
  return `${entity.label}::${entity.text}`
}

function isSelectedEntity(entity) {
  return selectedEntityKey.value === entityKey(entity)
}

function toggleEntity(entity) {
  selectedEntityKey.value = isSelectedEntity(entity) ? null : entityKey(entity)
}

const selectedNamedEntity = computed(
  () => lexical.value?.entities.find((e) => entityKey(e) === selectedEntityKey.value) ?? null,
)

// ── Proximité sémantique ──
const semanticTitreById = computed(
  () => new Map((semantic.value?.units ?? []).map((u) => [u.nodeId, u.titre])),
)

function titreOf(nodeId) {
  return semanticTitreById.value.get(nodeId) ?? '(sans titre)'
}

const focusUnit = computed(
  () => semantic.value?.units.find((u) => u.nodeId === semanticFocusId.value) ?? null,
)

const focusNeighbors = computed(
  () => focusUnit.value?.neighbors.map((n) => ({ ...n, titre: titreOf(n.nodeId) })) ?? [],
)

// Au-delà, deux articles partagent un texte identique ou quasi identique
// (doublons réels constatés dans le manuscrit : intros de blocs copiées) —
// information utile mais séparée, sinon elle sature le classement.
const DUPLICATE_THRESHOLD = 0.995

// Paires globales dédupliquées à partir des voisinages top-K (la matrice
// complète n'est pas persistée côté backend).
const allPairs = computed(() => {
  const byKey = new Map()
  for (const unit of semantic.value?.units ?? []) {
    for (const neighbor of unit.neighbors) {
      const key = [unit.nodeId, neighbor.nodeId].sort().join('|')
      const known = byKey.get(key)
      if (!known || known.score < neighbor.score) {
        byKey.set(key, { key, a: unit.nodeId, b: neighbor.nodeId, score: neighbor.score })
      }
    }
  }
  return Array.from(byKey.values()).sort((x, y) => y.score - x.score)
})

const duplicatePairs = computed(
  () => allPairs.value.filter((p) => p.score >= DUPLICATE_THRESHOLD).slice(0, 10),
)

const topPairs = computed(
  () => allPairs.value.filter((p) => p.score < DUPLICATE_THRESHOLD).slice(0, 15),
)

// ── Thèmes ──
const selectedTopic = computed(
  () => topics.value?.topics.find((t) => t.topicId === selectedTopicId.value) ?? null,
)

// Présence du thème sélectionné dans chaque axe, en % des segments de l'axe
// (pas du total : les axes n'ont pas tous la même longueur).
const selectedTopicByAxe = computed(() => {
  if (!selectedTopic.value || !topics.value) return []
  const topicId = selectedTopic.value.topicId
  return topics.value.axes.map((axe) => {
    const count = axe.distribution.find((d) => d.topicId === topicId)?.count ?? 0
    return {
      axeId: axe.axeId,
      titre: axe.titre,
      segments: axe.segments,
      count,
      pct: axe.segments ? (count / axe.segments) * 100 : 0,
    }
  })
})

// ── Utilitaires ──
function goToNode(nodeId) {
  router.push(`/documents/${route.params.id}/noeud/${nodeId}`)
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr')
}

function formatInt(n) {
  return n.toLocaleString('fr')
}

function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1).replace('.', ',')} %`
}
</script>

<style scoped>
.volet + .volet {
  margin-top: 2.5em;
  padding-top: 1.5em;
  border-top: 2px solid var(--c-border, #e0d8cc);
}

.analyse-toolbar {
  display: flex;
  align-items: center;
  gap: 1em;
  margin-bottom: 1.5em;
}

.analyse-toolbar h2 {
  margin: 0;
  font-size: 1.15em;
}

.relancer {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em 1em;
  border: 1px solid var(--c-accent);
  background: var(--c-surface, transparent);
  color: var(--c-accent);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
}

.relancer:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.computed-at {
  font-size: 0.85em;
  opacity: 0.6;
}

.state {
  padding: 1em 0;
  opacity: 0.6;
}

.state--error {
  color: #b3261e;
  opacity: 1;
}

.hint {
  margin: 0 0 0.25em;
  font-size: 0.85em;
  opacity: 0.6;
}

.word-cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2em 0.7em;
  padding: 0.5em 0 1em;
}

.word-chip {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--c-accent);
  font-family: Georgia, serif;
  line-height: 1.2;
  padding: 0.1em 0.25em;
  border-radius: 4px;
}

.word-chip:hover,
.word-chip--active {
  background: var(--c-surface4, rgba(0, 0, 0, 0.06));
  text-decoration: underline;
}

.word-detail {
  margin-top: 1em;
  padding-top: 1em;
  border-top: 1px solid var(--c-border, #e0d8cc);
}

.word-detail :deep(.word-nodes-table),
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
  margin-top: 0.5em;
}

.word-detail :deep(.word-nodes-table th),
.word-detail :deep(.word-nodes-table td),
.data-table th,
.data-table td {
  text-align: left;
  padding: 0.4em 0.6em;
  border-bottom: 1px solid var(--c-border, #e0d8cc);
}

.data-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pos-table {
  max-width: 28em;
}

.word-detail :deep(.word-node-row),
.word-node-row {
  cursor: pointer;
}

.word-detail :deep(.word-node-row:hover),
.word-node-row:hover {
  background: var(--c-surface4, rgba(0, 0, 0, 0.04));
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9em, 1fr));
  gap: 0.75em;
  margin-bottom: 1.5em;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  padding: 0.75em 0.9em;
  border: 1px solid var(--c-border, #e0d8cc);
  border-radius: 8px;
}

.stat-value {
  font-size: 1.3em;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.8em;
  opacity: 0.65;
}

h3 {
  margin: 1.5em 0 0.25em;
  font-size: 1em;
}

.entity-group {
  margin-top: 0.75em;
}

.entity-group h4 {
  margin: 0 0 0.4em;
  font-size: 0.9em;
  opacity: 0.75;
}

.entity-group-count {
  font-weight: normal;
  opacity: 0.6;
}

.entity-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em;
}

.entity-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.25em 0.6em;
  border: 1px solid var(--c-border, #e0d8cc);
  border-radius: 999px;
  background: var(--c-surface, transparent);
  color: inherit;
  cursor: pointer;
  font-size: 0.85em;
}

.entity-chip:hover,
.entity-chip--active {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.entity-count {
  font-size: 0.85em;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.units-table {
  margin-bottom: 1em;
}

.topics-progress {
  display: flex;
  align-items: center;
  gap: 0.75em;
  padding: 0.5em 0 1em;
}

.topics-progress-track {
  width: 16em;
}

.topics-progress-label {
  font-size: 0.85em;
  opacity: 0.7;
}

.topic-chips {
  margin-top: 0.5em;
}

.topic-words {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em 0.8em;
  padding: 0.4em 0 0.6em;
  font-family: Georgia, serif;
  font-size: 1.05em;
  color: var(--c-accent);
}

.topic-axes-table {
  max-width: 44em;
}

.semantic-picker {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin: 0.5em 0 0.75em;
}

.semantic-picker select {
  max-width: 28em;
  padding: 0.35em 0.5em;
  border: 1px solid var(--c-border, #e0d8cc);
  border-radius: 6px;
  background: var(--c-surface, transparent);
  color: inherit;
  font: inherit;
}

.open-node {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.35em 0.7em;
  border: 1px solid var(--c-border, #e0d8cc);
  border-radius: 6px;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.85em;
}

.open-node:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.neighbors-table,
.pairs-table {
  max-width: 44em;
}

.score-col {
  width: 14em;
  white-space: nowrap;
}

.score-bar-track {
  display: inline-block;
  vertical-align: middle;
  width: 8em;
  height: 0.5em;
  margin-right: 0.6em;
  border-radius: 999px;
  background: var(--c-surface4, rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.score-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--c-accent);
}

.score-value {
  font-variant-numeric: tabular-nums;
  font-size: 0.9em;
}
</style>
