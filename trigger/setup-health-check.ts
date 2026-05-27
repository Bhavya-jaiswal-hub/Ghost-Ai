import { task } from "@trigger.dev/sdk";

export const setupHealthCheck = task({
  id: "setup-health-check",
  run: async () => {
    return {
      ok: true,
      service: "ghost-ai",
    };
  },
});
