import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
