const fs = require("fs");
const path = require("path");

function hasProjectData(dir) {
  return (
    fs.existsSync(path.join(dir, "sources", "source_registry.json")) &&
    fs.existsSync(path.join(dir, "schemas", "enums.json")) &&
    fs.existsSync(path.join(dir, "cards"))
  );
}

function findRootDir(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (hasProjectData(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

const rootDir =
  findRootDir(process.env.KB_ROOT_DIR || process.cwd()) ||
  findRootDir(__dirname) ||
  path.resolve(__dirname, "..", "..");
const sourceRegistryPath = path.join(rootDir, "sources", "source_registry.json");
const enumsPath = path.join(rootDir, "schemas", "enums.json");
const sourceCacheDir = path.join(rootDir, "sources", "cache");
const draftsDir = path.join(rootDir, "cards", "drafts");
const reviewedDir = path.join(rootDir, "cards", "reviewed");

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

const arrayCardFields = [
  "actions",
  "avoid",
  "askDoctorWhen",
  "redFlags",
  "fatherTasks",
  "sources"
];

const requiredSourceFields = [
  "id",
  "title",
  "organization",
  "group",
  "domain",
  "evidenceLevel",
  "useFor",
  "url",
  "accessDate",
  "status"
];

const riskKeywords = [
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function isInside(childPath, parentPath) {
  const rel = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isHttpSource(source) {
  return source && typeof source.url === "string" && isHttpUrl(source.url);
}

function sourceCachePaths(sourceId) {
  return {
    jsonPath: path.join(sourceCacheDir, `${sourceId}.json`),
    textPath: path.join(sourceCacheDir, `${sourceId}.txt`)
  };
}

function readSourceCache(sourceId) {
  const { jsonPath } = sourceCachePaths(sourceId);
  if (!fs.existsSync(jsonPath)) return null;
  return readJson(jsonPath);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value) {
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " "
  };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower[0] === "#") {
      const codePoint = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      if (Number.isFinite(codePoint)) return String.fromCodePoint(codePoint);
      return match;
    }
    return entities[lower] || match;
  });
}

function extractHtmlTitle(html) {
  const titleMatch = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeText(decodeHtmlEntities((titleMatch && titleMatch[1]) || ""));
}

function extractHtmlText(html) {
  let text = String(html || "");
  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<(header|nav|footer|aside|svg|canvas|form)\b[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<\/(h[1-6]|p|li|div|section|article|tr)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  return normalizeText(decodeHtmlEntities(text));
}

function extractHeadingsFromHtml(html) {
  const headings = [];
  const pattern = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let match;
  while ((match = pattern.exec(String(html || "")))) {
    const heading = normalizeText(decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ")));
    if (heading && !headings.includes(heading)) headings.push(heading);
  }
  return headings.slice(0, 40);
}

function contentHash(value) {
  return require("crypto").createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function toKebabCase(value, fallback = "item") {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return ascii || fallback;
}

function firstTextLines(text, limit = 5) {
  return normalizeText(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12)
    .slice(0, limit);
}

function loadEnums() {
  return readJson(enumsPath);
}

function loadSourceRegistry() {
  return readJson(sourceRegistryPath);
}

function sourceMap(registry = loadSourceRegistry()) {
  return new Map(registry.sources.map((source) => [source.id, source]));
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateSourceRegistry(registry, enums = loadEnums()) {
  const errors = [];
  const warnings = [];
  const groupIds = new Set();
  const sourceIds = new Set();

  if (!Array.isArray(registry.groups)) errors.push("sources/source_registry.json: groups must be an array");
  if (!Array.isArray(registry.sources)) errors.push("sources/source_registry.json: sources must be an array");
  if (errors.length) return { errors, warnings };

  for (const group of registry.groups) {
    for (const field of ["id", "name", "description"]) {
      if (!group[field]) errors.push(`source group ${group.id || "(missing id)"} missing ${field}`);
    }
    if (group.id) {
      if (groupIds.has(group.id)) errors.push(`duplicate source group id: ${group.id}`);
      groupIds.add(group.id);
    }
  }

  for (const source of registry.sources) {
    const label = source.id || "(missing id)";
    for (const field of requiredSourceFields) {
      if (!source[field]) errors.push(`source ${label} missing ${field}`);
    }
    if (source.id) {
      if (sourceIds.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
      sourceIds.add(source.id);
    }
    if (source.group && !groupIds.has(source.group)) errors.push(`source ${label} references unknown group ${source.group}`);
    if (source.domain && !enums.domains.includes(source.domain)) errors.push(`source ${label} domain is not a known domain: ${source.domain}`);
    if (source.group && !enums.domains.includes(source.group)) errors.push(`source ${label} group is not a known domain: ${source.group}`);
    if (source.group && source.domain && source.group !== source.domain) errors.push(`source ${label} group and domain must match`);
    if (source.evidenceLevel && !enums.evidenceLevels.includes(source.evidenceLevel)) errors.push(`source ${label} has invalid evidenceLevel ${source.evidenceLevel}`);
    if (source.status && !["active", "needs-review", "deprecated"].includes(source.status)) errors.push(`source ${label} has invalid status ${source.status}`);
    if (source.accessDate && !isDateString(source.accessDate)) errors.push(`source ${label} accessDate must be YYYY-MM-DD`);
    if (source.useFor && !Array.isArray(source.useFor)) errors.push(`source ${label} useFor must be an array`);
    if (source.url && !isHttpUrl(source.url)) {
      const localPath = path.resolve(rootDir, source.url);
      if (!fs.existsSync(localPath)) errors.push(`source ${label} local path does not exist: ${source.url}`);
    }
    if (source.evidenceLevel === "local-material") {
      warnings.push(`source ${label} is hospital-material; do not treat it as universal medical guidance`);
    }
  }

  return { errors, warnings };
}

function validateCard(card, filePath, sourceIds, enums = loadEnums()) {
  const errors = [];
  const warnings = [];
  const rel = path.relative(rootDir, filePath);

  for (const field of requiredCardFields) {
    if (!(field in card)) errors.push(`${rel}: missing required field ${field}`);
  }

  for (const field of arrayCardFields) {
    if (field in card && !Array.isArray(card[field])) errors.push(`${rel}: ${field} must be an array`);
  }

  if (card.id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id)) errors.push(`${rel}: id must be kebab-case lowercase`);
  if (card.domain && !enums.domains.includes(card.domain)) errors.push(`${rel}: invalid domain ${card.domain}`);
  if (card.stage && !enums.stages.includes(card.stage)) errors.push(`${rel}: invalid stage ${card.stage}`);
  if (card.category && !enums.categories.includes(card.category)) errors.push(`${rel}: invalid category ${card.category}`);
  if (card.shoppingType && !enums.shoppingTypes.includes(card.shoppingType)) errors.push(`${rel}: invalid shoppingType ${card.shoppingType}`);
  if (card.evidenceLevel && !enums.evidenceLevels.includes(card.evidenceLevel)) errors.push(`${rel}: invalid evidenceLevel ${card.evidenceLevel}`);
  if (card.reviewStatus && !enums.reviewStatuses.includes(card.reviewStatus)) errors.push(`${rel}: invalid reviewStatus ${card.reviewStatus}`);
  if (card.updatedAt && !isDateString(card.updatedAt)) errors.push(`${rel}: updatedAt must be YYYY-MM-DD`);

  if (Array.isArray(card.sources)) {
    if (card.sources.length === 0) errors.push(`${rel}: sources must contain at least one sourceId`);
    for (const sourceId of card.sources) {
      if (!sourceIds.has(sourceId)) errors.push(`${rel}: unknown sourceId ${sourceId}`);
    }
  }

  const inDrafts = filePath.startsWith(draftsDir);
  const inReviewed = filePath.startsWith(reviewedDir);
  if (inDrafts && card.reviewStatus === "reviewed") errors.push(`${rel}: draft card cannot have reviewStatus reviewed`);
  if (inReviewed && card.reviewStatus !== "reviewed") errors.push(`${rel}: reviewed card must have reviewStatus reviewed`);

  if (card.domain === "medical" && Array.isArray(card.redFlags) && card.redFlags.length > 0 && (!Array.isArray(card.askDoctorWhen) || card.askDoctorWhen.length === 0)) {
    errors.push(`${rel}: medical card with redFlags must include askDoctorWhen`);
  }

  return { errors, warnings };
}

function loadCards(scope = "all") {
  const files = [];
  if (scope === "all" || scope === "drafts") files.push(...walkJsonFiles(draftsDir));
  if (scope === "all" || scope === "reviewed") files.push(...walkJsonFiles(reviewedDir));
  return files.map((filePath) => ({ filePath, card: readJson(filePath) }));
}

function markdownList(items) {
  if (!Array.isArray(items) || items.length === 0) return "- 无";
  return items.map((item) => `- ${item}`).join("\n");
}

function renderCardMarkdown(card, sourcesById = sourceMap()) {
  const sourceLines = (card.sources || []).map((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (!source) return `- ${sourceId}`;
    return `- ${sourceId}: ${source.title} (${source.organization})`;
  });

  return `# ${card.title}

- cardId: ${card.id}
- domain: ${card.domain}
- stage: ${card.stage}
- category: ${card.category}
- reviewStatus: ${card.reviewStatus}
- evidenceLevel: ${card.evidenceLevel}
- updatedAt: ${card.updatedAt}

## 摘要

${card.summary}

## 具体动作

${markdownList(card.actions)}

## 不要做什么

${markdownList(card.avoid)}

## 何时咨询医生或寻求专业帮助

${markdownList(card.askDoctorWhen)}

## 危险信号

${markdownList(card.redFlags)}

## 购物类型

${card.shoppingType}

## 爸爸/丈夫任务

${markdownList(card.fatherTasks)}

## 来源

${sourceLines.length ? sourceLines.join("\n") : "- 无"}
`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function cardSearchText(card) {
  return [
    card.id,
    card.title,
    card.domain,
    card.stage,
    card.category,
    card.summary,
    ...(card.actions || []),
    ...(card.avoid || []),
    ...(card.askDoctorWhen || []),
    ...(card.redFlags || []),
    ...(card.fatherTasks || []),
    ...(card.sources || [])
  ].join("\n").toLowerCase();
}

function matchedFields(card, query) {
  const fields = {
    title: card.title,
    summary: card.summary,
    actions: (card.actions || []).join(" "),
    avoid: (card.avoid || []).join(" "),
    askDoctorWhen: (card.askDoctorWhen || []).join(" "),
    redFlags: (card.redFlags || []).join(" "),
    fatherTasks: (card.fatherTasks || []).join(" "),
    sourceIds: (card.sources || []).join(" ")
  };
  const lowerQuery = query.toLowerCase();
  return Object.entries(fields)
    .filter(([, value]) => String(value || "").toLowerCase().includes(lowerQuery))
    .map(([field]) => field);
}

function hasRiskKeyword(text) {
  return riskKeywords.some((keyword) => text.includes(keyword));
}

function cardAllText(card) {
  return [
    card.id,
    card.title,
    card.domain,
    card.stage,
    card.category,
    card.summary,
    card.shoppingType,
    ...(card.actions || []),
    ...(card.avoid || []),
    ...(card.askDoctorWhen || []),
    ...(card.redFlags || []),
    ...(card.fatherTasks || []),
    ...(card.sources || [])
  ].join("\n");
}

function scanCardQuality(card, filePath, sourcesById = sourceMap()) {
  const errors = [];
  const warnings = [];
  const rel = path.relative(rootDir, filePath);
  const text = cardAllText(card);
  const lowerText = text.toLowerCase();
  const inDrafts = isInside(filePath, draftsDir);
  const inReviewed = isInside(filePath, reviewedDir);

  if (inDrafts && card.reviewStatus === "reviewed") errors.push(`${rel}: draft path cannot contain reviewStatus=reviewed`);
  if (inReviewed && card.reviewStatus !== "reviewed") errors.push(`${rel}: reviewed path must contain reviewStatus=reviewed`);
  if (inReviewed && card.reviewStatus === "draft") errors.push(`${rel}: draft card is placed under reviewed`);

  if (!Array.isArray(card.sources) || card.sources.length === 0) {
    errors.push(`${rel}: sources must contain at least one sourceId`);
  } else {
    for (const sourceId of card.sources) {
      if (!sourcesById.has(sourceId)) errors.push(`${rel}: unknown sourceId ${sourceId}`);
    }
  }

  const dosePatterns = [
    /\b\d+(\.\d+)?\s*(mg|g|ml|mcg|μg|iu|units?)\b/i,
    /\b\d+(\.\d+)?\s*(毫克|克|毫升|微克|单位)\b/,
    /(每次|每日|每天|一天)\s*\d+/
  ];
  if (dosePatterns.some((pattern) => pattern.test(text))) errors.push(`${rel}: contains possible medication dosage expression`);

  const diagnosisPatterns = [
    /(确诊为|诊断为|就是|属于).{0,8}(抑郁|焦虑|感染|肺炎|黄疸|过敏|疾病|病)/,
    /(不用|无需).{0,8}(看医生|就医|处理|担心)/,
    /(肯定|一定|绝对).{0,8}(没事|正常|安全|不会)/
  ];
  if (diagnosisPatterns.some((pattern) => pattern.test(text))) errors.push(`${rel}: contains possible diagnosis or reassurance wording`);

  const shoppingPromoPatterns = [
    /(点击|下单|购买链接|优惠券|返利|全网最低|必买|闭眼入|种草|带货|旗舰店|直播间)/,
    /(推荐|首选).{0,12}(品牌|牌子|型号)/
  ];
  if (card.domain === "shopping" && shoppingPromoPatterns.some((pattern) => pattern.test(text))) {
    errors.push(`${rel}: shopping card contains possible brand recommendation or affiliate wording`);
  }

  const riskPattern = /(异常|用药|药|疫苗|发热|发烧|黄疸|腹痛|出血|呼吸|过敏|自伤|绝望|失眠|无法照顾|心理危机)/;
  if (riskPattern.test(text)) warnings.push(`${rel}: contains risk keywords; confirm professional-help boundaries are explicit`);

  if (Array.isArray(card.redFlags) && card.redFlags.length > 0 && (!Array.isArray(card.askDoctorWhen) || card.askDoctorWhen.length === 0)) {
    warnings.push(`${rel}: redFlags exist but askDoctorWhen is empty`);
  }

  if (card.domain === "mental-health") {
    const hasCrisis = /(自伤|伤害自己|伤害他人|绝望|失眠|无法照顾|心理危机)/.test(text);
    const hasHelp = /(专业|精神科|心理|急诊|危机|求助|就医)/.test(text);
    if (hasCrisis && !hasHelp) warnings.push(`${rel}: mental-health crisis wording needs professional-help escalation`);
  }

  if (card.domain === "shopping" && !["must-have", "optional", "not-recommended"].includes(card.shoppingType)) {
    warnings.push(`${rel}: shopping card should classify must-have, optional, or not-recommended`);
  }

  if (card.domain === "father-tasks") {
    const taskText = (card.fatherTasks || []).join("\n");
    if (!Array.isArray(card.fatherTasks) || card.fatherTasks.length === 0 || taskText.length < 20 || /(多关心|多陪伴|支持妈妈|保持沟通)$/.test(taskText.trim())) {
      warnings.push(`${rel}: fatherTasks may be too vague; add concrete actions`);
    }
  }

  return { errors, warnings };
}

function scanCardsQuality(scope = "all") {
  const registry = loadSourceRegistry();
  const sourcesById = sourceMap(registry);
  const entries = loadCards(scope);
  const results = entries.map(({ filePath, card }) => ({
    filePath,
    cardId: card.id,
    ...scanCardQuality(card, filePath, sourcesById)
  }));
  return {
    scope,
    results,
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings)
  };
}

module.exports = {
  rootDir,
  sourceRegistryPath,
  sourceCacheDir,
  draftsDir,
  reviewedDir,
  riskKeywords,
  readJson,
  writeJson,
  writeText,
  walkJsonFiles,
  isInside,
  isHttpSource,
  sourceCachePaths,
  readSourceCache,
  normalizeText,
  extractHtmlTitle,
  extractHtmlText,
  extractHeadingsFromHtml,
  contentHash,
  toKebabCase,
  firstTextLines,
  loadEnums,
  loadSourceRegistry,
  sourceMap,
  validateSourceRegistry,
  validateCard,
  loadCards,
  renderCardMarkdown,
  parseArgs,
  cardSearchText,
  matchedFields,
  hasRiskKeyword,
  cardAllText,
  scanCardQuality,
  scanCardsQuality
};
