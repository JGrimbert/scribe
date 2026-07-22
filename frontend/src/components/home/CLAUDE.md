# Accueil & registre — `components/home/`

`HomeView.vue` (route `/`) : l'accueil, qui EST l'écran du registre — la liste des
documents (`DocumentList`) + le bouton d'import (`../import/ImportButton.vue`). Le
registre n'a pas d'écran à lui : il vit ici et dans l'aside de la config (cf.
`../layout/CLAUDE.md` pour l'arbitrage registre-vs-structure de l'aside).

- **`../../composables/useRegistry.js` est un état de MODULE, pas d'instance** : la
  liste et le bouton d'import sont montés à deux endroits (accueil, aside de
  config). Deux copies divergeraient au premier import. Même raison pour
  `pendingPreview`, qui vit là plutôt que dans l'URL (l'outline fait des milliers
  d'entrées).
- **`DocumentList` fait son propre fetch** (`onMounted`) : le câbler dans chaque
  parent, c'est l'oublier au troisième. L'état étant de module, deux montages
  partagent la même réponse.
- **Le clic ne décide pas de la destination, le parent si** (comme `select()`) :
  depuis l'accueil on entre par le dashboard (on vient lire), depuis l'aside de
  config on reste sur la config (on compare des configurations).
- **En rail, la liste disparaît** au profit d'une icône qui rouvre l'aside :
  42 px ne rendent pas un titre de manuscrit lisible.
- Une ligne = **deux boutons frères** (titre + méta, puis poubelle à droite) —
  imbriquer la poubelle dans le bouton de sélection serait un bouton dans un
  bouton (HTML invalide, clic qui remonte). Poubelle **absente au repos, révélée
  au survol**, rouge quand on la vise.
- **La suppression est offerte à deux endroits** (la ligne, l'écran de config) :
  `confirmAndDelete` vit dans `useRegistry`, pas dans les vues (deux formulations
  divergeraient). `DocumentList` supprime et **émet `deleted`** ; le parent décide
  de la suite (supprimer le document étudié quitte l'écran, un autre raccourcit la
  liste). Les stats du document restent hors de la liste : dans l'en-tête de config.
