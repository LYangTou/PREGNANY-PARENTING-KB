import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { badgeText, labelAliases } from "./labels.js";
import * as kb from "./kb-runtime.js";

const {
  cardSearchText,
  draftsDir,
  hasRiskKeyword,
  isInside,
  loadCards,
  loadEnums,
  loadSourceRegistry,
  readJson,
  renderCardMarkdown,
  reviewedDir,
  rootDir,
  scanCardQuality,
  sourceMap,
  validateCard,
  validateSourceRegistry,
  walkJsonFiles,
  writeJson,
  writeText
} = kb;

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

const dryRunApprovals = new Map();

export class HttpError extends Error {
  constructor(statusCode, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function jsonError(error) {
  return {
    error: error.message || "Internal server error",
    details: error.details || []
  };
}

export function getAgentConfig() {
  const timeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 50000);
  return {
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    thinking: process.env.DEEPSEEK_THINKING === "true",
    reasoningEffort: process.env.DEEPSEEK_REASONING_EFFORT || "medium",
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 50000
  };
}

function getRegistryContext() {
  const enums = loadEnums();
  const registry = loadSourceRegistry();
  const sourceResult = validateSourceRegistry(registry, enums);
  const sourcesById = sourceMap(registry);
  return { enums, registry, sourceResult, sourcesById };
}

function sourceCounts(registry) {
  return registry.sources.reduce((acc, source) => {
    acc[source.group] = (acc[source.group] || 0) + 1;
    return acc;
  }, {});
}

export function summarizeCard(filePath, card) {
  return {
    id: card.id,
    title: card.title,
    domain: card.domain,
    stage: card.stage,
    category: card.category,
    reviewStatus: card.reviewStatus,
    evidenceLevel: card.evidenceLevel,
    updatedAt: card.updatedAt,
    filePath: path.relative(rootDir, filePath)
  };
}

export function getStatus() {
  const { enums, registry } = getRegistryContext();
  const drafts = loadCards("drafts");
  const reviewed = loadCards("reviewed");
  return {
    sourceRegistry: "sources/source_registry.json",
    sourceCounts: sourceCounts(registry),
    draftCards: drafts.length,
    reviewedCards: reviewed.length,
    draftJsonFiles: walkJsonFiles(draftsDir).length,
    reviewedJsonFiles: walkJsonFiles(reviewedDir).length,
    enums,
    agent: getAgentConfig()
  };
}

export function listDrafts(searchParams) {
  const domain = searchParams.get("domain");
  const stage = searchParams.get("stage");
  const category = searchParams.get("category");
  const reviewStatus = searchParams.get("reviewStatus");
  const drafts = loadCards("drafts")
    .filter(({ card }) => !domain || card.domain === domain)
    .filter(({ card }) => !stage || card.stage === stage)
    .filter(({ card }) => !category || card.category === category)
    .filter(({ card }) => !reviewStatus || card.reviewStatus === reviewStatus)
    .map(({ filePath, card }) => summarizeCard(filePath, card));
  return { scope: "cards/drafts", drafts };
}

function findDraftCard(id) {
  for (const filePath of walkJsonFiles(draftsDir)) {
    const card = readJson(filePath);
    if (card.id === id) return { filePath, card };
  }
  return null;
}

function fieldStatus(card) {
  return requiredCardFields.map((field) => ({
    field,
    present: Object.prototype.hasOwnProperty.call(card, field),
    filled: Array.isArray(card[field]) ? card[field].length > 0 : Boolean(card[field])
  }));
}

function getCardValidation(card, filePath, context = getRegistryContext()) {
  const cardResult = validateCard(card, filePath, context.sourcesById, context.enums);
  return {
    errors: [...context.sourceResult.errors, ...cardResult.errors],
    warnings: [...context.sourceResult.warnings, ...cardResult.warnings]
  };
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

function hasSafetyKeyword(text) {
  return hasRiskKeyword(text) || safetyKeywords.some((keyword) => text.includes(keyword));
}

export function safetyNoticeFor(text) {
  if (!hasSafetyKeyword(String(text || ""))) return "";
  return "安全提示：涉及异常、用药、疫苗、发热、黄疸、腹痛、出血、呼吸异常、过敏或心理危机时，本知识库不能替代医生或心理专业人员判断；请咨询医生、及时就医或寻求专业帮助。";
}

export function getDraftDetail(id) {
  const entry = findDraftCard(id);
  if (!entry) throw new HttpError(404, `Draft card not found: ${id}`);
  const context = getRegistryContext();
  const validation = getCardValidation(entry.card, entry.filePath, context);
  const quality = scanCardQuality(entry.card, entry.filePath, context.sourcesById);
  const sources = (entry.card.sources || []).map((sourceId) => context.sourcesById.get(sourceId) || { id: sourceId, missing: true });
  return {
    scope: "cards/drafts",
    draft: summarizeCard(entry.filePath, entry.card),
    card: entry.card,
    markdown: renderCardMarkdown(entry.card, context.sourcesById),
    sources,
    fieldStatus: fieldStatus(entry.card),
    validation,
    quality,
    safetyNotice: safetyNoticeFor(cardRiskText(entry.card))
  };
}

function reviewCheck(id, options = {}) {
  const entry = findDraftCard(id);
  if (!entry) throw new HttpError(404, `Draft card not found: ${id}`);

  const resolvedDraftPath = path.resolve(entry.filePath);
  if (!isInside(resolvedDraftPath, draftsDir)) {
    throw new HttpError(400, "review only accepts files under cards/drafts");
  }

  const context = getRegistryContext();
  if (context.sourceResult.errors.length > 0) {
    throw new HttpError(400, "source registry validation failed", context.sourceResult.errors);
  }

  const draftResult = validateCard(entry.card, resolvedDraftPath, context.sourcesById, context.enums);
  if (draftResult.errors.length > 0) {
    throw new HttpError(400, "draft card validation failed", draftResult.errors);
  }

  const draftQuality = scanCardQuality(entry.card, resolvedDraftPath, context.sourcesById);
  if (draftQuality.errors.length > 0) {
    throw new HttpError(400, "draft card quality scan failed", draftQuality.errors);
  }

  if (!["draft", "needs-review"].includes(entry.card.reviewStatus)) {
    throw new HttpError(400, `card must be draft or needs-review before review, got ${entry.card.reviewStatus}`);
  }

  const reviewedCard = { ...entry.card, reviewStatus: "reviewed" };
  const destinationDir = path.join(reviewedDir, reviewedCard.domain);
  const destinationJson = path.join(destinationDir, `${reviewedCard.id}.json`);
  const destinationMd = path.join(destinationDir, `${reviewedCard.id}.md`);

  if (!options.force && (fs.existsSync(destinationJson) || fs.existsSync(destinationMd))) {
    throw new HttpError(409, `reviewed card already exists: ${path.relative(rootDir, destinationJson)}`);
  }

  const reviewedResult = validateCard(reviewedCard, destinationJson, context.sourcesById, context.enums);
  if (reviewedResult.errors.length > 0) {
    throw new HttpError(400, "reviewed card validation failed", reviewedResult.errors);
  }

  const reviewedQuality = scanCardQuality(reviewedCard, destinationJson, context.sourcesById);
  if (reviewedQuality.errors.length > 0) {
    throw new HttpError(400, "reviewed card quality scan failed", reviewedQuality.errors);
  }

  return {
    draftPath: resolvedDraftPath,
    draftMdPath: resolvedDraftPath.replace(/\.json$/, ".md"),
    reviewedCard,
    destinationJson,
    destinationMd,
    context
  };
}

function createDryRunToken(id, draftPath) {
  const stat = fs.statSync(draftPath);
  const token = crypto.randomUUID();
  dryRunApprovals.set(token, {
    id,
    draftPath,
    mtimeMs: stat.mtimeMs,
    createdAt: Date.now()
  });
  return token;
}

function assertDryRunToken(id, draftPath, token) {
  const approval = dryRunApprovals.get(token);
  if (!approval || approval.id !== id || approval.draftPath !== draftPath) {
    throw new HttpError(400, "review apply requires a successful dry-run token");
  }
  const stat = fs.statSync(draftPath);
  if (stat.mtimeMs !== approval.mtimeMs) {
    dryRunApprovals.delete(token);
    throw new HttpError(409, "draft changed after dry-run; run dry-run again");
  }
}

export function createReviewDryRun(id) {
  const check = reviewCheck(id);
  const dryRunToken = createDryRunToken(id, check.draftPath);
  return {
    ok: true,
    dryRunToken,
    message: `${id} can be reviewed after human approval`,
    wouldWrite: path.relative(rootDir, check.destinationJson)
  };
}

export function applyReview(id, body) {
  const check = reviewCheck(id, { force: Boolean(body.force) });
  if (!body.confirmReview) {
    throw new HttpError(400, "review apply requires confirmReview=true");
  }
  assertDryRunToken(id, check.draftPath, body.dryRunToken);

  writeJson(check.destinationJson, check.reviewedCard);
  writeText(check.destinationMd, renderCardMarkdown(check.reviewedCard, check.context.sourcesById));
  fs.unlinkSync(check.draftPath);
  if (fs.existsSync(check.draftMdPath)) fs.unlinkSync(check.draftMdPath);
  dryRunApprovals.delete(body.dryRunToken);

  return {
    ok: true,
    reviewedCard: summarizeCard(check.destinationJson, check.reviewedCard),
    destinationJson: path.relative(rootDir, check.destinationJson),
    destinationMd: path.relative(rootDir, check.destinationMd)
  };
}

function addTerms(target, terms, reason) {
  for (const term of terms) {
    target.terms.add(String(term).toLowerCase());
  }
  if (reason) target.reasons.add(reason);
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

export function buildRetrievalPlan(query, explicitFilters = {}) {
  const lower = String(query || "").toLowerCase();
  const plan = {
    originalQuery: String(query || "").trim(),
    terms: new Set([lower]),
    softDomains: new Set(),
    softStages: new Set(),
    softCategories: new Set(),
    strictStages: new Set(),
    requestedAudiences: new Set(),
    reasons: new Set()
  };

  for (const alias of labelAliases()) {
    if (alias.label && lower.includes(alias.label.toLowerCase())) {
      addTerms(plan, [alias.id, alias.label], `命中标签：${alias.label}`);
      if (alias.kind === "domain") plan.softDomains.add(alias.id);
      if (alias.kind === "stage") plan.softStages.add(alias.id);
      if (alias.kind === "category") plan.softCategories.add(alias.id);
    }
  }

  if (includesAny(lower, ["爸爸", "父亲", "丈夫", "老公", "准爸爸", "伴侣", "队友", "先生", "宝爸"])) {
    addTerms(plan, ["father-tasks", "father-prenatal", "fatherTasks", "爸爸", "父亲", "丈夫", "准爸爸", "陪同", "支持", "任务"], "识别为爸爸/丈夫任务问题");
    plan.softDomains.add("father-tasks");
    plan.softCategories.add("father-prenatal");
    plan.requestedAudiences.add("father");
  }

  if (includesAny(lower, ["妈妈", "母亲", "孕妇", "孕妈妈", "准妈妈", "产妇"])) {
    addTerms(plan, ["medical", "mental-health", "孕妇", "孕妈妈", "妈妈", "母亲", "产检", "膳食", "营养", "症状"], "识别为妈妈/孕妇相关问题");
    plan.requestedAudiences.add("mother");
  }

  if (includesAny(lower, ["孕期", "怀孕", "妊娠", "孕妇", "孕妈妈", "准妈妈"])) {
    addTerms(plan, ["pregnancy-all", "pregnancy-early", "pregnancy-middle", "pregnancy-late", "孕期", "孕早期", "孕中期", "孕晚期", "怀孕"], "识别为孕期问题");
    plan.softStages.add("pregnancy-all");
    plan.softStages.add("pregnancy-early");
    plan.softStages.add("pregnancy-middle");
    plan.softStages.add("pregnancy-late");
  }

  if (includesAny(lower, ["孕早期", "早孕", "怀孕早期"])) {
    addTerms(plan, ["pregnancy-early", "孕早期"], "识别为孕早期");
    plan.softStages.add("pregnancy-early");
    plan.strictStages.add("pregnancy-early");
  }

  if (includesAny(lower, ["孕中期", "怀孕中期"])) {
    addTerms(plan, ["pregnancy-middle", "孕中期"], "识别为孕中期");
    plan.softStages.add("pregnancy-middle");
    plan.strictStages.add("pregnancy-middle");
  }

  if (includesAny(lower, ["孕晚期", "怀孕晚期", "临产"])) {
    addTerms(plan, ["pregnancy-late", "孕晚期", "分娩", "待产"], "识别为孕晚期");
    plan.softStages.add("pregnancy-late");
    plan.strictStages.add("pregnancy-late");
  }

  if (includesAny(lower, ["注意", "注意事项", "要点", "怎么做", "该做什么", "任务", "清单", "准备", "支持"])) {
    addTerms(plan, ["actions", "avoid", "askDoctorWhen", "redFlags", "fatherTasks", "任务", "清单", "准备", "不要", "何时求助"], "识别为行动建议问题");
  }

  if (
    [...plan.softStages].some((stage) => stage.startsWith("pregnancy-")) &&
    plan.requestedAudiences.size === 0 &&
    includesAny(lower, ["应该", "要做", "干什么", "做什么", "注意", "准备", "怎么做"])
  ) {
    plan.requestedAudiences.add("mother");
    plan.requestedAudiences.add("father");
    plan.requestedAudiences.add("joint");
    addTerms(plan, ["medical", "father-tasks", "妈妈", "爸爸", "孕妇", "伴侣", "共同"], "识别为孕期家庭分工问题");
  }

  if (includesAny(lower, ["产检", "检查", "复查"])) {
    addTerms(plan, ["prenatal-checkup", "father-prenatal", "产检", "复查", "医生建议"], "识别为产检相关问题");
    plan.softCategories.add("prenatal-checkup");
    plan.softCategories.add("father-prenatal");
  }

  if (includesAny(lower, ["陪产", "分娩", "生产", "待产"])) {
    addTerms(plan, ["father-birth", "birth", "陪产", "分娩", "待产"], "识别为陪产/分娩相关问题");
    plan.softCategories.add("father-birth");
    plan.softStages.add("birth");
  }

  if (includesAny(lower, ["安全睡眠", "睡眠用品", "婴儿床", "睡觉"])) {
    addTerms(plan, ["safe-sleep-shopping", "newborn", "安全睡眠", "睡眠用品", "婴儿床"], "识别为安全睡眠用品问题");
    plan.softDomains.add("shopping");
    plan.softCategories.add("safe-sleep-shopping");
    plan.softStages.add("newborn");
  }

  if (explicitFilters.domain) plan.softDomains.add(explicitFilters.domain);
  if (explicitFilters.stage) plan.softStages.add(explicitFilters.stage);
  if (explicitFilters.category) plan.softCategories.add(explicitFilters.category);

  return {
    originalQuery: plan.originalQuery,
    terms: [...plan.terms].filter(Boolean),
    softDomains: [...plan.softDomains],
    softStages: [...plan.softStages],
    softCategories: [...plan.softCategories],
    strictStages: [...plan.strictStages],
    requestedAudiences: [...plan.requestedAudiences],
    reasons: [...plan.reasons]
  };
}

function searchableCardText(card) {
  return [
    cardSearchText(card),
    badgeText("domain", card.domain),
    badgeText("stage", card.stage),
    badgeText("category", card.category),
    badgeText("shoppingType", card.shoppingType),
    "actions",
    "avoid",
    "askDoctorWhen",
    "redFlags",
    "fatherTasks",
    "具体动作",
    "不要做什么",
    "何时求助",
    "危险信号",
    "爸爸任务"
  ].join("\n").toLowerCase();
}

function scoreCard(card, plan) {
  const text = searchableCardText(card);
  let score = 0;
  const matchedTerms = [];

  for (const term of plan.terms) {
    if (!term) continue;
    if (text.includes(term)) {
      score += term === plan.originalQuery.toLowerCase() ? 8 : 3;
      matchedTerms.push(term);
    }
  }

  if (plan.softDomains.includes(card.domain)) score += 8;
  if (plan.softStages.includes(card.stage)) score += 6;
  if (plan.softCategories.includes(card.category)) score += 6;
  if (plan.softStages.some((stage) => stage.startsWith("pregnancy-")) && card.stage === "pregnancy-all") score += 4;
  if (plan.softDomains.includes("father-tasks") && card.category?.startsWith("father-")) score += 4;

  return { score, matchedTerms };
}

function matchedFieldsForTerms(card, terms) {
  const fields = {
    id: card.id,
    title: card.title,
    domain: `${card.domain} ${badgeText("domain", card.domain)}`,
    stage: `${card.stage} ${badgeText("stage", card.stage)}`,
    category: `${card.category} ${badgeText("category", card.category)}`,
    summary: card.summary,
    actions: (card.actions || []).join(" "),
    avoid: (card.avoid || []).join(" "),
    askDoctorWhen: (card.askDoctorWhen || []).join(" "),
    redFlags: (card.redFlags || []).join(" "),
    fatherTasks: (card.fatherTasks || []).join(" "),
    sourceIds: (card.sources || []).join(" ")
  };
  return Object.entries(fields)
    .filter(([, value]) => terms.some((term) => String(value || "").toLowerCase().includes(term)))
    .map(([field]) => field);
}

export function searchReviewed(searchParams) {
  const query = String(searchParams.get("query") || searchParams.get("q") || "").trim();
  const domain = String(searchParams.get("domain") || "");
  const stage = String(searchParams.get("stage") || "");
  const category = String(searchParams.get("category") || "");
  const limitValue = Number(searchParams.get("limit") || 10);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 50) : 10;
  const sourcesById = sourceMap();
  const retrievalPlan = buildRetrievalPlan(query, { domain, stage, category });
  let candidates = loadCards("reviewed");

  if (domain) candidates = candidates.filter(({ card }) => card.domain === domain);
  if (stage) candidates = candidates.filter(({ card }) => card.stage === stage);
  if (category) candidates = candidates.filter(({ card }) => card.category === category);

  if (query) {
    candidates = candidates
      .map((entry) => ({ ...entry, ...scoreCard(entry.card, retrievalPlan) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
    if (!domain && retrievalPlan.softDomains.length > 0) {
      const domainMatches = candidates.filter((entry) => retrievalPlan.softDomains.includes(entry.card.domain));
      if (domainMatches.length > 0) candidates = domainMatches;
    }
    if (!stage && retrievalPlan.strictStages.length > 0) {
      const stageMatches = candidates.filter((entry) => retrievalPlan.strictStages.includes(entry.card.stage) || entry.card.stage === "pregnancy-all");
      if (stageMatches.length > 0) candidates = stageMatches;
    } else if (!stage && retrievalPlan.softStages.some((item) => item.startsWith("pregnancy-"))) {
      const pregnancyStageMatches = candidates.filter((entry) => retrievalPlan.softStages.includes(entry.card.stage) || entry.card.stage === "pregnancy-all");
      if (pregnancyStageMatches.length > 0) candidates = pregnancyStageMatches;
    }
  } else {
    candidates = candidates.map((entry) => ({ ...entry, score: 0, matchedTerms: [] }));
  }

  const results = candidates.slice(0, limit).map(({ filePath, card, score, matchedTerms }) => ({
    ...summarizeCard(filePath, card),
    summary: card.summary,
    score,
    matchedTerms,
    matchedFields: query ? matchedFieldsForTerms(card, retrievalPlan.terms) : ["all-reviewed"],
    sourceIds: card.sources || [],
    sources: (card.sources || []).map((sourceId) => sourcesById.get(sourceId) || { id: sourceId, missing: true }),
    card
  }));

  const riskText = `${query}\n${results.map((result) => `${result.title}\n${result.summary}`).join("\n")}`;
  return {
    scope: "cards/reviewed",
    query,
    domain,
    stage,
    category,
    retrievalPlan,
    results,
    message: results.length === 0 ? "当前知识库资料不足" : "",
    safetyNotice: safetyNoticeFor(riskText)
  };
}

function cardAudience(card) {
  if (card.domain === "father-tasks" || card.category?.startsWith("father-")) return "father";
  if (["medical", "mental-health"].includes(card.domain)) return "mother";
  if (card.domain === "shopping") return "joint";
  return "family";
}

function audienceLabel(audience) {
  return {
    mother: "妈妈/孕妇",
    father: "爸爸/伴侣",
    joint: "共同事项",
    family: "家庭"
  }[audience] || "家庭";
}

function audienceSummary(results) {
  const counts = results.reduce((acc, result) => {
    const audience = cardAudience(result.card);
    acc[audience] = (acc[audience] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([audience, count]) => `${audienceLabel(audience)}：${count} 张`)
    .join("；") || "无";
}

function takeItems(items, limit) {
  return Array.isArray(items) ? items.filter(Boolean).slice(0, limit) : [];
}

function formatCardForPrompt(result) {
  const card = result.card;
  const audience = cardAudience(card);
  return [
    `cardId: ${card.id}`,
    `audience: ${audience} (${audienceLabel(audience)})`,
    `title: ${card.title}`,
    `domain: ${card.domain}`,
    `stage: ${card.stage}`,
    `category: ${card.category}`,
    `summary: ${card.summary}`,
    `actions: ${takeItems(card.actions, 4).join("；")}`,
    `avoid: ${takeItems(card.avoid, 3).join("；")}`,
    `askDoctorWhen: ${takeItems(card.askDoctorWhen, 2).join("；")}`,
    `redFlags: ${takeItems(card.redFlags, 4).join("；")}`,
    `fatherTasks: ${takeItems(card.fatherTasks, 4).join("；")}`,
    `sourceIds: ${(card.sources || []).join(", ")}`
  ].join("\n");
}

export function buildAgentPrompt(question, results, retrievalPlan) {
  const context = results.map(formatCardForPrompt).join("\n\n---\n\n");
  return [
    {
      role: "system",
      content: [
        "你是家庭孕育知识库的本地问答助手。",
        "你只能依据用户提供的 reviewed 卡片上下文回答，不得使用模型常识自由扩展医学、心理、用药、疫苗、疾病或婴儿安全结论。",
        "回答必须包含引用：写出使用到的 cardId 和 sourceId。",
        "当用户问“应该干什么、注意什么、怎么安排”且问题属于孕期时，必须按角色分区回答：妈妈/孕妇应该做什么、爸爸/伴侣应该做什么、共同注意事项/何时求助。",
        "只能把 audience=mother 的卡片用于妈妈/孕妇部分，把 audience=father 的卡片用于爸爸/伴侣部分；audience=joint 或 family 只能放到共同事项。",
        "如果某个角色没有 reviewed 卡片支持，要在该角色小节写“当前知识库资料不足”，不能用模型常识补齐。",
        "每个角色小节只保留 2-4 条高优先级动作，避免逐字复述卡片全文。",
        "回答末尾必须用一行列出“引用：cardId -> sourceId”。",
        "如果检索到多个孕期阶段卡片，应按孕早期、孕中期、孕晚期或通用孕期分组总结。",
        "不得诊断，不得替代医生或心理专业人员判断，不得给出具体药物剂量，不得回答“肯定没事”。",
        "如果问题涉及异常、用药、疫苗、发热、黄疸、腹痛、出血、呼吸异常、过敏、自伤、严重绝望、持续失眠、无法照顾自己或宝宝，必须提示咨询医生、及时就医或寻求专业帮助。",
        "如果上下文不足，直接说明“当前知识库资料不足”。",
        "用简洁中文回答。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `用户问题：${question}`,
        `检索规划：${JSON.stringify(retrievalPlan)}`,
        `上下文角色覆盖：${audienceSummary(results)}`,
        `reviewed 卡片上下文：\n${context}`
      ].join("\n\n")
    }
  ];
}

function chunkText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part.text === "string") return part.text;
      return "";
    }).join("");
  }
  return "";
}

function timeoutError(timeoutMs) {
  return new HttpError(
    504,
    `Agent 生成超过 ${Math.round(timeoutMs / 1000)} 秒，已主动停止。请稍后重试，或在 Vercel 环境变量中使用更快的 DEEPSEEK_MODEL / 较低的 DEEPSEEK_REASONING_EFFORT。`
  );
}

function withDeadline(promise, deadlineAt, abortController, timeoutMs) {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) {
    abortController.abort();
    return Promise.reject(timeoutError(timeoutMs));
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(timeoutError(timeoutMs));
    }, remaining);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function nextWithDeadline(iterator, deadlineAt, abortController, timeoutMs) {
  return withDeadline(iterator.next(), deadlineAt, abortController, timeoutMs);
}

export async function streamAgentAnswer({ question, filters = {} }, send) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) throw new HttpError(400, "question is required");

  const searchParams = new URLSearchParams({
    query: cleanQuestion,
    limit: String(filters.limit || 5)
  });
  if (filters.domain) searchParams.set("domain", filters.domain);
  if (filters.stage) searchParams.set("stage", filters.stage);
  if (filters.category) searchParams.set("category", filters.category);

  const search = searchReviewed(searchParams);
  const publicResults = search.results.map(({ card, ...result }) => result);
  const modelConfig = getAgentConfig();
  const publicResultsWithAudience = publicResults.map((result) => ({
    ...result,
    audience: cardAudience(search.results.find((item) => item.id === result.id)?.card || {})
  }));

  send("meta", {
    scope: search.scope,
    query: cleanQuestion,
    retrievalPlan: search.retrievalPlan,
    results: publicResultsWithAudience,
    safetyNotice: search.safetyNotice,
    model: modelConfig.model,
    configured: modelConfig.configured,
    thinking: modelConfig.thinking,
    reasoningEffort: modelConfig.reasoningEffort,
    timeoutMs: modelConfig.timeoutMs
  });

  if (!search.results.length) {
    send("token", { text: "当前知识库资料不足。" });
    return;
  }

  if (!modelConfig.configured) {
    send("error", { error: "未配置 DEEPSEEK_API_KEY，不能调用 DeepSeek 生成回答。" });
    return;
  }

  const { ChatDeepSeek } = await import("@langchain/deepseek");
  const abortController = new AbortController();
  const llm = new ChatDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: modelConfig.model,
    streaming: true,
    maxTokens: 2200,
    reasoningEffort: modelConfig.reasoningEffort,
    ...(modelConfig.thinking ? { modelKwargs: { thinking: { type: "enabled" } } } : {})
  });

  const prompt = buildAgentPrompt(cleanQuestion, search.results, search.retrievalPlan);
  const deadlineAt = Date.now() + modelConfig.timeoutMs;
  const stream = await withDeadline(llm.stream(prompt, { signal: abortController.signal }), deadlineAt, abortController, modelConfig.timeoutMs);
  const iterator = stream[Symbol.asyncIterator]();

  while (true) {
    const { value, done } = await nextWithDeadline(iterator, deadlineAt, abortController, modelConfig.timeoutMs);
    if (done) break;
    const text = chunkText(value.content);
    if (text) send("token", { text });
  }
}
