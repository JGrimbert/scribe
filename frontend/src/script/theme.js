// Résout un token base.css en valeur calculée pour echarts (qui peint dans un <canvas>
// où var() n'est jamais résolu). Réservé à ce cas : le DOM utilise var() en CSS.
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback // jsdom/SSR : pas de style calculé
  const value = getComputedStyle(document.documentElement).getPropertyValue(name)
  return value.trim() || fallback
}
