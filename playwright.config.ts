import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    geolocation: { latitude: 35.681236, longitude: 139.767125 },
    permissions: ["geolocation"]
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }]
});
