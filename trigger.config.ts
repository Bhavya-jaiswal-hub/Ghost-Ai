import { defineConfig } from "@trigger.dev/sdk";

const projectRef = process.env.TRIGGER_PROJECT_REF ?? "proj_replace_me";

export default defineConfig({
  project: projectRef,
  dirs: ["./trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
    },
  },
});
