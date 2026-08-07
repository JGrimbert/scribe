<template>
  <!-- Ligne de style en callout : nom (+ crayon d'édition d'apparence) puis, en
       dessous, ses deux réglages liminaire — « ce qui précède » et le rôle. C'est
       la ligne de StyleRolesTable réduite aux 3 colonnes utiles à une planche
       liminaire. Brique NUE : les mutations (rôle / précède / édition) remontent par
       événement, l'hôte les câble sur la typologie. -->
  <div class="fc-row fc-srow" :ref="measureRef"
       @mouseenter="$emit('hover', item.name)" @mouseleave="$emit('hover', null)">
    <span class="fc-row__label fc-srow__name">
      <button v-if="canEdit && !item.declared" class="fc-srow__edit"
              :class="{ 'fc-srow__edit--mod': modified }"
              :title="modified ? 'Apparence modifiée — éditer' : 'Éditer l\'apparence de ce style'"
              @click="$emit('edit', item.name)">
        <i class="pi pi-pencil" aria-hidden="true"></i>
        <span v-if="modified" class="fc-srow__dot" aria-hidden="true"></span>
      </button>
      <span class="fc-srow__style" :title="item.name">{{ item.name }}</span>
    </span>
    <span class="fc-srow__controls">
      <BareSelect
          :model-value="precedesLocked ? 'blank' : precedes"
          :disabled="precedesLocked"
          :options="PRECEDES_OPTIONS"
          @update:model-value="$emit('update:precedes', $event)" />
      <BareSelect
          :model-value="role"
          :options="ROLE_OPTIONS"
          @update:model-value="$emit('update:role', $event)" />
      <!-- Exiger un paragraphe de ce style au niveau (chapitrage). -->
      <label v-if="showRequire" class="fc-srow__require"
             :title="`Exiger un paragraphe « ${item.name} » à ce niveau`">
        <input type="checkbox" :checked="required" @change="$emit('toggle-require')" />
        exigé
      </label>
    </span>
  </div>
</template>

<script setup>
import BareSelect from '../BareSelect.vue'
import './callouts.css'
import { STYLE_ROLES } from '../../../script/typology'
import { PRECEDES_KINDS, PRECEDES_LABELS } from '../../../script/liminaire-vocab'

defineProps({
  item: { type: Object, required: true }, // { name, declared? }
  role: { type: String, default: null },
  precedes: { type: String, default: 'none' },
  // 1re page du liminaire : suit toujours la garde (blanche, folio 0) → select figé.
  precedesLocked: { type: Boolean, default: false },
  // Apparence surchargée (pastille sur le crayon) ; crayon présent si éditable.
  modified: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  // Case « exigé » (chapitrage) : présente si showRequire, cochée si required.
  showRequire: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  measureRef: { type: Function, default: null },
})
defineEmits(['hover', 'edit', 'update:role', 'update:precedes', 'toggle-require'])

const ROLE_OPTIONS = STYLE_ROLES.map((r) => ({ value: r, label: r }))
const PRECEDES_OPTIONS = PRECEDES_KINDS.map((k) => ({ value: k, label: PRECEDES_LABELS[k] }))
</script>

<style scoped>
/* Voile clair posé sur la trame de fond : la ligne se détache du papier sans
   devenir une carte (pas de bordure ni de radius — elle est calée sur les filets
   de la trame, cf. `geo` de MaquetteStyleCallouts). */
.fc-row.fc-srow {
  background: color-mix(in srgb, var(--c-accent-alt-ink) 24%, transparent);
}

/* La ligne empile nom puis contrôles (héritage `.fc-row` de callouts.css). */
.fc-srow__name {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
}

.fc-srow__style {
  max-width: 11em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fc-srow__controls {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

/* Case « exigé » (chapitrage), aux couleurs Scribe. */
.fc-srow__require {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  color: var(--c-ink2);
  cursor: pointer;
  white-space: nowrap;
}
.fc-srow__require input[type="checkbox"] {
  accent-color: var(--c-accent-alt);
}

/* Crayon d'édition d'apparence : discret, teal au survol / si surchargé. */
.fc-srow__edit {
  position: relative;
  border: none;
  background: transparent;
  color: var(--c-ink2);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  pointer-events: auto;
}
.fc-srow__edit:hover {
  color: var(--c-accent-alt-darker);
  background: color-mix(in srgb, var(--c-ink) 8%, transparent);
}
.fc-srow__edit--mod {
  color: var(--c-accent-alt);
}
.fc-srow__dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-accent-alt);
}
</style>
