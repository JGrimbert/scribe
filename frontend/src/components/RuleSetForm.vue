<template>
  <div class="rules">
    <label class="rule">
      <input v-model="ruleSet.forbidAnnotations" type="checkbox" />
      <span>Aucune annotation surlignée en attente</span>
    </label>

    <label class="rule">
      <input :checked="ruleSet.minChars != null" type="checkbox" @change="toggleMinChars" />
      <span>Au moins</span>
      <input
          v-model.number="minCharsDraft"
          class="rule-number"
          type="number"
          min="0"
          step="100"
          :disabled="ruleSet.minChars == null"
      />
      <span>caractères</span>
    </label>

    <label class="rule">
      <input v-model="ruleSet.requiresTable" type="checkbox" />
      <span>Un tableau des liens</span>
    </label>

    <label v-for="role in REQUIRABLE_ROLES" :key="role" class="rule">
      <input type="checkbox" :checked="ruleSet.requiresRoles.includes(role)" @change="toggleRole(role)" />
      <span>Un paragraphe « {{ role }} »</span>
    </label>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { REQUIRABLE_ROLES } from '../script/typology'

// Un jeu de critères. `ruleSet` est muté en place, délibérément : le parent
// détient l'objet réactif complet (`rules`), et le faire remonter par
// `update:modelValue` à chaque case cochée recréerait des objets pour rien —
// alors qu'il y a jusqu'à quatre jeux vivants à l'écran.
const props = defineProps({
  ruleSet: { type: Object, required: true },
})

// Mémoire du seuil quand on décoche « au moins N caractères » : le décocher
// puis le recocher ne doit pas effacer le chiffre saisi. Interne au composant —
// chaque jeu garde donc le sien, ce qu'un draft partagé par le parent ne
// permettait pas.
const minCharsDraft = ref(props.ruleSet.minChars ?? 500)

function toggleMinChars(event) {
  props.ruleSet.minChars = event.target.checked ? (minCharsDraft.value ?? 0) : null
}

function toggleRole(role) {
  const i = props.ruleSet.requiresRoles.indexOf(role)
  if (i === -1) props.ruleSet.requiresRoles.push(role)
  else props.ruleSet.requiresRoles.splice(i, 1)
}

watch(minCharsDraft, (v) => {
  if (props.ruleSet.minChars != null) props.ruleSet.minChars = v ?? 0
})

// Changer d'onglet remonte un autre jeu : le brouillon doit suivre, sinon le
// seuil d'un niveau s'afficherait dans le champ d'un autre.
watch(
    () => props.ruleSet,
    (set) => { minCharsDraft.value = set.minChars ?? minCharsDraft.value ?? 500 },
)
</script>

<style scoped>
.rules {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
}

.rule {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-md);
  cursor: pointer;
}

.rule-number {
  width: 5em;
  padding: 0.25em 0.4em;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
  color: inherit;
  font: inherit;
  font-size: var(--fs-md);
}

.rule-number:disabled {
  opacity: var(--op-faint);
}
</style>
