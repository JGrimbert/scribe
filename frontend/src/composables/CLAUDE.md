# Composables

Logique Vue à état (refs, computed, composition d'autres composables) qui ne
mérite pas d'être un composant. Introduits pour sortir `PageComposer.vue` de
~460 lignes de script à ~115 : toute la mécanique d'édition/fusion vit ici,
`PageComposer.vue` ne fait plus qu'orchestrer.

## Composables existants

- **`useFakeCaret.js`** — faux curseur clignotant / rectangles de sélection.
  Le DOM paginé (`v-html`, régénéré par Paged.js à chaque `refresh()`) n'est
  pas éditable ; ce composable pilote l'overlay visuel superposé dessus.
- **`useFloatingToolbar.js`** — positionne la toolbar Quill (teleportée dans
  `<body>` par `QuillBlock`) au-dessus de la sélection courante.
- **`useFragmentEditor.js`** — le plus gros : cycle de vie complet de
  l'édition par fragment (activer/fermer/commit/merge). Dépend de
  `useFakeCaret`/`useFloatingToolbar` via injection (pas d'import direct),
  voir "Découplage" ci-dessous.

## Règles

- **Pas de duplication entre variantes symétriques.** Si deux fonctions ne
  diffèrent que par un paramètre (cf. `mergeNext`/`mergePrev`), factoriser en
  une fonction interne + param plutôt que copier-coller. Exemple dans
  `useFragmentEditor.js` : `mergeFragment(direction)` où `direction` vaut
  `'mergeNext'` ou `'mergePrev'`, appelé par deux wrappers d'une ligne.
- **Découplage par injection, pas par import croisé.** `useFragmentEditor`
  reçoit `caret`/`toolbar` (les objets retournés par `useFakeCaret`/
  `useFloatingToolbar`) en paramètre plutôt que de les importer et les
  instancier lui-même. Le composant consommateur (`PageComposer.vue`)
  instancie les trois et fait le câblage. Ça garde chaque composable testable
  indépendamment et évite les dépendances circulaires implicites.
- **Ne pas envelopper le retour dans `reactive()`.** Retourner un objet plat
  contenant des `ref`/fonctions. Le composant appelant doit déstructurer au
  niveau racine de son `<script setup>` (`const { cursorRect, ... } =
  useFakeCaret(...)`) pour que Vue déballe automatiquement les refs dans le
  template — une déstructuration nichée (`caret.cursorRect` accédé depuis le
  template) ne bénéficie pas de cet auto-unwrap.
- **`findFragEl` est injecté, pas recréé dans chaque composable.** Il dépend
  de `composerRoot` (ref DOM), lui-même propriété du composant racine —
  défini une seule fois dans `PageComposer.vue` et passé en paramètre.

## Piège à ne pas réintroduire

`useFragmentEditor.js` ferme puis rouvre l'éditeur (`closeEditor()` +
`activateFragment()`) après un split (Entrée) ou une fusion
(Backspace/Delete). Si le fragment rouvert a le même id que celui qu'on vient
de fermer (fréquent : fusionner avec le paragraphe suivant garde le même
index), le faire dans le même tick synchrone ne déclenche PAS de remount Vue
réel — `<QuillBlock>` garde son contenu périmé. D'où `settleClose()`
(`await nextTick()`) entre les deux. Ne pas supprimer cet await en pensant
que c'est un no-op inutile — voir la section "Pièges connus" du
`CLAUDE.md` racine pour le détail du mécanisme.
