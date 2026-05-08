const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
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
  writeJson,
  writeText
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
const port = Number(process.env.KB_WEB_PORT || 8787);
const distDir = path.join(rootDir, "dist", "web");

function isInside(childPath, parentPath) {
  const rel = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(body);
}

function textResponse(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getRegistryContext() {
  const enums = loadEnums();
  const registry = loadSourceRegistry();
  const sourceResult = validateSourceRegistry(registry, enums);
  const sourcesById = sourceMap(registry);
  return { enums, registry, sourceResult, sourcesById };
}

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
    filePath: path.relative(rootDir, filePath)
  };
}

function sourceCounts(registry) {
  return registry.sources.reduce((acc, source) => {
    acc[source.group] = (acc[source.group] || 0) + 1;
    return acc;
  }, {});
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

function safetyNoticeFor(text) {
  if (!hasSafetyKeyword(text)) return "";
  return "安全提示：涉及异常、用药、疫苗、发热、黄疸、腹痛、出血、呼吸异常、过敏或心理危机时，本知识库不能替代医生或心理专业人员判断；请咨询医生、及时就医或寻求专业帮助。";
}

function reviewCheck(id, options = {}) {
  const entry = findDraftCard(id);
  if (!entry) {
    const error = new Error(`Draft card not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  const resolvedDraftPath = path.resolve(entry.filePath);
  if (!isInside(resolvedDraftPath, draftsDir)) {
    const error = new Error("review only accepts files under cards/drafts");
    error.statusCode = 400;
    throw error;
  }

  const context = getRegistryContext();
  if (context.sourceResult.errors.length > 0) {
    const error = new Error("source registry validation failed");
    error.statusCode = 400;
    error.details = context.sourceResult.errors;
    throw error;
  }

  const draftResult = validateCard(entry.card, resolvedDraftPath, context.sourcesById, context.enums);
  if (draftResult.errors.length > 0) {
    const error = new Error("draft card validation failed");
    error.statusCode = 400;
    error.details = draftResult.errors;
    throw error;
  }

  const draftQuality = scanCardQuality(entry.card, resolvedDraftPath, context.sourcesById);
  if (draftQuality.errors.length > 0) {
    const error = new Error("draft card quality scan failed");
    error.statusCode = 400;
    error.details = draftQuality.errors;
    throw error;
  }

  if (!["draft", "needs-review"].includes(entry.card.reviewStatus)) {
    const error = new Error(`card must be draft or needs-review before review, got ${entry.card.reviewStatus}`);
    error.statusCode = 400;
    throw error;
  }

  const reviewedCard = { ...entry.card, reviewStatus: "reviewed" };
  const destinationDir = path.join(reviewedDir, reviewedCard.domain);
  const destinationJson = path.join(destinationDir, `${reviewedCard.id}.json`);
  const destinationMd = path.join(destinationDir, `${reviewedCard.id}.md`);

  if (!options.force && (fs.existsSync(destinationJson) || fs.existsSync(destinationMd))) {
    const error = new Error(`reviewed card already exists: ${path.relative(rootDir, destinationJson)}`);
    error.statusCode = 409;
    throw error;
  }

  const reviewedResult = validateCard(reviewedCard, destinationJson, context.sourcesById, context.enums);
  if (reviewedResult.errors.length > 0) {
    const error = new Error("reviewed card validation failed");
    error.statusCode = 400;
    error.details = reviewedResult.errors;
    throw error;
  }

  const reviewedQuality = scanCardQuality(reviewedCard, destinationJson, context.sourcesById);
  if (reviewedQuality.errors.length > 0) {
    const error = new Error("reviewed card quality scan failed");
    error.statusCode = 400;
    error.details = reviewedQuality.errors;
    throw error;
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
    const error = new Error("review apply requires a successful dry-run token");
    error.statusCode = 400;
    throw error;
  }
  const stat = fs.statSync(draftPath);
  if (stat.mtimeMs !== approval.mtimeMs) {
    dryRunApprovals.delete(token);
    const error = new Error("draft changed after dry-run; run dry-run again");
    error.statusCode = 409;
    throw error;
  }
}

function applyReview(id, body) {
  const check = reviewCheck(id, { force: Boolean(body.force) });
  if (!body.confirmReview) {
    const error = new Error("review apply requires confirmReview=true");
    error.statusCode = 400;
    throw error;
  }
  assertDryRunToken(id, check.draftPath, body.dryRunToken);

  writeJson(check.destinationJson, check.reviewedCard);
  writeText(check.destinationMd, renderCardMarkdown(check.reviewedCard, check.context.sourcesById));
  fs.unlinkSync(check.draftPath);
  if (fs.existsSync(check.draftMdPath)) fs.unlinkSync(check.draftMdPath);
  dryRunApprovals.delete(body.dryRunToken);

  return {
    reviewedCard: summarizeCard(check.destinationJson, check.reviewedCard),
    destinationJson: path.relative(rootDir, check.destinationJson),
    destinationMd: path.relative(rootDir, check.destinationMd)
  };
}

function handleStatus(_req, res) {
  const { enums, registry } = getRegistryContext();
  const drafts = loadCards("drafts");
  const reviewed = loadCards("reviewed");
  jsonResponse(res, 200, {
    sourceRegistry: "sources/source_registry.json",
    sourceCounts: sourceCounts(registry),
    draftCards: drafts.length,
    reviewedCards: reviewed.length,
    draftJsonFiles: walkJsonFiles(draftsDir).length,
    reviewedJsonFiles: walkJsonFiles(reviewedDir).length,
    enums
  });
}

function handleDrafts(_req, res, url) {
  const params = url.searchParams;
  const drafts = loadCards("drafts")
    .filter(({ card }) => !params.get("domain") || card.domain === params.get("domain"))
    .filter(({ card }) => !params.get("stage") || card.stage === params.get("stage"))
    .filter(({ card }) => !params.get("category") || card.category === params.get("category"))
    .filter(({ card }) => !params.get("reviewStatus") || card.reviewStatus === params.get("reviewStatus"))
    .map(({ filePath, card }) => summarizeCard(filePath, card));
  jsonResponse(res, 200, { scope: "cards/drafts", drafts });
}

function handleDraftDetail(_req, res, id) {
  const entry = findDraftCard(id);
  if (!entry) {
    jsonResponse(res, 404, { error: `Draft card not found: ${id}` });
    return;
  }
  const context = getRegistryContext();
  const validation = getCardValidation(entry.card, entry.filePath, context);
  const quality = scanCardQuality(entry.card, entry.filePath, context.sourcesById);
  const sources = (entry.card.sources || []).map((sourceId) => context.sourcesById.get(sourceId) || { id: sourceId, missing: true });
  jsonResponse(res, 200, {
    scope: "cards/drafts",
    draft: summarizeCard(entry.filePath, entry.card),
    card: entry.card,
    markdown: renderCardMarkdown(entry.card, context.sourcesById),
    sources,
    fieldStatus: fieldStatus(entry.card),
    validation,
    quality,
    safetyNotice: safetyNoticeFor(cardRiskText(entry.card))
  });
}

function handleSearch(_req, res, url) {
  const query = String(url.searchParams.get("query") || url.searchParams.get("q") || "").trim();
  const domain = String(url.searchParams.get("domain") || "");
  const stage = String(url.searchParams.get("stage") || "");
  const limitValue = Number(url.searchParams.get("limit") || 10);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 10;
  const sourcesById = sourceMap();
  let candidates = loadCards("reviewed");

  if (domain) candidates = candidates.filter(({ card }) => card.domain === domain);
  if (stage) candidates = candidates.filter(({ card }) => card.stage === stage);

  if (query) {
    const lowerQuery = query.toLowerCase();
    candidates = candidates
      .map((entry) => ({ ...entry, score: cardSearchText(entry.card).includes(lowerQuery) ? 1 : 0 }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
  }

  const results = candidates.slice(0, limit).map(({ filePath, card }) => ({
    ...summarizeCard(filePath, card),
    summary: card.summary,
    matchedFields: query ? matchedFields(card, query) : ["all-reviewed"],
    sourceIds: card.sources || [],
    sources: (card.sources || []).map((sourceId) => sourcesById.get(sourceId) || { id: sourceId, missing: true })
  }));

  const riskText = `${query}\n${results.map((result) => `${result.title}\n${result.summary}`).join("\n")}`;
  jsonResponse(res, 200, {
    scope: "cards/reviewed",
    query,
    domain,
    stage,
    results,
    message: results.length === 0 ? "当前知识库资料不足" : "",
    safetyNotice: safetyNoticeFor(riskText)
  });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const requestedPath = path.join(distDir, pathname);
  const filePath = isInside(requestedPath, distDir) && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
    ? requestedPath
    : path.join(distDir, "index.html");

  if (!fs.existsSync(filePath)) {
    jsonResponse(res, 404, {
      error: "Web build not found. Run npm run web:build or use npm run web:dev."
    });
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  textResponse(res, 200, fs.readFileSync(filePath), contentTypes[ext] || "application/octet-stream");
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "OPTIONS") {
    jsonResponse(res, 204, {});
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/status") return handleStatus(req, res);
  if (req.method === "GET" && url.pathname === "/api/drafts") return handleDrafts(req, res, url);
  if (req.method === "GET" && url.pathname === "/api/search") return handleSearch(req, res, url);

  const draftMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)$/);
  if (req.method === "GET" && draftMatch) return handleDraftDetail(req, res, decodeURIComponent(draftMatch[1]));

  const dryRunMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/review-dry-run$/);
  if (req.method === "POST" && dryRunMatch) {
    const id = decodeURIComponent(dryRunMatch[1]);
    const check = reviewCheck(id);
    const dryRunToken = createDryRunToken(id, check.draftPath);
    jsonResponse(res, 200, {
      ok: true,
      dryRunToken,
      message: `${id} can be reviewed after human approval`,
      wouldWrite: path.relative(rootDir, check.destinationJson)
    });
    return;
  }

  const applyMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/review-apply$/);
  if (req.method === "POST" && applyMatch) {
    const body = await readBody(req);
    const id = decodeURIComponent(applyMatch[1]);
    jsonResponse(res, 200, {
      ok: true,
      ...applyReview(id, body)
    });
    return;
  }

  if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
    serveStatic(req, res, url);
    return;
  }

  jsonResponse(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    jsonResponse(res, error.statusCode || 500, {
      error: error.message || "Internal server error",
      details: error.details || []
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`KB web API listening on http://127.0.0.1:${port}`);
});
