import { defineConfig } from "vite";

// Explicit public build-revision marker; not a signed deployment attestation.
const inputSha = process.env.GITHUB_SHA || "";
const publicBuildSha = /^[a-f0-9]{40}$/.test(inputSha) ? inputSha : "";

export default defineConfig({
  base: "./",
  define: { __PHIMADA_BUILD_SHA__: JSON.stringify(publicBuildSha) },
  build: { outDir: "dist", sourcemap: false }
});
