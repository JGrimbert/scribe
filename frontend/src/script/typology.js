// Vocabulaires fermés, alignés sur STYLE_ROLES/HIGHLIGHT_ROLES du backend
// (documents/typology.ts), qui refuse tout rôle hors liste. Fermés exprès : les
// règles d'éligibilité les visent, et une étiquette libre serait une faute de
// frappe qui casse une règle en silence.
export const STYLE_ROLES = [
  'corps', 'titre', 'chapeau', 'citation', 'définition',
  'renvoi', 'tableau', 'liste', 'ornement', 'liminaire', 'ignorer',
]

export const HIGHLIGHT_ROLES = ['annotation', 'emphase', 'ignorer']

// Sous-ensemble de STYLE_ROLES qu'il est sensé d'exiger d'un nœud. Exiger
// « corps » ou « ignorer » ne voudrait rien dire ; « tableau » a sa propre case
// (le parseur range les tableaux à part, cf. rules.ts côté backend).
export const REQUIRABLE_ROLES = ['définition', 'chapeau', 'citation', 'renvoi']

// Les niveaux réglables, alignés sur DEPTH_KEYS/DEPTH_LABELS du backend. La clé
// 2 vaut « 2 et au-delà » — même regroupement que les zones de l'inventaire et
// que les modèles de structure : un « Article » doit désigner le même objet
// partout dans l'écran.
export const DEPTH_TABS = [
  { key: 'default', label: 'Défaut', hint: "S'applique à tout niveau sans règles propres" },
  { key: 0, label: 'Chapitrage — niveau 1', hint: 'Titres de premier niveau' },
  { key: 1, label: 'Chapitrage — niveau 2', hint: 'Deuxième niveau de titre' },
  { key: 2, label: 'Chapitrage — niveau 3+', hint: 'Troisième niveau et au-delà' },
]

export function emptyRuleSet() {
  return { minChars: null, forbidAnnotations: false, requiresRoles: [], requiresTable: false }
}
