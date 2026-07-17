<template>
  <div class="styles-view">
    <header class="styles-header">
      <UiNote variant="hint">
        Ce que chaque style de votre <code>.odt</code> veut dire dans ce livre. Les rôles proposés
        ci-dessous sont des suggestions déduites du nom du style — rien n'est enregistré tant que
        vous n'avez pas validé. Ils serviront ensuite à décider ce qu'un chapitre doit contenir
        pour être validable.
      </UiNote>
      <UiNote v-if="loadError" variant="error">{{ loadError }}</UiNote>
      <UiNote v-else-if="!loading && !inventory.styles.length" variant="hint">
        Aucun style relevé pour ce document. Il a été importé avant que le parseur ne les relève —
        le <code>.odt</code> d'origine n'étant pas conservé, seul un réimport peut les récupérer.
      </UiNote>
    </header>

    <template v-if="inventory.styles.length">
      <!-- Rangée 1 — les rôles, et EN REGARD les motifs qu'ils composent : c'est
           tout l'intérêt de la grille. Changer un rôle recompose les modèles dans
           le même tick ; deux écrans plus bas, ce lien était invisible. -->
      <AnalyseBlock aside="right">
        <template #main>
          <h3>Styles de paragraphe <span class="count">{{ inventory.styles.length }}</span></h3>
          <UiNote v-if="zoned" variant="hint">
            Rangés dans l'ordre du livre, chacun dans la zone où il pèse le plus. La barre montre sa
            répartition réelle : un style d'une seule couleur signe sa zone, un style bariolé est
            transverse.
          </UiNote>

          <template v-for="section in zoneSections" :key="section.zone.key">
            <h4 class="zone-heading">
              <span class="zone-swatch" :style="{ background: section.zone.color }"></span>
              {{ section.zone.label }}
              <span class="count">{{ section.styles.length }}</span>
              <span class="zone-hint">{{ section.zone.hint }}</span>
            </h4>
            <UiTable>
              <thead>
                <tr>
                  <th class="num">usages</th>
                  <th>style</th>
                  <th v-if="zoned" class="zone-col">répartition</th>
                  <th>extrait</th>
                  <th class="role-col">rôle</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="style in section.styles" :key="style.name">
                  <td class="num">{{ style.count }}</td>
                  <td>
                    <span class="style-name">{{ style.name }}</span>
                    <BaseChip v-if="style.headings" class="heading-chip" :title="`${style.headings} usage(s) comme titre`">
                      titre
                    </BaseChip>
                  </td>
                  <td v-if="zoned" class="zone-col">
                    <StackedBar v-if="totalOf(style.byZone)" :segments="zoneSegments(style.byZone)" />
                    <span v-else class="zone-none" title="Aucun usage situé — paragraphes sans texte">—</span>
                  </td>
                  <td class="sample">{{ style.sample || '—' }}</td>
                  <td class="role-col">
                    <BaseSelect v-model="styles[style.name]">
                      <option v-for="role in STYLE_ROLES" :key="role" :value="role">{{ role }}</option>
                    </BaseSelect>
                  </td>
                </tr>
              </tbody>
            </UiTable>
          </template>
        </template>

        <template #aside>
          <UiCard title="Modèles de structure">
            <p class="card-lead">Les formes qui reviennent, niveau par niveau.</p>
            <UiNote v-if="shapesError" variant="error">{{ shapesError }}</UiNote>
            <p v-else-if="!shapeGroups.length" class="signature-none">Aucun modèle à ce stade.</p>

            <div v-for="group in shapeGroups" :key="group.zone.key" class="shape-group">
              <h4 class="zone-heading">
                <span class="zone-swatch" :style="{ background: group.zone.color }"></span>
                {{ group.zone.label }}
                <span class="zone-hint">{{ group.total - group.empty }}/{{ group.total }} rédigés</span>
              </h4>

              <ul v-if="group.signatures.length" class="signatures">
                <!-- Empilé, pas en rangée : dans un tiers de largeur, une
                     signature et sa barre côte à côte se marchent dessus. -->
                <li v-for="signature in group.signatures.slice(0, 4)" :key="signature.key" class="signature">
                  <code class="signature-label" :title="signature.nodes.map((n) => n.titre).join(', ')">
                    {{ signature.label }}
                  </code>
                  <div class="signature-row">
                    <ScoreBar :pct="signature.pct" :label="`${signature.pct} %`" track-width="3.5em" />
                    <span class="signature-count">{{ signature.count }}</span>
                  </div>
                </li>
              </ul>
              <p v-else class="signature-none">Aucun nœud rédigé — rien à modéliser.</p>
            </div>
          </UiCard>
        </template>
      </AnalyseBlock>

      <!-- Rangée 2 — les règles, et les surlignages dont elles se servent : le
           rôle « annotation » est ce qui rend un chapitre non conforme. -->
      <AnalyseBlock aside="right">
        <template #main>
          <h3>Règles d'éligibilité</h3>
          <UiNote variant="hint">
            Ce qu'un nœud doit contenir pour être réputé prêt, niveau par niveau — ce qu'on attend
            d'un axe n'est pas ce qu'on attend d'un article. <strong>Indicatif</strong> : le tableau
            de bord compte les nœuds conformes, mais rien n'empêche de valider un chapitre à la main.
          </UiNote>

          <div class="rule-tabs" role="tablist">
            <button
                v-for="tab in DEPTH_TABS"
                :key="tab.key"
                class="rule-tab"
                :class="{ 'rule-tab--active': activeTab === tab.key }"
                type="button"
                role="tab"
                :aria-selected="activeTab === tab.key"
                :title="tab.hint"
                @click="activeTab = tab.key"
            >
              {{ tab.label }}
              <span v-if="tab.key !== 'default' && rules.byDepth[tab.key]" class="rule-tab-dot" title="Règles propres à ce niveau"></span>
            </button>
          </div>

          <div class="rule-panel">
            <template v-if="activeTab === 'default'">
              <p class="rule-scope">S'applique à tout niveau qui n'a pas ses propres règles.</p>
              <RuleSetForm :rule-set="rules.default" />
            </template>

            <template v-else>
              <label class="rule rule-override">
                <input type="checkbox" :checked="!!rules.byDepth[activeTab]" @change="toggleDepth(activeTab)" />
                <span>Des règles propres à « {{ activeTabLabel }} »</span>
              </label>

              <RuleSetForm v-if="rules.byDepth[activeTab]" :rule-set="rules.byDepth[activeTab]" />
              <p v-else class="rule-scope">
                Ce niveau suit les règles par défaut. Cocher ci-dessus part d'une copie du défaut —
                et fait juger ces nœuds même s'ils ne sont pas des chapitres.
              </p>
            </template>
          </div>
        </template>

        <template #aside>
          <UiCard :title="`Surlignages (${inventory.highlights.length})`">
            <p class="card-lead">Un surlignage marque l'état du texte, pas sa structure.</p>
            <p v-if="!inventory.highlights.length" class="signature-none">Aucun surlignage relevé.</p>

            <!-- Liste empilée et non tableau : six colonnes ne tiennent pas dans
                 un tiers de largeur, et « annotation » se décide couleur par
                 couleur, pas en comparant des colonnes. -->
            <ul v-else class="hl-list">
              <li v-for="hl in inventory.highlights" :key="hl.color" class="hl">
                <div class="hl-head">
                  <span class="swatch" :style="{ background: hl.color }"></span>
                  <code>{{ hl.color }}</code>
                  <span class="hl-counts">{{ hl.paragraphs }} ¶ · {{ hl.spans }} inline</span>
                </div>
                <StackedBar v-if="zoned && totalOf(hl.byZone)" :segments="zoneSegments(hl.byZone)" />
                <p v-if="hl.sample" class="hl-sample" :title="hl.sample">{{ hl.sample }}</p>
                <BaseSelect v-model="highlights[hl.color]">
                  <option v-for="role in HIGHLIGHT_ROLES" :key="role" :value="role">{{ role }}</option>
                </BaseSelect>
              </li>
            </ul>
          </UiCard>
        </template>
      </AnalyseBlock>

      <footer class="styles-footer">
        <UiNote v-if="saveError" variant="error">{{ saveError }}</UiNote>
        <UiNote v-else-if="saved" variant="hint">Configuration enregistrée.</UiNote>
        <UiNote v-else-if="!settled" variant="hint">
          Pas encore arbitrée — le tableau de bord le signale tant que vous n'avez pas validé.
        </UiNote>
        <BaseButton variant="solid" :busy="saving" @click="save">Enregistrer la configuration</BaseButton>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from './ui/BaseButton.vue'
import BaseChip from './ui/BaseChip.vue'
import BaseSelect from './ui/BaseSelect.vue'
import ScoreBar from './ui/ScoreBar.vue'
import StackedBar from './ui/StackedBar.vue'
import UiCard from './ui/UiCard.vue'
import UiNote from './ui/UiNote.vue'
import UiTable from './ui/UiTable.vue'
import AnalyseBlock from './analyse/AnalyseBlock.vue'
import RuleSetForm from './RuleSetForm.vue'
import { groupByZone, hasZones, totalOf, zoneSegments } from '../script/zones'
import { DEPTH_TABS, emptyRuleSet, HIGHLIGHT_ROLES, STYLE_ROLES } from '../script/typology'
import { useStructureShapes } from '../composables/useStructureShapes'

const route = useRoute()

const loading = ref(true)
const loadError = ref(null)
const saveError = ref(null)
const saving = ref(false)
const saved = ref(false)
const settled = ref(false)
const inventory = ref({ styles: [], highlights: [] })

// Un document importé avant la ventilation n'a pas de byZone : on retombe alors
// sur une section unique, l'ancien tableau plat trié par fréquence. Le .odt
// n'étant pas conservé, seul un réimport le ventile.
const zoned = computed(() => hasZones(inventory.value.styles))

const zoneSections = computed(() =>
    zoned.value
        ? groupByZone(inventory.value.styles)
        : [{ zone: { key: 'all', label: 'Tous les styles', hint: 'Réimportez le document pour les situer dans le livre', color: 'var(--c-border)' }, styles: inventory.value.styles }],
)

// Le formulaire. Pré-rempli par les suggestions du backend, écrasées par ce
// qui a déjà été décidé : l'utilisateur voit une proposition, jamais une
// décision qu'il n'a pas prise (rien n'est persisté avant qu'il n'enregistre).
const styles = reactive({})
const highlights = reactive({})

// `default` + un jeu optionnel par profondeur (cf. rules.ts côté backend). Un
// byDepth vide = le cas nominal : un seul jeu, appliqué aux feuilles, comme
// avant les règles par niveau.
const rules = reactive({ default: emptyRuleSet(), byDepth: {} })

const activeTab = ref('default')
const activeTabLabel = computed(() => DEPTH_TABS.find((t) => t.key === activeTab.value)?.label ?? '')

// Cocher part d'une COPIE du défaut plutôt que d'un jeu vide : on règle
// presque toujours par écart au défaut, et partir de rien ferait passer le
// niveau pour « sans aucune exigence » le temps de tout recocher.
function toggleDepth(key) {
  if (rules.byDepth[key]) delete rules.byDepth[key]
  else rules.byDepth[key] = { ...rules.default, requiresRoles: [...rules.default.requiresRoles] }
}

// Les modèles se recalculent contre `styles` — la typologie en cours d'édition,
// pas celle enregistrée : les motifs suivent les rôles à mesure qu'on les
// attribue.
const { groups: shapeGroups, error: shapesError, load: loadShapes } = useStructureShapes(styles)

async function load() {
  loading.value = true
  loadError.value = null

  // À part, et sans await : les modèles sont un complément. Leur échec porte son
  // propre message et ne doit pas masquer la typologie, qui est l'objet de
  // l'écran.
  loadShapes(route.params.id)

  try {
    const [typoRes, rulesRes] = await Promise.all([
      fetch(`/api/documents/${route.params.id}/typology`),
      fetch(`/api/documents/${route.params.id}/rules`),
    ])
    if (!typoRes.ok) throw new Error(`HTTP ${typoRes.status}`)
    if (!rulesRes.ok) throw new Error(`HTTP ${rulesRes.status}`)

    const data = await typoRes.json()
    inventory.value = data.inventory
    settled.value = data.settled
    Object.assign(styles, data.suggested.styles, data.typology?.styles ?? {})
    Object.assign(highlights, data.suggested.highlights, data.typology?.highlights ?? {})

    // Le backend normalise (défauts si jamais configuré, format historique à
    // plat remonté en `default`) : ce qui arrive ici est toujours du format
    // courant.
    const loaded = await rulesRes.json()
    rules.default = loaded.default
    rules.byDepth = loaded.byDepth ?? {}
  } catch (e) {
    loadError.value = `Impossible de charger la configuration : ${e.message}`
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  saved.value = false
  try {
    // Désérialisé en profondeur : `rules` est un proxy réactif imbriqué, et un
    // spread de surface enverrait des proxies dans le JSON.
    const [typoBody] = await Promise.all([
      put('typology', { styles: { ...styles }, highlights: { ...highlights } }),
      put('rules', JSON.parse(JSON.stringify(rules))),
    ])
    settled.value = typoBody.settled
    saved.value = true
  } catch (e) {
    saveError.value = `Enregistrement impossible : ${e.message}`
  } finally {
    saving.value = false
  }
}

async function put(path, payload) {
  const res = await fetch(`/api/documents/${route.params.id}/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? `HTTP ${res.status}`)
  }
  return body
}

// Toute modification efface l'accusé d'enregistrement : sinon « Typologie
// enregistrée » resterait affiché au-dessus de changements qui, eux, ne le
// sont pas.
watch([styles, highlights, rules], () => { saved.value = false })

watch(() => route.params.id, load, { immediate: true })
</script>

<style scoped>
/* Volet de ConfigView, plus une page : le padding et le décrochement sous la
   DocumentBar appartiennent à l'hôte. */

/* `analyse.css` étire la dernière card d'une colonne étroite pour aligner son
   bas sur la viz — pertinent pour une viz de hauteur comparable, absurde ici :
   le tableau des styles fait 2000+ px, la card en ferait autant pour 850 px de
   contenu, et les modèles quitteraient l'écran dès la deuxième zone. On la
   décolle donc du flux vertical et on la colle en haut : le point de la grille
   est de VOIR les motifs se recomposer pendant qu'on attribue les rôles. */
.styles-view :deep(.split-right > .ui-card) {
  flex: 0 0 auto;
  position: sticky;
  top: calc(var(--bar-size) + var(--sp-2));
}

.styles-section {
  margin-top: var(--sp-6);
}

.styles-section h3 {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  opacity: var(--op-muted);
}

.count {
  opacity: var(--op-faint);
  font-weight: 400;
}

/* Une zone du livre : un cran sous le titre de section, au-dessus de son
   tableau. La pastille reprend la couleur des segments de la barre — c'est ce
   qui relie « où je suis » à « ce que je lis dans la répartition ». */
.zone-heading {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: var(--sp-6) 0 var(--sp-2);
  font-size: var(--fs-md);
  font-weight: 600;
}

.zone-swatch {
  width: 0.6em;
  height: 0.6em;
  border-radius: var(--radius-sm);
  align-self: center;
  flex-shrink: 0;
}

.zone-hint {
  font-weight: 400;
  font-size: var(--fs-sm);
  opacity: var(--op-faint);
}

.zone-col {
  width: 1%;
  white-space: nowrap;
}

.zone-none {
  opacity: var(--op-faint);
}

.shape-group {
  margin-bottom: var(--sp-4);
}

/* Une liste, pas un tableau : une signature est une phrase (« définition ·
   corps×2 »), pas une ligne de données à comparer colonne par colonne. */
.signatures {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

/* Empilée (label puis barre) : en colonne étroite, la mettre en rangée
   écraserait le label, qui est l'information. */
.signature {
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  font-size: var(--fs-sm);
  min-width: 0;
}

.signature-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.signature-count {
  font-variant-numeric: tabular-nums;
  opacity: var(--op-muted);
}

/* Le motif complet ne tient pas toujours : il se coupe, l'infobulle porte les
   chapitres qui l'illustrent. */
.signature-label {
  font-family: var(--font-ui);
  padding: 0.1em 0.5em;
  border-radius: var(--radius-md);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.signature-none {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
}

.style-name {
  font-weight: 500;
}

.heading-chip {
  margin-left: var(--sp-2);
}

/* L'extrait est là pour reconnaître le style d'un coup d'œil, pas pour être
   lu : il cède la place au reste et se coupe. */
.sample {
  color: var(--c-ink2);
  font-family: var(--font-serif);
  max-width: 26em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-col {
  width: 1%;
  white-space: nowrap;
}

.swatch {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  vertical-align: -0.15em;
}

/* ── Surlignages en colonne étroite ── */
.hl-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.hl {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 0;
}

.hl-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}

.hl-counts {
  margin-left: auto;
  color: var(--c-ink2);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hl-sample {
  margin: 0;
  color: var(--c-ink2);
  font-family: var(--font-serif);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.styles-footer {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-top: var(--sp-6);
}

.rule-tabs {
  display: flex;
  gap: var(--sp-1);
  margin-top: var(--sp-4);
  border-bottom: 1px solid var(--c-border);
}

.rule-tab {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--fs-md);
  cursor: pointer;
  opacity: var(--op-muted);
}

.rule-tab--active {
  border-bottom-color: var(--c-accent);
  opacity: 1;
  font-weight: 600;
}

/* Un niveau qui porte ses propres règles : sans ce repère, il faut ouvrir les
   quatre onglets pour savoir lesquels sont réglés. */
.rule-tab-dot {
  width: 0.4em;
  height: 0.4em;
  border-radius: var(--radius-pill);
  background: var(--c-accent);
}

.rule-panel {
  padding-top: var(--sp-2);
}

.rule-scope {
  margin: var(--sp-3) 0 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
  max-width: 52ch;
}

.rule {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-md);
  cursor: pointer;
}

.rule-override {
  margin-top: var(--sp-3);
  font-weight: 500;
}
</style>
