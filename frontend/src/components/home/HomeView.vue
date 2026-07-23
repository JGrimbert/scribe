<template>
  <!-- Accueil à deux colonnes, comme l'écran de config : aside = le registre
       (liste + import), main = présentation de l'app. L'aside ne se replie pas
       ici (pas de doc-bar pour porter le chevron) — toujours déployée. -->
  <div class="home">
    <aside class="home__aside">
      <CustomScrollbar>
        <DocumentList @select="open" />
      </CustomScrollbar>
      <!-- HORS de la zone de défilement : l'import reste sous la main quelle que
           soit la longueur du registre. -->
      <div class="home__aside-foot">
        <ImportButton label="Importer un document" />
      </div>
    </aside>

    <main class="home__main">
      <CustomScrollbar>
        <div class="home__inner">
          <!-- Module utilisateur (en premier) : placeholder tant que les comptes
               n'existent pas. Point d'ancrage de la future authentification. -->
          <section class="home-user">
            <div class="home-user__avatar"><i class="pi pi-user" aria-hidden="true"></i></div>
            <div class="home-user__body">
              <h3 class="home-user__name">Invité</h3>
              <p class="home-muted">
                Les comptes utilisateur arrivent bientôt — vous retrouverez alors vos manuscrits et
                vos analyses d'un appareil à l'autre.
              </p>
            </div>
          </section>

          <!-- Présentation succincte des trois espaces d'un document. Volontairement
               esquissée : le détail viendra. -->
          <section class="home-intro">
            <h2 class="home-intro__title">Scribe</h2>
            <p class="home-muted home-intro__lede">
              De l'import d'un manuscrit <code>.odt</code> à son édition paginée, en passant par son
              analyse. Choisissez un document dans le registre, ou importez-en un nouveau.
            </p>

            <div class="home-spaces">
              <article class="home-space">
                <i class="pi pi-sliders-h home-space__icon" aria-hidden="true"></i>
                <h4 class="home-space__title">Configuration</h4>
                <p class="home-muted">Calibrer les bornes du livre et arbitrer le rôle de chaque style.</p>
              </article>
              <article class="home-space">
                <i class="pi pi-chart-bar home-space__icon" aria-hidden="true"></i>
                <h4 class="home-space__title">Analyse</h4>
                <p class="home-muted">Structure, lexique, sémantique et thèmes du manuscrit.</p>
              </article>
              <article class="home-space">
                <i class="pi pi-file-edit home-space__icon" aria-hidden="true"></i>
                <h4 class="home-space__title">Édition</h4>
                <p class="home-muted">Retoucher le texte dans un rendu paginé, fidèle à l'impression.</p>
              </article>
            </div>
          </section>
        </div>
      </CustomScrollbar>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import DocumentList from './DocumentList.vue'
import ImportButton from '../import/ImportButton.vue'
import CustomScrollbar from '../ui/atoms/CustomScrollbar.vue'

const router = useRouter()

// Depuis l'accueil on entre dans le document par son écran de travail (le
// dashboard), pas par sa configuration : on vient lire ce qu'il raconte. C'est
// l'aside de la config qui, elle, fait changer de document à écran constant.
function open(id) {
  router.push(`/documents/${id}`)
}
</script>

<style scoped>
.home {
  /* Remplit la hauteur restante sous la topbar (item flex de `.app`). */
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

/* Aside registre : même famille que celle de la config (fond, largeur, filet). */
.home__aside {
  width: 250px;
  flex: 0 0 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--c-aside-bck);
  border-right: 1px solid var(--c-border);
}

.home__aside-foot {
  flex: 0 0 auto;
  padding: var(--sp-3);
  display: flex;
  justify-content: center;
}

.home__main {
  flex: 1 1 auto;
  min-height: 0;
}

.home__inner {
  max-width: 52em;
  margin: 0 auto;
  padding: var(--sp-6) var(--sp-4);
}

/* ── Module utilisateur ── */
.home-user {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-4);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}

.home-user__avatar {
  flex: 0 0 auto;
  width: 3em;
  height: 3em;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--c-accent-alt);
  color: var(--c-accent-alt-ink);
  font-size: var(--fs-lg);
}

.home-user__name {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-md);
}

.home-muted {
  margin: 0;
  color: var(--c-ink2);
  font-size: var(--fs-sm);
  line-height: 1.4;
}

/* ── Présentation ── */
.home-intro {
  margin-top: var(--sp-6);
}

.home-intro__title {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lg);
  color: var(--c-accent-alt-darker);
}

.home-intro__lede {
  max-width: 52ch;
  margin-bottom: var(--sp-5);
  font-size: var(--fs-md);
}

.home-spaces {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13em, 1fr));
  gap: var(--sp-4);
}

.home-space {
  padding: var(--sp-4);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
}

.home-space__icon {
  font-size: var(--fs-lg);
  color: var(--c-accent-alt-darker);
}

.home-space__title {
  margin: var(--sp-2) 0 var(--sp-1);
  font-size: var(--fs-md);
}

/* Le contenu défile dans la CustomScrollbar ; on reprend le protocole éprouvé de
   `DocumentLayout` (aside qui flexe, main à 100 %). */
.home__main > .custom-scrollbar {
  height: 100%;
}

.home__aside > .custom-scrollbar {
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
