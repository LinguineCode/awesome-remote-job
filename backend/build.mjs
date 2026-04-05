import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { mkdirSync } from "fs";

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  external: ["@aws-sdk/*"],
  minify: true,
};

// Build API handler
await esbuild.build({
  ...shared,
  entryPoints: ["src/api/handler.ts"],
  outfile: "dist/api/handler.js",
});

// Build inbound email handler
await esbuild.build({
  ...shared,
  entryPoints: ["src/api/inbound-email.ts"],
  outfile: "dist/api/inbound-email.js",
});

// Build cron handler
await esbuild.build({
  ...shared,
  entryPoints: ["src/cron/daily-pipeline.ts"],
  outfile: "dist/cron/daily-pipeline.js",
});

// Create zip files for Lambda deployment
mkdirSync("dist", { recursive: true });
execSync("cd dist && zip -r api.zip api/", { stdio: "inherit" });
execSync("cd dist && zip -r inbound.zip api/inbound-email.*", { stdio: "inherit" });
execSync("cd dist && zip -r cron.zip cron/", { stdio: "inherit" });

console.log("Build complete: dist/api.zip, dist/inbound.zip, dist/cron.zip");
