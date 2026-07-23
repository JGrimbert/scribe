<template>
  <!-- Module de tête « mise en page » : propriétés globales du livre, indépendantes
       des styles individuels. Regroupe le format de page (lu du .odt) et les
       réglages typographiques généraux (décidés par l'utilisateur). En phase 2, le
       tableau gagnera un select de niveau (Global/Rôle/Fidèle) et un panneau
       coulissant pour les réglages fins. -->
  <PageFormatSection :page="page" />

  <section class="config-section">
    <h3 class="section-title">Styles généraux</h3>
    <p class="section-hint">
      Réglages typographiques appliqués à l'ensemble du livre, par-dessus les styles du
      <code>.odt</code>. Un style qui fixe lui-même la valeur garde la sienne.
    </p>

    <UiTable>
      <tbody>
        <tr>
          <td>
            <span class="prop-name">Césure</span>
          </td>
          <td class="prop-desc">
            Coupe les mots trop longs en fin de ligne (césure automatique) — resserre les
            blancs du texte justifié.
          </td>
          <td class="prop-control">
            <label class="toggle">
              <input type="checkbox" v-model="styleDefaults.hyphenation.global" />
              <span>{{ styleDefaults.hyphenation.global ? 'Activée' : 'Désactivée' }}</span>
            </label>
          </td>
        </tr>
      </tbody>
    </UiTable>
  </section>
</template>

<script setup>
import PageFormatSection from './PageFormatSection.vue'
import UiTable from '../ui/molecules/UiTable.vue'

// `styleDefaults` est muté en place (v-model sur hyphenation.global), comme
// `styleRoles`/`ruleSet` : la map réactive est détenue par le composable de config.
defineProps({
  page: { type: Object, default: null },
  styleDefaults: { type: Object, required: true },
})
</script>

<style scoped>
.config-section {
  margin-top: var(--sp-6);
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-md);
  font-weight: 600;
}

.section-hint {
  margin: 0 0 var(--sp-3);
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.prop-name {
  font-weight: 500;
}

.prop-desc {
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  max-width: 40em;
}

.prop-control {
  width: 1%;
  white-space: nowrap;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  cursor: pointer;
}
</style>
