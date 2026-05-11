import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  // CI roda contra prod BR a partir de runners US/EU — latency BR ↔ runner
  // empurra navegação pra 30-60s. Local rodando do BR ~2s/teste.
  timeout: 90_000,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "report", open: "never" }],
    ["json", { outputFile: "results.json" }],
  ],
  use: {
    baseURL: "https://www.ricardoblanco.com.br",
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
