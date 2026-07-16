<template>
  <div class="styles-view">
    <header class="styles-header">
      <h2>Typologie des styles</h2>
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
      <section class="styles-section">
        <h3>Styles de paragraphe <span class="count">{{ inventory.styles.length }}</span></h3>
        <UiTable>
          <thead>
            <tr>
              <th class="num">usages</th>
              <th>style</th>
              <th>extrait</th>
              <th class="role-col">rôle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="style in inventory.styles" :key="style.name">
              <td class="num">{{ style.count }}</td>
              <td>
                <span class="style-name">{{ style.name }}</span>
                <BaseChip v-if="style.headings" class="heading-chip" :title="`${style.headings} usage(s) comme titre`">
                  titre
                </BaseChip>
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
      </section>

      <section v-if="inventory.highlights.length" class="styles-section">
        <h3>Surlignages <span class="count">{{ inventory.highlights.length }}</span></h3>
        <UiNote variant="hint">
          Un surlignage marque l'état du texte, pas sa structure. « Annotation » = du travail en
          attente : un chapitre qui en contient ne pourra pas être validé.
        </UiNote>
        <UiTable>
          <thead>
            <tr>
              <th>couleur</th>
              <th class="num">paragraphes</th>
              <th class="num">inline</th>
              <th>extrait</th>
              <th class="role-col">rôle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hl in inventory.highlights" :key="hl.color">
              <td>
                <span class="swatch" :style="{ background: hl.color }"></span>
                <code>{{ hl.color }}</code>
              </td>
              <td class="num">{{ hl.paragraphs }}</td>
              <td class="num">{{ hl.spans }}</td>
              <td class="sample">{{ hl.sample || '—' }}</td>
              <td class="role-col">
                <BaseSelect v-model="highlights[hl.color]">
                  <option v-for="role in HIGHLIGHT_ROLES" :key="role" :value="role">{{ role }}</option>
                </BaseSelect>
              </td>
            </tr>
          </tbody>
        </UiTable>
      </section>

      <footer class="styles-footer">
        <UiNote v-if="saveError" variant="error">{{ saveError }}</UiNote>
        <UiNote v-else-if="saved" variant="hint">Typologie enregistrée.</UiNote>
        <UiNote v-else-if="!settled" variant="hint">
          Pas encore arbitrée — le tableau de bord le signale tant que vous n'avez pas validé.
        </UiNote>
        <BaseButton variant="solid" :busy="saving" @click="save">Enregistrer la typologie</BaseButton>
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
import UiNote from './ui/UiNote.vue'
import UiTable from './ui/UiTable.vue'

// Vocabulaires fermés, alignés sur STYLE_ROLES/HIGHLIGHT_ROLES du backend
// (typology.ts), qui refuse tout rôle hors liste.
const STYLE_ROLES = [
  'corps', 'titre', 'chapeau', 'citation', 'définition',
  'renvoi', 'tableau', 'liste', 'ornement', 'liminaire', 'ignorer',
]
const HIGHLIGHT_ROLES = ['annotation', 'emphase', 'ignorer']

const route = useRoute()

const loading = ref(true)
const loadError = ref(null)
const saveError = ref(null)
const saving = ref(false)
const saved = ref(false)
const settled = ref(false)
const inventory = ref({ styles: [], highlights: [] })

// Le formulaire. Pré-rempli par les suggestions du backend, écrasées par ce
// qui a déjà été décidé : l'utilisateur voit une proposition, jamais une
// décision qu'il n'a pas prise (rien n'est persisté avant qu'il n'enregistre).
const styles = reactive({})
const highlights = reactive({})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const res = await fetch(`/api/documents/${route.params.id}/typology`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    inventory.value = data.inventory
    settled.value = data.settled
    Object.assign(styles, data.suggested.styles, data.typology?.styles ?? {})
    Object.assign(highlights, data.suggested.highlights, data.typology?.highlights ?? {})
  } catch (e) {
    loadError.value = `Impossible de charger la typologie : ${e.message}`
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  saved.value = false
  try {
    const res = await fetch(`/api/documents/${route.params.id}/typology`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ styles: { ...styles }, highlights: { ...highlights } }),
    })
    const body = await res.json()
    if (!res.ok) {
      throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? `HTTP ${res.status}`)
    }
    settled.value = body.settled
    saved.value = true
  } catch (e) {
    saveError.value = `Enregistrement impossible : ${e.message}`
  } finally {
    saving.value = false
  }
}

// Toute modification efface l'accusé d'enregistrement : sinon « Typologie
// enregistrée » resterait affiché au-dessus de changements qui, eux, ne le
// sont pas.
watch([styles, highlights], () => { saved.value = false })

watch(() => route.params.id, load, { immediate: true })
</script>

<style scoped>
.styles-view {
  padding: 1.25em;
  max-width: 70em;
}

.styles-header h2 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lg);
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
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  vertical-align: -0.15em;
  margin-right: var(--sp-2);
}

.styles-footer {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-top: var(--sp-6);
}
</style>
