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
      </tr>
    </tbody>
  </UiTable>
  <p v-else class="empty">Aucun style situé ici.</p>
</template>

<script setup>
import BaseChip from './ui/BaseChip.vue'
import BaseSelect from './ui/BaseSelect.vue'
import UiTable from './ui/UiTable.vue'
import { STYLE_ROLES } from '../script/typology'

// `styleRoles` est muté en place (v-model sur `styleRoles[style.name]`) :
// c'est la map réactive de la typologie, détenue par le composable, comme
// `RuleSetForm` mute son `ruleSet`. Les styles arrivent déjà dans l'ordre
// d'apparition (cf. groupByZone / firstIndex).
defineProps({
  styles: { type: Array, required: true },
  styleRoles: { type: Object, required: true },
})
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

.empty {
  margin: var(--sp-2) 0 0;
  color: var(--c-ink2);
  font-size: var(--fs-md);
}
</style>
