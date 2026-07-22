# Dashboard d'analyse — `components/analyse/`

Le tableau de bord de `/documents/:id` : `AnalyseView.vue` (la **page**) monte une
grille de cards, rangées par famille (chacune son doc, chargé à la demande) :
- **`structure/`** — cards sans NLP (complétude, conformité, anomalies, nœuds).
- **`lexical/`** — champ lexical (réseau, nuage, unités, occurrences).
- **`semantic/`** — proximité sémantique (paires, inspecteur de nœud).
- **`themes/`** — thèmes BERTopic (liste, détail, carte UMAP).

Backend : `../../../../backend/CLAUDE.md` (module `analyse` + volets
completeness/conformity/lexical/semantic/topics). Vocabulaires/helpers purs :
`../../script/` (`semanticPairs`, `cloudLayout`, `graphMetrics`, `theme`…). Graphes :
`../ui/organisms/BaseChart`.

## État & cadre communs

- **`../../composables/useAnalyse.js`** — store partagé : `provideAnalyse()` dans
  `AnalyseView`, `useAnalyse()` dans les cards. `DocumentLayout` le fournit aussi
  hors dashboard (config), d'où `AnalyseBlock` utilisable comme cadre autonome.
- **`AnalyseBlock.vue`** (racine `analyse/`, importé par toutes les familles via
  `../AnalyseBlock.vue` et, hors dashboard, par `../liminaire/LiminaireComposer`) —
  cadre commun d'un bloc : révélation, spinner, états vide/erreur, colonnes 2/3 ·
  1/3 (`aside="right"`). Le primitif `.split` (`analyse.css`) est importé
  **globalement par `main.js`**. Prop `bare` → `.split--bare` : inverse
  fond/bordure pour un usage en card autonome (cf. `../config/CLAUDE.md`).
- **`DASHBOARD_STEPS`** — une étape peut avoir **`needs: null`** : dérivée du seul
  contenu du document (complétude), donc jamais « indisponible » ni en attente du
  NLP. `stepStatus` la traite à part (sans la garde, `running === step.needs`
  serait vrai dès que rien ne tourne).

L'ancien écran « Chapitrage » (`DocumentIndex.vue`) est supprimé — ses stats vivent
dans l'infobulle des nœuds de l'aside `StructureView` (cf. `../structure/CLAUDE.md`).

## Graphiques — echarts

`BaseChart.vue` (dans `../ui/organisms/`) est le seul point d'entrée d'ECharts —
voir `../ui/organisms/CLAUDE.md` pour l'instance/dispose/ResizeObserver et l'import
modulaire. Ici vivent les décisions de **domaine** sur la couleur (les cards
construisent l'option, pas le graphe) :

- **Couleurs via tokens résolus** (`../../script/theme.js`, `cssVar`) : echarts
  peint dans un `<canvas>` où `var(--…)` n'est jamais résolu — il faut la valeur
  calculée. Seul usage légitime de `getComputedStyle` pour de la couleur ; le DOM
  garde `var()` en CSS.
- **`--c-ramp-1..4` (rampe ordinale) vs `--c-cat-1..8` (catégorielle)** : une
  échelle dont l'ordre porte le sens (complétude : vide → ébauche → partiel →
  rédigé) prend la rampe d'une seule teinte, clair → foncé. `--c-cat-*` encode une
  identité (communautés du réseau lexical), ordre arbitraire. Colorier une échelle
  ordonnée en catégoriel détruit l'information d'ordre. Les valeurs `--c-ramp-*`
  sont **calculées et validées** (cf. `base.css`), pas choisies à l'œil — revalider
  avant retouche.
- **`--c-status-valide` / `--c-status-perime` sortent de la rampe, exprès** :
  « validé »/« périmé » sont des décisions humaines, pas des paliers de rédaction.
  Une teinte de rampe les ferait lire comme « un peu plus rédigé ». Mêmes tokens
  dans le graphe et sur le bouton de `DocumentBar` : un chapitre vert dans la barre
  est vert dans le graphe.
- **Piège de vérification** : dans un navigateur headless sans `requestAnimationFrame`
  (le pane de vérif est un onglet caché), les barres d'un graphe echarts restent
  figées à `width: 0` (premier frame de l'animation d'entrée) — le graphe **paraît**
  vide alors que la liste d'affichage zrender est correcte. Sonder
  `chart.getZr().storage.getDisplayList()`, pas les pixels du canvas.
