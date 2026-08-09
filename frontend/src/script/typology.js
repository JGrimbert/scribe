// Vocabulaires FERMÉS, alignés sur STYLE_ROLES/HIGHLIGHT_ROLES du backend (qui refuse
// tout rôle hors liste) : une étiquette libre casserait une règle en silence.
export const STYLE_ROLES = [
  'corps', 'titre', 'chapeau', 'citation', 'définition',
  'renvoi', 'tableau', 'liste', 'ornement', 'liminaire', 'ignorer',
]

export const HIGHLIGHT_ROLES = ['annotation', 'emphase', 'ignorer']

// Rôles qu'il est sensé d'exiger d'un nœud (« corps »/« ignorer » n'auraient pas de sens ;
// « tableau » a sa propre case).
export const REQUIRABLE_ROLES = ['définition', 'chapeau', 'citation', 'renvoi']

// Niveaux réglables (DEPTH_KEYS backend). La clé 2 vaut « 2 et au-delà ».
export const DEPTH_TABS = [
  { key: 'default', label: 'Défaut', hint: "S'applique à tout niveau sans règles propres" },
  { key: 0, label: 'Chapitrage — niveau 1', hint: 'Titres de premier niveau' },
  { key: 1, label: 'Chapitrage — niveau 2', hint: 'Deuxième niveau de titre' },
  { key: 2, label: 'Chapitrage — niveau 3+', hint: 'Troisième niveau et au-delà' },
]

export function emptyRuleSet() {
  return { minChars: null, forbidAnnotations: false, requiresRoles: [], requiresTable: false, requiresStyles: [], requiresAdjacency: [] }
}
