<template>
  <!-- Les nœuds du niveau rangés par ÉCART AU MODÈLE (cf. script/chapitrageGroupes),
       posés sous la planche dézoomée. Un livre ne se relit pas nœud par nœud : ce
       qu'on cherche ici, ce sont les quelques FAMILLES de cas — « 447 chapitres sans
       Definition », « 228 qui n'ont que leur titre ». -->
  <div class="maq-groupes">
    <!-- Colonne gauche : les FAMILLES de cas (suggestions de fusion en tête, puis
         la liste par écart au modèle). -->
    <div class="maq-groupes__families">
      <!-- Deux styles qui occupent le même rang sans jamais se croiser : c'est le
           même rôle sous deux noms (cf. script/chapitrageFusion). Le dire ici, en
           tête des familles, parce que c'est UNE décision qui en fait tomber des
           centaines. -->
      <p v-if="suggestion" class="maq-fusion">
        <span>
          <b>{{ suggestion.drop }}</b> tient le rang de <b>{{ suggestion.keep }}</b>
          dans {{ suggestion.droppedCount }} chapitres et ne s'y mêle jamais.
          Les fondre en rendrait <b>{{ suggestion.gain }}</b> conformes.
        </span>
        <BaseButton variant="accent" :busy="merging" @click="$emit('merge', suggestion)">
          Fusionner
        </BaseButton>
      </p>

      <!-- L'autre visage du doublon : deux styles de CORPS qui font le même travail
           sous deux noms (cf. script/chapitrageFusion, corpsMergeCandidates). Ici le
           gain ne se dit pas en conformité mais en familles du graph qui se replient. -->
      <p v-if="corpsSuggestion" class="maq-fusion">
        <span>
          <b>{{ corpsSuggestion.drop }}</b> et <b>{{ corpsSuggestion.keep }}</b> portent
          tous deux le rôle corps ({{ corpsSuggestion.droppedCount }} chapitres).
          Les fondre replierait <b>{{ corpsSuggestion.collapsed }}</b> familles.
        </span>
        <BaseButton variant="accent" :busy="merging" @click="$emit('merge', corpsSuggestion)">
          Fusionner
        </BaseButton>
      </p>

      <CustomScrollbar>
        <ul class="maq-groupes__list" @mouseleave="$emit('hover-group', null)">
          <!-- Survol = la planche du dessus montre un nœud DE CE GROUPE : la famille
               ne se juge pas sur une liste de styles, elle se juge sur une page. -->
          <li
              v-for="g in groups"
              :key="g.key"
              class="maq-groupe"
              :class="{ 'maq-groupe--on': hovered === g.key }"
              :title="sample(g)"
              @mouseenter="$emit('hover-group', g)"
          >
            <span class="maq-groupe__count">{{ g.count }}</span>
            <span class="maq-groupe__ecart">
              <template v-if="!g.missing.length && !g.extra.length">
                <span class="maq-groupe__conforme">conforme au modèle</span>
              </template>
              <template v-else>
                <span v-if="g.missing.length" class="maq-groupe__missing">sans {{ g.missing.join(', ') }}</span>
                <span v-if="g.extra.length" class="maq-groupe__extra">+ {{ g.extra.join(', ') }}</span>
              </template>
            </span>
            <span class="maq-groupe__styles">{{ g.styles.join(' · ') || '—' }}</span>
          </li>
        </ul>
      </CustomScrollbar>
    </div>

    <!-- Aside PROPRE au volet : les styles HORS MODÈLE du niveau, en regard des
         familles (déplacés depuis l'aside principale). La MÊME table enrichie —
         poids (compte coloré + part du problème) et fusion par ligne. -->
    <aside v-if="styleRows.length" class="maq-groupes__horsmodele">
      <h4 class="maq-groupes__title">
        Hors modèle <span class="maq-groupes__count">{{ styleRows.length }}</span>
      </h4>
      <CustomScrollbar>
        <StyleRolesTable
            :styles="styleRows"
            :style-roles="styleRoles"
            show-fusion
            full-width
            :merging="merging"
            :depth-key="depthKey"
            :zone-key="zoneKey"
            :rule-set="ruleSet"
            @hover-style="$emit('hover-style', $event)"
            @merge="$emit('merge', $event)"
        />
      </CustomScrollbar>
    </aside>
  </div>
</template>

<script setup>
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import BaseButton from '../ui/atoms/BaseButton.vue'
import StyleRolesTable from '../config/StyleRolesTable.vue'

defineProps({
  // `[{ key, styles, missing, extra, count, nodes }]`, cf. groupByDeviation.
  groups: { type: Array, default: () => [] },
  // Clé du groupe dont la planche est montée (le survol peut avoir de l'avance sur
  // elle : la pagination est débouncée côté vue).
  hovered: { type: String, default: null },
  // La meilleure paire de styles à fondre, cf. mergeCandidates. null = rien à
  // proposer (le cas normal d'un document propre).
  suggestion: { type: Object, default: null },
  // La meilleure paire de styles de CORPS à fondre, cf. corpsMergeCandidates.
  // Nature différente (rôle partagé, gain en familles repliées) → sa propre ligne.
  corpsSuggestion: { type: Object, default: null },
  merging: { type: Boolean, default: false },
  // Styles HORS MODÈLE enrichis (cf. deviationStyleRows) : `[{ name, count,
  // problemShare, keep, gain }]`, rendus dans l'aside du volet.
  styleRows: { type: Array, default: () => [] },
  // Map réactive rôle-par-style (mutée en place par StyleRolesTable).
  styleRoles: { type: Object, default: () => ({}) },
  // Niveau/zone/règles du chapitrage focusé, pour la table hors modèle.
  depthKey: { type: Number, default: 0 },
  zoneKey: { type: String, default: null },
  ruleSet: { type: Object, default: null },
})

defineEmits(['hover-group', 'merge', 'hover-style'])

// Les premiers titres du groupe, en infobulle : de quoi reconnaître la famille
// sans qu'une colonne de plus s'installe dans la ligne.
const SAMPLE = 5
function sample(g) {
  const titres = g.nodes.slice(0, SAMPLE).map((n) => n.titre || '(sans titre)')
  return g.count > SAMPLE ? `${titres.join(' · ')} … (+${g.count - SAMPLE})` : titres.join(' · ')
}
</script>

<style scoped>
/* Volet ferré en bas de fenêtre : les familles à gauche, l'aside hors modèle à
   droite. Il remplit exactement la bande que lui donne .maq-groupes-zone. */
.maq-groupes {
  display: flex;
  flex-direction: row;
  gap: var(--sp-4);
  height: 100%;
  min-height: 0;
  font-size: var(--fs-sm);
  color: var(--c-ink2);
}

/* Colonne des familles : les suggestions ne défilent pas (c'est l'action de
   l'écran, elle reste sous les yeux), seule la liste défile sous elles. */
.maq-groupes__families {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.maq-groupes__families :deep(.custom-scrollbar) {
  flex: 1 1 auto;
  min-height: 0;
}

/* Aside propre du volet : carte flottante (mêmes traits que .maq-analyse-aside),
   table hors modèle défilante sous son titre. */
.maq-groupes__horsmodele {
  flex: 0 0 auto;
  width: 22em;
  max-width: 40%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-card-float);
  backdrop-filter: var(--c-backdrop-filter-blur);
}

.maq-groupes__horsmodele :deep(.custom-scrollbar) {
  flex: 1 1 auto;
  min-height: 0;
}

.maq-groupes__title {
  flex: 0 0 auto;
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink2);
}

.maq-groupes__count {
  opacity: var(--op-faint);
  font-weight: 400;
}

/* Proposition de fusion : une phrase et un bouton, pas une carte — c'est un
   constat de l'écran, pas un panneau de plus. */
.maq-fusion {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin: 0 0 var(--sp-2);
  padding: var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c-accent-alt) 6%, transparent);
}

.maq-groupes__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Trois colonnes : l'effectif (c'est ce qu'on lit en premier), l'écart en clair,
   et les styles effectifs du groupe repoussés à droite. */
.maq-groupe {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  padding: var(--sp-1) var(--sp-2);
  border-top: 1px solid var(--c-border);
  cursor: default;
}

/* Groupe dont la planche est montée au-dessus : le lien entre la ligne et la page
   doit se voir, sinon on ne sait pas ce qu'on regarde. */
.maq-groupe--on {
  background: color-mix(in srgb, var(--c-accent-alt) 10%, transparent);
}

.maq-groupe__count {
  flex: 0 0 4em;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.maq-groupe__ecart {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  gap: var(--sp-3);
}

.maq-groupe__conforme {
  color: var(--c-accent-alt);
}

.maq-groupe__missing {
  color: var(--c-muted);
}

.maq-groupe__extra {
  color: var(--c-ink2);
}

/* Les styles portés : c'est le rappel, pas l'information — il tient sur une ligne
   et se coupe plutôt que de pousser l'écart hors du champ. */
.maq-groupe__styles {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
