// Une section du dashboard (cf. script/analyseSections.js) → sa card. Séparé du
// vocabulaire, qui reste pur (pas d'import de composant) : la Maquette monte les
// MÊMES cards dans sa scène de recherche, une section n'a donc qu'un seul rendu,
// où qu'on la regarde.
import VocabulaireCard from './lexical/VocabulaireCard.vue'
import LexicalCard from './lexical/LexicalCard.vue'
import LexicalUnitsCard from './lexical/LexicalUnitsCard.vue'
import ThemesCard from './themes/ThemesCard.vue'
import ThemesFlowCard from './themes/ThemesFlowCard.vue'
import EntitiesLeftoverCard from './themes/EntitiesLeftoverCard.vue'
import AnomaliesCard from './structure/AnomaliesCard.vue'
import SemanticCard from './semantic/SemanticCard.vue'

export const ANALYSE_CARDS = {
  vocabulaire: VocabulaireCard,
  lexical: LexicalCard,
  themes: ThemesCard,
  flux: ThemesFlowCard,
  anomalies: AnomaliesCard,
  semantique: SemanticCard,
  unites: LexicalUnitsCard,
  entites: EntitiesLeftoverCard,
}
