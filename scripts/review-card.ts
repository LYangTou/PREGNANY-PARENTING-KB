const fs = require("fs");
const path = require("path");
const {
  draftsDir,
  reviewedDir,
  loadEnums,
  loadSourceRegistry,
  parseArgs,
  readJson,
  renderCardMarkdown,
  scanCardQuality,
  sourceMap,
  validateCard,
  validateSourceRegistry,
  walkJsonFiles,
  writeJson,
  writeText
} = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const target = args._[0];
const force = Boolean(args.force);
const dryRun = Boolean(args["dry-run"]);

if (!target) {
  console.error("Usage: node scripts/run.js review-card <card-id-or-draft-json-path> [--dry-run] [--force]");
  process.exit(1);
}

function findDraftCard(targetValue) {
  const candidatePath = path.resolve(process.cwd(), targetValue);
  if (fs.existsSync(candidatePath) && candidatePath.endsWith(".json")) return candidatePath;

  for (const filePath of walkJsonFiles(draftsDir)) {
    const card = readJson(filePath);
    if (card.id === targetValue) return filePath;
  }
  return null;
}

const draftPath = findDraftCard(target);
if (!draftPath) {
  console.error(`ERROR draft card not found: ${target}`);
  process.exit(1);
}

const resolvedDraftPath = path.resolve(draftPath);
if (!resolvedDraftPath.startsWith(path.resolve(draftsDir))) {
  console.error("ERROR review-card only accepts files under cards/drafts");
  process.exit(1);
}

const enums = loadEnums();
const registry = loadSourceRegistry();
const sourceResult = validateSourceRegistry(registry, enums);
if (sourceResult.errors.length > 0) {
  for (const error of sourceResult.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

const sourcesById = sourceMap(registry);
const draftCard = readJson(resolvedDraftPath);
const draftResult = validateCard(draftCard, resolvedDraftPath, sourcesById, enums);
if (draftResult.errors.length > 0) {
  for (const error of draftResult.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

const draftQuality = scanCardQuality(draftCard, resolvedDraftPath, sourcesById);
for (const warning of draftQuality.warnings) console.warn(`WARN ${warning}`);
if (draftQuality.errors.length > 0) {
  for (const error of draftQuality.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

if (!["draft", "needs-review"].includes(draftCard.reviewStatus)) {
  console.error(`ERROR card must be draft or needs-review before review, got ${draftCard.reviewStatus}`);
  process.exit(1);
}

const reviewedCard = { ...draftCard, reviewStatus: "reviewed" };
const destinationDir = path.join(reviewedDir, reviewedCard.domain);
const destinationJson = path.join(destinationDir, `${reviewedCard.id}.json`);
const destinationMd = path.join(destinationDir, `${reviewedCard.id}.md`);

if (!force && (fs.existsSync(destinationJson) || fs.existsSync(destinationMd))) {
  console.error(`ERROR reviewed card already exists: ${path.relative(process.cwd(), destinationJson)}. Use --force to overwrite.`);
  process.exit(1);
}

const reviewedResult = validateCard(reviewedCard, destinationJson, sourcesById, enums);
if (reviewedResult.errors.length > 0) {
  for (const error of reviewedResult.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

const reviewedQuality = scanCardQuality(reviewedCard, destinationJson, sourcesById);
for (const warning of reviewedQuality.warnings) console.warn(`WARN ${warning}`);
if (reviewedQuality.errors.length > 0) {
  for (const error of reviewedQuality.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

if (dryRun) {
  console.log(`OK dry-run passed: ${reviewedCard.id} can be reviewed after human approval`);
  console.log(`WOULD WRITE ${path.relative(process.cwd(), destinationJson)}`);
  process.exit(0);
}

writeJson(destinationJson, reviewedCard);
writeText(destinationMd, renderCardMarkdown(reviewedCard, sourcesById));

const draftMd = resolvedDraftPath.replace(/\.json$/, ".md");
fs.unlinkSync(resolvedDraftPath);
if (fs.existsSync(draftMd)) fs.unlinkSync(draftMd);

console.log(`OK reviewed card created: ${path.relative(process.cwd(), destinationJson)}`);
