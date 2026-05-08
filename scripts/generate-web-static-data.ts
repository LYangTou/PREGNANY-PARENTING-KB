const path = require("path");

const {
  cardSearchText,
  draftsDir,
  hasRiskKeyword,
  loadCards,
  loadEnums,
  loadSourceRegistry,
  matchedFields,
  readJson,
  renderCardMarkdown,
  reviewedDir,
  rootDir,
  scanCardQuality,
  sourceMap,
  validateCard,
  validateSourceRegistry,
  walkJsonFiles,
  writeJson
} = require("./lib/kb");

const requiredCardFields = [
  "id",
  "title",
  "domain",
  "stage",
  "category",
  "summary",
  "actions",
  "avoid",
  "askDoctorWhen",
  "redFlags",
  "shoppingType",
  "fatherTasks",
  "sources",
  "evidenceLevel",
  "reviewStatus",
  "updatedAt"
];

const outputPath = path.join(rootDir, "web", "public", "kb-static.json");
const safetyKeywords = [
  "异常",
  "用药",
  "药",
  "疫苗",
  "发热",
  "发烧",
  "黄疸",
  "腹痛",
  "出血",
  "呼吸",
  "过敏",
  "自伤",
  "绝望",
  "失眠",
  "无法照顾",
  "心理危机"
];

function summarizeCard(filePath, card) {
  return {
    id: card.id,
    title: card.title,
    domain: card.domain,
    stage: card.stage,
    category: card.category,
    reviewStatus: card.reviewStatus,
    evidenceLevel: card.evidenceLevel,
    updatedAt: card.updatedAt,
    filePath: path.relative(rootDir, filePath),
    summary: card.summary,
    sourceIds: card.sources || []
  };
}

function sourceCounts(registry) {
  return registry.sources.reduce((acc, source) => {
    acc[source.group] = (acc[source.group] || 0) + 1;
    return acc;
  }, {});
}

function fieldStatus(card) {
  return requiredCardFields.map((field) => ({
    field,
    present: Object.prototype.hasOwnProperty.call(card, field),
    filled: Array.isArray(card[field]) ? card[field].length > 0 : Boolean(card[field])
  }));
}

function cardRiskText(card) {
  return [
    card.title,
    card.summary,
    ...(card.actions || []),
    ...(card.avoid || []),
    ...(card.askDoctorWhen || []),
    ...(card.redFlags || []),
    ...(card.fatherTasks || [])
  ].join("\n");
}

function safetyNoticeFor(text) {
  if (!hasRiskKeyword(text) && !safetyKeywords.some((keyword) => String(text || "").includes(keyword))) return "";
  return "安全提示：涉及异常、用药、疫苗、发热、黄疸、腹痛、出血、呼吸异常、过敏或心理危机时，本知识库不能替代医生或心理专业人员判断；请咨询医生、及时就医或寻求专业帮助。";
}

function decorateSources(card, sourcesById) {
  return (card.sources || []).map((sourceId) => sourcesById.get(sourceId) || { id: sourceId, missing: true });
}

function buildDraftDetail(entry, context) {
  const cardResult = validateCard(entry.card, entry.filePath, context.sourcesById, context.enums);
  return {
    draft: summarizeCard(entry.filePath, entry.card),
    card: entry.card,
    markdown: renderCardMarkdown(entry.card, context.sourcesById),
    sources: decorateSources(entry.card, context.sourcesById),
    fieldStatus: fieldStatus(entry.card),
    validation: {
      errors: [...context.sourceResult.errors, ...cardResult.errors],
      warnings: [...context.sourceResult.warnings, ...cardResult.warnings]
    },
    quality: scanCardQuality(entry.card, entry.filePath, context.sourcesById),
    safetyNotice: safetyNoticeFor(cardRiskText(entry.card))
  };
}

function buildReviewedEntry(entry, sourcesById) {
  const summary = summarizeCard(entry.filePath, entry.card);
  return {
    ...summary,
    card: entry.card,
    matchedFields: ["all-reviewed"],
    sources: decorateSources(entry.card, sourcesById)
  };
}

const enums = loadEnums();
const registry = loadSourceRegistry();
const sourceResult = validateSourceRegistry(registry, enums);
const sourcesById = sourceMap(registry);
const context = { enums, registry, sourceResult, sourcesById };
const drafts = loadCards("drafts").map((entry) => buildDraftDetail(entry, context));
const reviewed = loadCards("reviewed").map((entry) => buildReviewedEntry(entry, sourcesById));

const payload = {
  generatedAt: new Date().toISOString(),
  mode: "github-pages-static-preview",
  notice: "GitHub Pages 仅提供只读预览；查询仍只基于 cards/reviewed/，drafts 不作为问答依据。",
  status: {
    sourceCounts: sourceCounts(registry),
    draftCards: drafts.length,
    reviewedCards: reviewed.length,
    draftJsonFiles: walkJsonFiles(draftsDir).length,
    reviewedJsonFiles: walkJsonFiles(reviewedDir).length,
    enums
  },
  drafts,
  reviewed,
  searchIndex: reviewed.map((entry) => ({
    id: entry.id,
    text: cardSearchText(entry.card)
  }))
};

writeJson(outputPath, payload);
console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
console.log(`Static preview: ${drafts.length} drafts, ${reviewed.length} reviewed cards`);
