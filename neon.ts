import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: true,
  },
  auth: true,
  functions: {
    hello: { name: "Hello World", source: "./hello.ts" },
    api: {
      name: "Nele property API",
      source: "./functions/api/index.ts",
      env: {
        APP_ALLOWED_ORIGINS: process.env.APP_ALLOWED_ORIGINS ?? "http://localhost:8081,http://127.0.0.1:8081",
      },
    },
  },
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    assets: { access: "private" },
    // Listing photos are shown to everyone browsing, so they read anonymously.
    "listing-photos": { access: "public_read" },
    // Terms, privacy policy and the account-deletion page Google Play links to.
    legal: { access: "public_read" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
