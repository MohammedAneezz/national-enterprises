const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 375, height: 812 },
    channel: 'msedge',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'python ../backend/tests/e2e_server.py', url: 'http://127.0.0.1:8001/api/health', timeout: 30000, reuseExistingServer: false },
    { command: 'npx expo start --web --port 8081 --localhost', url: 'http://localhost:8081', timeout: 180000, reuseExistingServer: true,
      env: { CI: '1', EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8001/api/v1' } },
  ],
});
