# Aside structure — `components/structure/`

`StructureView.vue` : l'aside arborescente montée sur le dashboard et l'éditeur
(la config lui substitue le registre — cf. `../layout/CLAUDE.md`). Arbre récursif
de `trame.axes[]` (profondeur arbitraire, cf. `../../script/trame.js`) :
`StructureNode.vue` en accordéon **replié/déplié** (prop `expanded` binaire : rail
étroit vs arbre repliable, stats en infobulle). L'état `expanded` et le chevron
vivent dans `../layout/DocumentBar.vue`, pas dans la sidebar. Le chemin vers le
nœud courant s'auto-déplie ; compte les descendants récursivement (`stats.mots`
déjà agrégées côté backend). Le clic sur un nœud émet `select` — `DocumentLayout`
décide de l'effet (voir `../layout/CLAUDE.md`).
