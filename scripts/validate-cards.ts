const {
  loadCards,
  loadEnums,
  loadSourceRegistry,
  parseArgs,
  sourceMap,
  validateCard,
  validateSourceRegistry
} = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const scope = args.reviewed ? "reviewed" : args.drafts ? "drafts" : "all";
const enums = loadEnums();
const registry = loadSourceRegistry();
const sourceResult = validateSourceRegistry(registry, enums);
const sourcesById = sourceMap(registry);
const errors = [...sourceResult.errors];
const warnings = [...sourceResult.warnings];
const cards = loadCards(scope);

for (const { filePath, card } of cards) {
  const result = validateCard(card, filePath, sourcesById, enums);
  errors.push(...result.errors);
  warnings.push(...result.warnings);
}

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log(`OK cards validated: ${cards.length} card(s), scope=${scope}`);
