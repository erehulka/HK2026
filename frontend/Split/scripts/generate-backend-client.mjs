#!/usr/bin/env node
/**
 * Generates a TypeScript Axios client from the FastAPI OpenAPI document.
 * Same stack as https://github.com/bratislava/konto.bratislava.sk/tree/master/openapi-clients
 * (openapi-generator-cli + typescript-axios).
 *
 * Requires a JDK (OpenAPI Generator runs on the JVM).
 *
 * Usage:
 *   npm run generate:api:local     # http://localhost:8000/openapi.json (backend must be running)
 *   npm run generate:api         # uses OPENAPI_SPEC_URL or --spec-url
 *
 * Options (CLI overrides env):
 *   --local-url <host:port>   default localhost:8000
 *   --spec-url <url|path>     http(s) URL, file:// URL, or project-relative path to openapi.json
 *
 * Offline example (export spec from backend first):
 *   OPENAPI_SPEC_URL=./openapi.json npm run generate:api
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "api", "generated");

function parseCli() {
  const { values } = parseArgs({
    options: {
      "local-url": { type: "string", default: "localhost:8000" },
      "spec-url": { type: "string" },
    },
    allowPositionals: false,
  });
  return values;
}

function resolveInputUrl(values) {
  const fromEnv = process.env.OPENAPI_SPEC_URL?.trim();
  const specUrl = values["spec-url"]?.trim() || fromEnv;
  if (specUrl) {
    if (/^https?:\/\//i.test(specUrl) || /^file:/i.test(specUrl)) {
      return specUrl;
    }
    return path.resolve(projectRoot, specUrl);
  }
  const host = values["local-url"]?.trim() || "localhost:8000";
  const normalized = host.startsWith("http://") || host.startsWith("https://")
    ? host
    : `http://${host}`;
  const base = normalized.replace(/\/$/, "");
  return `${base}/openapi.json`;
}

function main() {
  const values = parseCli();
  const inputUrl = resolveInputUrl(values);

  console.log(`OpenAPI input: ${inputUrl}`);
  console.log(`Output: ${path.relative(projectRoot, outputDir)}`);

  fs.mkdirSync(outputDir, { recursive: true });

  const cmd = [
    "npx",
    "@openapitools/openapi-generator-cli",
    "generate",
    "-i",
    inputUrl,
    "-g",
    "typescript-axios",
    "-o",
    outputDir,
    "--skip-validate-spec",
    "--additional-properties",
    [
      "supportsES6=true",
      "withInterfaces=true",
      "enumPropertyNaming=original",
      "modelPropertyNaming=original",
    ].join(","),
  ];

  execSync(cmd.join(" "), {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  console.log("Done. Import APIs from @/api/generated (see generated index.ts).");
}

main();
