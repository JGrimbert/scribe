<template>
  <UiTable v-if="styles.length" scroll>
<!--    <thead>
      <tr>
        <th>style</th>
        <th>extrait</th>
        <th class="role-col">rôle</th>
      </tr>
    </thead>-->
    <tbody>
      <tr v-for="style in styles" :key="style.name">
        <td>
          <span class="style-name">{{ style.name }}</span>
          <BaseChip v-if="style.headings" class="heading-chip" :title="`${style.headings} usage(s) comme titre`">
            titre
          </BaseChip>
        </td>
        <td class="sample">{{ style.sample || '—' }}</td>
        <td class="role-col">
          <BaseSelect v-model="styleRoles[style.name]">
            <option v-for="role in STYLE_ROLES" :key="role" :value="role">{{ role }}</option>
          </BaseSelect>
        </td>
        <!-- Colonne « exigé » : la règle d'éligibilité « un paragraphe de ce
             rôle » remonte ici, sur la ligne du style qui la porte. Dédoublonnée
             (1re ligne du rôle) pour ne pas offrir deux contrôles d'une décision
             qui est par rôle, pas par style. -->
        <td v-if="showRequire" class="require-col">
          <label
              v-if="requireByStyle[style.name]"
              class="require"
              :class="{ 'require--disabled': rulesDisabled }"
              :title="requireTitle(requireByStyle[style.name])"
          >
            <input
                type="checkbox"
                :checked="isRequired(requireByStyle[style.name])"
                :disabled="rulesDisabled"
                @change="toggleRequire(requireByStyle[style.name])"
            />
            <span>exigé</span>
          </label>
        </td>
      </tr>
    </tbody>
  </UiTable>
  <p v-else class="empty">Aucun style situé ici.</p>
</template>

<script setup>
import { computed } from 'vue'
import BaseChip from '../ui/atoms/BaseChip.vue'
import BaseSelect from '../ui/atoms/BaseSelect.vue'
import UiTable from '../ui/molecules/UiTable.vue'
import { STYLE_ROLES, REQUIRABLE_ROLES } from '../../script/typology'

// `styleRoles` est muté en place (v-model sur `styleRoles[style.name]`) :
// c'est la map réactive de la typologie, détenue par le composable, comme
// `RuleSetForm` mute son `ruleSet`. Les styles arrivent déjà dans l'ordre
// d'apparition (cf. groupByZone / firstIndex).
const props = defineProps({
  styles: { type: Array, required: true },
  styleRoles: { type: Object, required: true },
  // Colonne « exigé » (niveaux de chapitrage seulement) : quand true, `ruleSet`
  // doit être fourni (jeu effectif du niveau, propre ou défaut).
  showRequire: { type: Boolean, default: false },
  ruleSet: { type: Object, default: null },
  // Grisé quand le niveau suit le défaut (on montre l'exigence du défaut sans
  // pouvoir la toucher ici — même contrat que RuleSetForm.disabled).
  rulesDisabled: { type: Boolean, default: false },
})

// Rôles dont l'exigence remonte dans la table. « tableau » y figure : exiger un
// « tableau des liens », c'est exiger un nœud de rôle tableau — juste stocké à
// part (`requiresTable` booléen) parce que le parseur range les tableaux à part.
const INLINE_ROLES = [...REQUIRABLE_ROLES, 'tableau']

// Rôle exigible à afficher pour chaque ligne, ou null. Réactif sur le rôle
// courant (le dropdown peut le changer) ; ne retient que la 1re occurrence d'un
// rôle, les suivantes rendent une cellule vide.
const requireByStyle = computed(() => {
  const seen = new Set()
  const map = {}
  for (const s of props.styles) {
    const role = props.styleRoles[s.name]
    if (INLINE_ROLES.includes(role) && !seen.has(role)) {
      seen.add(role)
      map[s.name] = role
    } else {
      map[s.name] = null
    }
  }
  return map
})

function isRequired(role) {
  return role === 'tableau'
      ? props.ruleSet.requiresTable
      : props.ruleSet.requiresRoles.includes(role)
}

function requireTitle(role) {
  return role === 'tableau'
      ? 'Exiger un tableau des liens à ce niveau'
      : `Exiger un paragraphe « ${role} » à ce niveau`
}

// Mute le jeu en place, comme RuleSetForm : `requiresTable` booléen pour tableau,
// sinon présence dans `requiresRoles`.
function toggleRequire(role) {
  if (role === 'tableau') {
    props.ruleSet.requiresTable = !props.ruleSet.requiresTable
    return
  }
  const roles = props.ruleSet.requiresRoles
  const i = roles.indexOf(role)
  if (i === -1) roles.push(role)
  else roles.splice(i, 1)
}
</script>

<style scoped>
.style-name {
  font-weight: 500;
}

.heading-chip {
  margin-left: var(--sp-2);
}

/* L'extrait sert à reconnaître le style d'un coup d'œil, pas à être lu : il
   cède la place et se coupe. */
.sample {
  color: var(--c-ink2);
  font-family: var(--font-serif);
  max-width: 32em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-col {
  width: 1%;
  white-space: nowrap;
}

.require-col {
  width: 1%;
  white-space: nowrap;
}

.require {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.require--disabled {
  opacity: var(--op-muted);
  cursor: not-allowed;
}

.empty {
  margin: var(--sp-2) 0 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
}
</style>
