#!/usr/bin/env node

const path = require("path");

require.extensions[".ts"] = require.extensions[".js"];

const commands = {
  "validate-sources": "validate-sources.ts",
  "validate-cards": "validate-cards.ts",
  "generate-card-md": "generate-card-md.ts",
  "review-card": "review-card.ts",
  "search-cards": "search-cards.ts",
  "kb-workflow": "kb-workflow.ts",
  "extract-sources": "extract-sources.ts",
  "batch-generate": "batch-generate.ts",
  "quality-scan": "quality-scan.ts"
};

const command = process.argv[2];

if (!command || !commands[command]) {
  console.error("Usage: node scripts/run.js <command> [...args]");
  console.error(`Commands: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

process.argv = [process.argv[0], path.join(__dirname, commands[command]), ...process.argv.slice(3)];
require(process.argv[1]);
