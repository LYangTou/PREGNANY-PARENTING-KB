const path = require("path");
const { spawnSync } = require("child_process");
const {
  draftsDir,
  reviewedDir,
  loadCards,
  loadSourceRegistry,
  parseArgs,
  walkJsonFiles
} = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";

function runStep(label, commandName, commandArgs = []) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(process.execPath, [path.join(__dirname, "run.js"), commandName, ...commandArgs], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function showHelp() {
  console.log(`Usage:
  npm run kb -- status
  npm run kb -- prepare
  npm run kb -- extract-sources [--source sourceId] [--domain domain] [--force]
  npm run kb -- batch-generate [--source sourceId] [--domain domain] [--limit n] [--force]
  npm run kb -- quality-scan [--scope drafts|reviewed|all] [--json]
  npm run kb -- review <card-id-or-draft-json-path> [--apply]
  npm run kb -- search --query "keyword" [--domain medical] [--stage newborn]

Flow:
  1. Register sources in sources/source_registry.json.
  2. Optionally extract sources: npm run kb -- extract-sources.
  3. Optionally batch-generate draft templates under cards/drafts/<domain>/.
  4. Run: npm run kb -- prepare.
  5. Human-review draft Markdown and quality scan output.
  6. Dry-run review: npm run kb -- review <card-id>.
  7. Apply review after approval: npm run kb -- review <card-id> --apply.
  8. Search reviewed cards: npm run kb -- search --query "keyword".`);
}

function showStatus() {
  const registry = loadSourceRegistry();
  const sourceCounts = registry.sources.reduce((acc, source) => {
    acc[source.group] = (acc[source.group] || 0) + 1;
    return acc;
  }, {});
  const drafts = loadCards("drafts");
  const reviewed = loadCards("reviewed");

  console.log("Source registry: sources/source_registry.json");
  for (const group of registry.groups) {
    console.log(`sourceGroup ${group.id}: ${sourceCounts[group.id] || 0}`);
  }
  console.log(`draftCards: ${drafts.length}`);
  console.log(`reviewedCards: ${reviewed.length}`);
  console.log(`draftJsonFiles: ${walkJsonFiles(draftsDir).length}`);
  console.log(`reviewedJsonFiles: ${walkJsonFiles(reviewedDir).length}`);

  if (drafts.length > 0) {
    console.log("\nDraft cards:");
    for (const { card } of drafts) {
      console.log(`- ${card.id} | ${card.domain} | ${card.title}`);
    }
  }

  if (reviewed.length > 0) {
    console.log("\nReviewed cards:");
    for (const { card } of reviewed) {
      console.log(`- ${card.id} | ${card.domain} | ${card.title}`);
    }
  }
}

if (command === "help" || args.help) {
  showHelp();
} else if (command === "status") {
  showStatus();
} else if (command === "prepare") {
  runStep("Validate sources", "validate-sources");
  runStep("Validate cards", "validate-cards");
  runStep("Quality scan drafts", "quality-scan", ["--scope", "drafts"]);
  runStep("Generate Markdown", "generate-card-md", ["--all"]);
  console.log("\nOK prepare completed. Review draft Markdown before moving any card to reviewed.");
} else if (command === "extract-sources") {
  runStep("Extract registered sources", "extract-sources", process.argv.slice(3));
} else if (command === "batch-generate") {
  runStep("Batch generate draft cards", "batch-generate", process.argv.slice(3));
} else if (command === "quality-scan") {
  runStep("Quality scan cards", "quality-scan", process.argv.slice(3));
} else if (command === "review") {
  const target = args._[1];
  if (!target) {
    console.error("ERROR review requires <card-id-or-draft-json-path>");
    process.exit(1);
  }
  const reviewArgs = [target];
  if (!args.apply) reviewArgs.push("--dry-run");
  if (args.force) reviewArgs.push("--force");
  runStep(args.apply ? "Apply human review" : "Review dry-run", "review-card", reviewArgs);
  if (!args.apply) {
    console.log("\nDry-run only. After human approval, run: npm run kb -- review <card-id> --apply");
  }
} else if (command === "search") {
  runStep("Search reviewed cards", "search-cards", process.argv.slice(3));
} else {
  console.error(`ERROR unknown workflow command: ${command}`);
  showHelp();
  process.exit(1);
}
