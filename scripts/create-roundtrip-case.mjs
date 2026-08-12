#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const casesDir = join(root, "test", "fixtures", "roundtrip-cases");
const args = parseArgs(process.argv.slice(2));

if (!args.markdown || !args.name) {
  console.error("Usage: node scripts/create-roundtrip-case.mjs --name case-name --markdown path.md [--description text]");
  process.exit(1);
}

const markdown = readFileSync(args.markdown, "utf8").replace(/\r\n?/g, "\n");
const safeName = args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fixture = {
  name: args.name,
  description: args.description || `Regression case created from ${basename(args.markdown)}.`,
  markdown,
};

mkdirSync(casesDir, { recursive: true });
const target = join(casesDir, `${safeName}.json`);
writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(target);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--name") parsed.name = argv[++index];
    else if (value === "--markdown") parsed.markdown = argv[++index];
    else if (value === "--description") parsed.description = argv[++index];
  }
  return parsed;
}
