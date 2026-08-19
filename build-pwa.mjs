import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = "dist/pwa";
const buildId = Date.now().toString(36);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all([
  build({
    entryPoints: ["src/pwa.ts"],
    outfile: `${outputDirectory}/pwa.js`,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    define: { __MARKLEFT_PWA_BUILD__: JSON.stringify(buildId) },
  }),
  build({
    entryPoints: ["src/pwa-service-worker.js"],
    outfile: `${outputDirectory}/pwa-service-worker.js`,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    define: { __MARKLEFT_PWA_BUILD__: JSON.stringify(buildId) },
  }),
]);

await cp("pwa", outputDirectory, { recursive: true });
console.log(`PWA written to ${outputDirectory}`);
