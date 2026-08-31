<template>
  <!-- Accueil = écran de registre à part entière (plus d'aside verte, qui jurait
       avec la maquette). Barre de tête reprenant le chrome de la doc-bar (fil
       d'Ariane) pour que l'accueil ne soit plus le seul écran sans 2e barre, puis
       une zone de travail crème pleine largeur : la liste détaillée des
       manuscrits. -->
  <div class="home">
    <div class="home__bar">
      <nav class="home__crumb" aria-label="Fil d'Ariane">
        <span class="home__crumb-item">Scribe</span>
        <i class="pi pi-angle-right home__crumb-sep" aria-hidden="true"></i>
        <span class="home__crumb-item home__crumb-item--current">Accueil</span>
      </nav>

      <!-- Ancrage des futurs comptes : simple témoin tant que l'authentification
           n'existe pas (cf. placeholders « dernier accès / accès » du tableau). -->
      <span class="home__who"><i class="pi pi-user" aria-hidden="true"></i> Invité</span>
    </div>

    <CustomScrollbar>
      <div class="home__work">
        <header class="home__head">
          <h2 class="home__title">Vos manuscrits</h2>
          <span class="home__count">{{ documents.length }} document{{ documents.length > 1 ? 's' : '' }}</span>
          <ImportButton class="home__cta" label="Importer un document" />
        </header>

        <UiNote v-if="error" variant="error">{{ error }}</UiNote>

        <!-- Table large (stats + colonnes de comptes à venir) : elle scrolle
             horizontalement DANS sa boîte plutôt que de pousser la page — cas de
             « dernier recours » admis par le DS pour une table qui ne se tronque
             pas. Sur desktop (cible), tout tient sans barre. -->
        <div v-if="documents.length" class="home__table-wrap">
          <table class="home__table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Importé le</th>
                <th>Poids</th>
                <th>Axes</th>
                <th>Blocs</th>
                <th>Articles</th>
                <th>Mots</th>
                <th class="home__col-fut" title="Disponible avec les comptes utilisateur">Dernier accès</th>
                <th class="home__col-fut" title="Nombre d'utilisateurs autorisés — disponible avec les comptes">Accès</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                  v-for="doc in documents"
                  :key="doc.id"
                  class="home__row"
                  @click="open(doc.id)"
              >
                <td class="home__title-cell">
                  <span class="home__doc-title">{{ doc.title }}</span>
                  <span class="home__doc-file">{{ doc.sourceFilename }}</span>
                </td>
                <td>{{ formatDay(doc.importedAt) }}</td>
                <td>{{ doc.hasSource ? formatBytes(doc.sourceSizeBytes) : '—' }}</td>
                <td>{{ formatInt(doc.totalAxes) }}</td>
                <td>{{ formatInt(doc.totalBlocs) }}</td>
                <td>{{ formatInt(doc.totalArticles) }}</td>
                <td>{{ formatInt(doc.totalMots) }}</td>
                <td class="home__col-fut">—</td>
                <td class="home__col-fut">—</td>
                <td class="home__actions" @click.stop>
                  <button
                      class="home__delete"
                      type="button"
                      :title="`Supprimer « ${doc.title} »`"
                      :disabled="deletingId === doc.id"
                      @click="onDelete(doc)"
                  >
                    <i class="pi" :class="deletingId === doc.id ? 'pi-spin pi-spinner' : 'pi-trash'"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <UiNote v-else-if="loading" variant="hint">Chargement du registre…</UiNote>
        <UiNote v-else variant="hint">Aucun document importé pour l'instant.</UiNote>
      </div>
    </CustomScrollbar>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ImportButton from '../import/ImportButton.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'
import UiNote from '../ui/molecules/UiNote.vue'
import { useRegistry } from '../../composables/useRegistry'
import { formatBytes, formatDay, formatInt } from '../../script/format'

const router = useRouter()
const { documents, loading, error, deletingId, ensureLoaded, confirmAndDelete } = useRegistry()

// Depuis l'accueil on entre dans le document par son écran de travail (la
// maquette), pas par sa configuration : on vient lire ce qu'il raconte.
function open(id) {
  router.push(`/documents/${id}`)
}

// La suppression rafraîchit la liste (useRegistry) ; l'accueil n'ayant pas de
// document ouvert, rien d'autre à faire (contrairement à un écran de document).
async function onDelete(doc) {
  await confirmAndDelete(doc)
}

onMounted(ensureLoaded)
</script>

<style scoped>
.home {
  /* Remplit la hauteur restante sous la topbar (item flex de `.app`). */
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Barre de tête : mêmes hauteur, fond, filet, encre et retrait que la doc-bar
      d'un document (`../layout/DocumentBar.vue`), pour que le passage accueil ⇄
      document ne change pas de chrome. ── */
.home__bar {
  flex: 0 0 auto;
  height: var(--bar-size-2);
  display: flex;
  align-items: center;
  padding-left: 2em;
  padding-right: var(--sp-3);
  background: var(--c-ui-light);
  border-bottom: var(--c-doc-bar-border);
}

.home__crumb {
  display: flex;
  align-items: center;
  gap: 0.15em;
}

/* Crumb : encre, retrait ET graisses de la doc-bar — racine `crumb--root` en
   500, feuille `crumb--current` en 600 (`--c-bar-accent`), séparateur menu. */
.home__crumb-item {
  padding: 0.15em 0.35em;
  color: var(--c-accent-alt-mid);
  font-size: var(--fs-sm);
  font-weight: 500;
  opacity: var(--op-soft);
}

/* `--c-bar-accent` n'existe que sur les barres (`.menu`…), pas ici : on prend
   directement le teal foncé, sa valeur en thème par défaut. */
.home__crumb-item--current {
  color: var(--c-accent-alt-mid);
  font-weight: 600;
  opacity: 1;
}

.home__crumb-sep {
  color: var(--c-accent-alt-mid);
  font-size: 0.7em;
  opacity: var(--op-faint);
}

.home__who {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  color: var(--c-accent-alt-mid);
  font-size: var(--fs-sm);
  opacity: var(--op-soft);
}

/* ── Zone de travail : fond crème (comme la zone d'un document ouvert), avec des
      marges latérales généreuses — de l'ordre de la largeur de l'aside disparue
      (~250 px) — pour aérer le registre. Adaptatives : réduites sur écran étroit. ── */
.home__work {
  min-height: 100%;
  padding: var(--sp-6) clamp(var(--sp-6), 20vw, 17rem);
  background: var(--c-paper-cream);
}

.home__head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.home__title {
  margin: 0;
  font-size: var(--fs-lg);
  color: var(--c-accent-alt-darker);
}

.home__count {
  color: var(--c-ink2);
  font-size: var(--fs-sm);
}

.home__cta {
  margin-left: auto;
}

/* ── Tableau du registre (calqué sur la maquette V1 : cadre papier sobre, en-tête
      gris clair, pas de header teinté ni de double cadre) ── */
.home__table-wrap {
  overflow-x: auto;
}

.home__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--c-paper);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-size: var(--fs-sm);
}

.home__table th,
.home__table td {
  padding: var(--sp-2) var(--sp-3);
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* Première colonne (titre) alignée à gauche, comme son en-tête. */
.home__table th:first-child,
.home__table td:first-child {
  text-align: left;
  font-variant-numeric: normal;
}

.home__table thead th {
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--c-muted);
  background: var(--c-surface2);
  border-bottom: 1px solid var(--c-border);
}

.home__table tbody td {
  border-bottom: 1px solid var(--c-border);
  color: var(--c-ink);
}

.home__table tbody tr:last-child td {
  border-bottom: 0;
}

.home__row {
  cursor: pointer;
}

.home__row:hover td {
  background: var(--c-table-row-hover);
}

/* Titre + nom de fichier empilés dans la première colonne ; le titre se coupe
   plutôt que d'élargir la table. */
.home__title-cell {
  max-width: 22em;
}

.home__doc-title {
  display: block;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home__doc-file {
  display: block;
  font-size: var(--fs-xs);
  color: var(--c-ink2);
}

/* Colonnes réservées aux comptes (dernier accès, nb d'accès) : présentes mais
   grisées tant que l'authentification n'existe pas. */
.home__col-fut {
  color: var(--c-muted);
  font-style: italic;
}

.home__actions {
  width: 1px; /* colonne au plus juste */
}

.home__delete {
  display: inline-flex;
  align-items: center;
  padding: var(--sp-1);
  border: 0;
  background: none;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s ease, color 0.1s ease;
}

.home__row:hover .home__delete,
.home__delete:focus-visible {
  opacity: var(--op-faint);
}

.home__delete:hover:not(:disabled),
.home__delete:focus-visible {
  opacity: 1;
  color: var(--c-danger);
}

.home__delete:disabled {
  cursor: wait;
  opacity: var(--op-faint);
}

/* Le contenu défile dans la CustomScrollbar (protocole flex éprouvé de
   `DocumentLayout` : aside/barre qui flexent, corps à 100 %). */
.home > .custom-scrollbar {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
}

:deep(.custom-scrollbar) {
  height: 100%;
}

:deep(.custom-scrollbar__content) {
  height: 100%;
}
</style>
