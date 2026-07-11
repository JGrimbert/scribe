import { defineConfig } from 'vitest/config'

// Tests unitaires de logique pure (parser ODT surtout) — environnement node,
// pas de DB ni de contexte Nest. Les *.spec.ts sont colocalisés à côté du
// code testé (convention Nest).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
