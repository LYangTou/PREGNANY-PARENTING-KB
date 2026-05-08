const fs = require("fs");
const {
  contentHash,
  extractHeadingsFromHtml,
  extractHtmlText,
  extractHtmlTitle,
  isHttpSource,
  loadSourceRegistry,
  normalizeText,
  parseArgs,
  sourceCachePaths,
  writeJson,
  writeText
} = require("./lib/kb");

const args = parseArgs(process.argv.slice(2));
const targetSourceId = args.source ? String(args.source) : "";
const targetDomain = args.domain ? String(args.domain) : "";
const force = Boolean(args.force);
const registry = loadSourceRegistry();

let sources = registry.sources.filter((source) => source.status !== "deprecated");
if (targetSourceId) sources = sources.filter((source) => source.id === targetSourceId);
if (targetDomain) sources = sources.filter((source) => source.domain === targetDomain || source.group === targetDomain);

if (sources.length === 0) {
  console.error("ERROR no matching sources found");
  process.exit(1);
}

async function fetchSource(source) {
  const { jsonPath, textPath } = sourceCachePaths(source.id);
  if (!force && fs.existsSync(jsonPath) && fs.existsSync(textPath)) {
    console.log(`SKIP cached ${source.id}`);
    return { sourceId: source.id, status: "cached" };
  }

  if (!isHttpSource(source)) {
    const cache = {
      sourceId: source.id,
      url: source.url,
      fetchedAt: new Date().toISOString(),
      contentHash: "",
      title: source.title,
      text: "",
      headings: [],
      status: "skipped-local",
      error: "local sources are not fetched by extract-sources"
    };
    writeJson(jsonPath, cache);
    writeText(textPath, "");
    console.log(`SKIP local ${source.id}`);
    return { sourceId: source.id, status: "skipped-local" };
  }

  try {
    const response = await fetch(source.url, {
      headers: {
        "user-agent": "pregnancy-parenting-kb/0.1 source extractor"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const html = await response.text();
    const title = extractHtmlTitle(html) || source.title;
    const text = extractHtmlText(html);
    const headings = extractHeadingsFromHtml(html);
    const normalizedText = normalizeText(text);
    const cache = {
      sourceId: source.id,
      url: source.url,
      fetchedAt: new Date().toISOString(),
      contentHash: contentHash(normalizedText),
      title,
      text: normalizedText,
      headings,
      status: normalizedText ? "ok" : "empty",
      error: normalizedText ? "" : "no readable text extracted"
    };
    writeJson(jsonPath, cache);
    writeText(textPath, normalizedText);
    console.log(`${cache.status === "ok" ? "OK" : "WARN"} extracted ${source.id}: ${normalizedText.length} chars`);
    return { sourceId: source.id, status: cache.status };
  } catch (error) {
    const cache = {
      sourceId: source.id,
      url: source.url,
      fetchedAt: new Date().toISOString(),
      contentHash: "",
      title: source.title,
      text: "",
      headings: [],
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    };
    writeJson(jsonPath, cache);
    writeText(textPath, "");
    console.error(`ERROR extract failed ${source.id}: ${cache.error}`);
    return { sourceId: source.id, status: "error" };
  }
}

(async () => {
  const results = [];
  for (const source of sources) {
    results.push(await fetchSource(source));
  }
  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`OK extract-sources completed: ${results.length} source(s), ${JSON.stringify(counts)}`);
})();
