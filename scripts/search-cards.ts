const {
  cardSearchText,
  hasRiskKeyword,
  loadCards,
  matchedFields,
  parseArgs,
  sourceMap
} = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const query = String(args.query || args.q || args._.join(" ") || "").trim();
const domain = args.domain ? String(args.domain) : "";
const stage = args.stage ? String(args.stage) : "";
const limit = Number(args.limit || 10);
const sourcesById = sourceMap();

const reviewedCards = loadCards("reviewed");
let candidates = reviewedCards;

if (domain) candidates = candidates.filter(({ card }) => card.domain === domain);
if (stage) candidates = candidates.filter(({ card }) => card.stage === stage);

if (query) {
  const lowerQuery = query.toLowerCase();
  candidates = candidates
    .map((entry) => {
      const text = cardSearchText(entry.card);
      const score = text.includes(lowerQuery) ? 1 : 0;
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
} else {
  candidates = candidates.map((entry) => ({ ...entry, score: 0 }));
}

candidates = candidates.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);

console.log("Search scope: cards/reviewed");
if (query) console.log(`Query: ${query}`);
if (domain) console.log(`Domain: ${domain}`);
if (stage) console.log(`Stage: ${stage}`);

if (candidates.length === 0) {
  console.log("当前知识库资料不足");
} else {
  for (const { card } of candidates) {
    const fields = query ? matchedFields(card, query) : [];
    console.log("");
    console.log(`[${card.id}] ${card.title}`);
    console.log(`domain=${card.domain} stage=${card.stage} category=${card.category}`);
    console.log(`summary=${card.summary}`);
    console.log(`matchedFields=${fields.length ? fields.join(",") : "all-reviewed"}`);
    console.log(`sourceIds=${card.sources.join(",")}`);
    for (const sourceId of card.sources) {
      const source = sourcesById.get(sourceId);
      if (source) console.log(`source=${sourceId} | ${source.title} | ${source.organization}`);
    }
  }
}

const riskText = `${query} ${candidates.map(({ card }) => `${card.title} ${card.summary} ${(card.redFlags || []).join(" ")}`).join(" ")}`;
if (hasRiskKeyword(riskText)) {
  console.log("");
  console.log("安全提示：涉及异常、用药、疫苗、发热、黄疸、腹痛、出血、呼吸异常、过敏或心理危机时，本知识库不能替代医生或心理专业人员判断；请咨询医生、及时就医或寻求专业帮助。");
}
