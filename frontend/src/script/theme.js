// Lecture des tokens de base.css depuis JS. Nécessaire pour les graphes
// echarts : ils peignent dans un <canvas>, où un `var(--c-ramp-1)` n'est jamais
// résolu — il faut passer la valeur calculée. Réservé à ce cas : tout ce qui
// est rendu en DOM doit continuer à utiliser var() directement en CSS.
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback // jsdom/SSR : pas de style calculé
  const value = getComputedStyle(document.documentElement).getPropertyValue(name)
  return value.trim() || fallback
}

export const cssVars = (names) => names.map((name) => cssVar(name))
