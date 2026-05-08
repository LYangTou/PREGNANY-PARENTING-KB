const { parseArgs, scanCardsQuality } = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const scope = args.scope ? String(args.scope) : args.reviewed ? "reviewed" : args.drafts ? "drafts" : "all";
const json = Boolean(args.json);

if (!["drafts", "reviewed", "all"].includes(scope)) {
  console.error("ERROR --scope must be drafts, reviewed, or all");
  process.exit(1);
}

const report = scanCardsQuality(scope);

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const warning of report.warnings) console.warn(`WARN ${warning}`);
  for (const error of report.errors) console.error(`ERROR ${error}`);
  console.log(`OK quality scan completed: scope=${scope}, cards=${report.results.length}, errors=${report.errors.length}, warnings=${report.warnings.length}`);
}

if (report.errors.length > 0) process.exit(1);
