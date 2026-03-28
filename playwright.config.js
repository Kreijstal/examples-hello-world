import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  webServer: {
    command: "deno run --allow-net --allow-read jsr:@std/http/file-server dist/ --port 8787",
    port: 8787,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:8787",
  },
});
