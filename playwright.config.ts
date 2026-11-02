import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'https://www.saucedemo.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'stable',
      grep: /@stable/,
      retries: 1,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'experimental',
      grep: /@experimental/,
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'quarantine',
      grep: /@quarantine/,
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
