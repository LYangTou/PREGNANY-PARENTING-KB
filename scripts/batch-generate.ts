const fs = require("fs");
const path = require("path");
const {
  draftsDir,
  firstTextLines,
  loadEnums,
  loadSourceRegistry,
  normalizeText,
  parseArgs,
  readSourceCache,
  renderCardMarkdown,
  sourceMap,
  toKebabCase,
  validateCard,
  writeJson,
  writeText
} = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const targetSourceId = args.source ? String(args.source) : "";
const targetDomain = args.domain ? String(args.domain) : "";
const generationLimit = Number(args.limit || 0);
const force = Boolean(args.force);
const allowedDomains = new Set(["medical", "early-education", "mental-health", "shopping", "father-tasks"]);
const registry = loadSourceRegistry();
const enums = loadEnums();
const sourcesById = sourceMap(registry);
const today = new Date().toISOString().slice(0, 10);

let sources = registry.sources.filter((source) => source.status !== "deprecated" && allowedDomains.has(source.domain));
if (targetSourceId) sources = sources.filter((source) => source.id === targetSourceId);
if (targetDomain) sources = sources.filter((source) => source.domain === targetDomain);

if (sources.length === 0) {
  console.error("ERROR no matching registered sources found for batch generation");
  process.exit(1);
}

function stageForDomain(domain, source) {
  if (domain === "shopping") return "newborn";
  if (domain === "early-education" && /prenatal|unborn|fetal|bonding|hearing/.test(source.id)) return "pregnancy-all";
  if (domain === "early-education") return "toddler-1-3y";
  if (domain === "father-tasks") return "pregnancy-all";
  if (domain === "mental-health") return "postpartum";
  return "pregnancy-all";
}

function categoryForDomain(domain, source) {
  if (domain === "shopping") return "shopping-list";
  if (domain === "early-education" && /reading|singing|hearing/.test(source.id)) return "language-reading";
  if (domain === "early-education" && /bonding/.test(source.id)) return "family-support";
  if (domain === "early-education") return "early-education";
  if (domain === "father-tasks") return "father-prenatal";
  if (domain === "mental-health") return "emotion-support";
  return "prenatal-checkup";
}

function shoppingTypeForDomain(domain) {
  return domain === "shopping" ? "optional" : "not-applicable";
}

function sourceEvidenceLevel(source) {
  return source.evidenceLevel || "source-backed-draft";
}

function pickedText(cache) {
  const lines = firstTextLines(cache && cache.text, 4);
  if (lines.length > 0) return lines;
  return [];
}

function draftFromSource(source) {
  const cache = readSourceCache(source.id);
  if (!cache || !["ok", "empty"].includes(cache.status)) {
    return {
      skipped: true,
      reason: cache ? `cache status is ${cache.status}` : "missing source cache"
    };
  }

  const headings = Array.isArray(cache.headings) ? cache.headings.slice(0, 4) : [];
  const textLines = pickedText(cache);
  const useFor = Array.isArray(source.useFor) ? source.useFor.slice(0, 4) : [];
  const id = toKebabCase(`${source.domain}-${source.id}`, source.id);
  const title = `待审核来源草稿：${source.title}`;
  const sourceHints = [...useFor, ...headings, ...textLines].filter(Boolean).slice(0, 6);
  const hintText = sourceHints.length ? sourceHints.join("；") : "请人工对照来源正文补充具体内容。";

  const commonAvoid = [
    "不要把本草稿直接作为 reviewed 内容；必须人工对照来源正文后再审核。",
    "不要补写来源中没有明确支持的医学、心理、用药、疫苗、婴儿安全或商品结论。",
    "不要给出诊断、具体药物剂量、疫苗决策或品牌推荐。"
  ];

  const commonAskDoctor = [
    "涉及异常症状、用药、疫苗、发热、黄疸、腹痛、出血、呼吸异常、过敏或心理危机时，应咨询医生、及时就医或寻求专业帮助。"
  ];

  const card = {
    id,
    title,
    domain: source.domain,
    stage: stageForDomain(source.domain, source),
    category: categoryForDomain(source.domain, source),
    summary: `待人工核对：本草稿由已登记来源 ${source.id} 的来源用途和缓存正文提取线索生成。可优先核对这些线索：${hintText}`,
    actions: [
      `人工打开来源 ${source.id}，核对标题、发布日期、适用人群和本卡主题是否一致。`,
      `围绕来源用途整理可执行要点：${useFor.length ? useFor.join("；") : "请从来源正文中选择明确支持的要点。"}`,
      "审核时只保留来源明确支持的内容，并把不确定内容删去或改为待补来源。"
    ],
    avoid: commonAvoid,
    askDoctorWhen: commonAskDoctor,
    redFlags: [],
    shoppingType: shoppingTypeForDomain(source.domain),
    fatherTasks: source.domain === "father-tasks"
      ? [
          "把来源中可执行的家庭分工整理成具体任务，并标注需要联系医生、助产士或专业人员的升级条件。",
          "审核时删除空泛表述，保留能在当天执行或检查的动作。"
        ]
      : [],
    sources: [source.id],
    evidenceLevel: sourceEvidenceLevel(source),
    reviewStatus: "needs-review",
    updatedAt: today
  };

  return { skipped: false, card };
}

let created = 0;
let skipped = 0;

for (const source of sources) {
  if (Number.isFinite(generationLimit) && generationLimit > 0 && created >= generationLimit) break;

  const result = draftFromSource(source);
  if (result.skipped) {
    skipped += 1;
    console.warn(`SKIP ${source.id}: ${result.reason}`);
    continue;
  }

  const card = result.card;
  const destinationDir = path.join(draftsDir, card.domain);
  const destinationJson = path.join(destinationDir, `${card.id}.json`);
  const destinationMd = path.join(destinationDir, `${card.id}.md`);

  if (!force && fs.existsSync(destinationJson)) {
    skipped += 1;
    console.warn(`SKIP existing ${path.relative(process.cwd(), destinationJson)}`);
    continue;
  }

  const validation = validateCard(card, destinationJson, sourcesById, enums);
  if (validation.errors.length > 0) {
    console.error(`ERROR generated card failed validation for ${source.id}`);
    for (const error of validation.errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }

  writeJson(destinationJson, card);
  writeText(destinationMd, renderCardMarkdown(card, sourcesById));
  created += 1;
  console.log(`WROTE ${path.relative(process.cwd(), destinationJson)}`);
}

console.log(`OK batch-generate completed: created=${created}, skipped=${skipped}`);
