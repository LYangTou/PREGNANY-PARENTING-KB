const path = require("path");
const {
  loadCards,
  parseArgs,
  renderCardMarkdown,
  sourceMap,
  writeText
} = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const scope = args.reviewed ? "reviewed" : args.drafts ? "drafts" : "all";
const id = args.id || args._[0];
const sourcesById = sourceMap();
const cards = loadCards(scope).filter(({ card }) => !id || card.id === id);

if (id && cards.length === 0) {
  console.error(`ERROR card not found: ${id}`);
  process.exit(1);
}

for (const { filePath, card } of cards) {
  const mdPath = filePath.replace(/\.json$/, ".md");
  writeText(mdPath, renderCardMarkdown(card, sourcesById));
  console.log(`WROTE ${path.relative(process.cwd(), mdPath)}`);
}

console.log(`OK generated markdown for ${cards.length} card(s)`);
