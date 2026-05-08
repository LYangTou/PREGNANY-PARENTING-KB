import "./styles.css";

type CardSummary = {
  id: string;
  title: string;
  domain: string;
  stage: string;
  category: string;
  reviewStatus: string;
  evidenceLevel: string;
  updatedAt: string;
  filePath: string;
  summary?: string;
  matchedFields?: string[];
  sourceIds?: string[];
  sources?: Source[];
};

type Source = {
  id: string;
  title?: string;
  organization?: string;
  domain?: string;
  evidenceLevel?: string;
  url?: string;
  missing?: boolean;
};

type StatusResponse = {
  sourceCounts: Record<string, number>;
  draftCards: number;
  reviewedCards: number;
  draftJsonFiles: number;
  reviewedJsonFiles: number;
  enums: {
    domains: string[];
    stages: string[];
    categories: string[];
    reviewStatuses: string[];
  };
};

type DraftDetail = {
  draft: CardSummary;
  card: Record<string, unknown>;
  markdown: string;
  sources: Source[];
  fieldStatus: { field: string; present: boolean; filled: boolean }[];
  validation: { errors: string[]; warnings: string[] };
  quality?: { errors: string[]; warnings: string[] };
  safetyNotice: string;
};

type SearchResponse = {
  scope: string;
  results: CardSummary[];
  message: string;
  safetyNotice: string;
};

const app = document.querySelector<HTMLDivElement>("#app")!;

const state = {
  view: "review" as "review" | "search",
  status: null as StatusResponse | null,
  drafts: [] as CardSummary[],
  selectedDraftId: "",
  detail: null as DraftDetail | null,
  draftFilters: {
    domain: "",
    stage: "",
    category: "",
    reviewStatus: ""
  },
  detailTab: "markdown" as "markdown" | "json",
  dryRun: null as null | { token: string; message: string; wouldWrite: string },
  actionMessage: "",
  actionError: "",
  search: {
    query: "",
    domain: "",
    stage: "",
    limit: "10",
    response: null as SearchResponse | null
  },
  loading: false
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    const details = Array.isArray(payload.details) && payload.details.length ? `\n${payload.details.join("\n")}` : "";
    throw new Error(`${payload.error || "请求失败"}${details}`);
  }
  return payload as T;
}

function optionList(values: string[] = [], current = ""): string {
  return `<option value="">全部</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
}

function badge(value: string, tone = ""): string {
  return `<span class="badge ${tone}">${escapeHtml(value)}</span>`;
}

function renderShell() {
  app.innerHTML = `
    <header class="topbar">
      <div>
        <h1>家庭孕育知识库审核台</h1>
        <p>本地审核 draft，查询范围固定为 cards/reviewed/。</p>
      </div>
      <nav class="tabs" aria-label="主视图">
        <button class="${state.view === "review" ? "active" : ""}" data-view="review">审核</button>
        <button class="${state.view === "search" ? "active" : ""}" data-view="search">查询</button>
      </nav>
    </header>
    ${renderStatus()}
    <main>${state.view === "review" ? renderReviewView() : renderSearchView()}</main>
  `;
  bindShellEvents();
}

function renderStatus(): string {
  if (!state.status) return `<section class="status-line">正在加载项目状态...</section>`;
  const sourceTotal = Object.values(state.status.sourceCounts).reduce((sum, value) => sum + value, 0);
  return `
    <section class="status-grid" aria-label="项目状态">
      <div><strong>${sourceTotal}</strong><span>已登记来源</span></div>
      <div><strong>${state.status.draftCards}</strong><span>Draft 卡片</span></div>
      <div><strong>${state.status.reviewedCards}</strong><span>Reviewed 卡片</span></div>
      <div><strong>${state.status.reviewedJsonFiles}</strong><span>Reviewed JSON</span></div>
    </section>
  `;
}

function renderReviewView(): string {
  return `
    <section class="workbench">
      <aside class="sidebar">
        <div class="toolbar compact">
          <label>Domain<select data-filter="domain">${optionList(state.status?.enums.domains, state.draftFilters.domain)}</select></label>
          <label>Stage<select data-filter="stage">${optionList(state.status?.enums.stages, state.draftFilters.stage)}</select></label>
          <label>Category<select data-filter="category">${optionList(state.status?.enums.categories, state.draftFilters.category)}</select></label>
          <label>Status<select data-filter="reviewStatus">${optionList(state.status?.enums.reviewStatuses, state.draftFilters.reviewStatus)}</select></label>
        </div>
        <div class="list" aria-label="Draft 卡片列表">
          ${state.drafts.length ? state.drafts.map(renderDraftListItem).join("") : `<p class="empty">没有匹配的 draft 卡片。</p>`}
        </div>
      </aside>
      <section class="detail">${renderDraftDetail()}</section>
    </section>
  `;
}

function renderDraftListItem(card: CardSummary): string {
  const selected = card.id === state.selectedDraftId ? "selected" : "";
  return `
    <button class="list-item ${selected}" data-draft-id="${escapeHtml(card.id)}">
      <span class="item-title">${escapeHtml(card.title || card.id)}</span>
      <span class="item-meta">${escapeHtml(card.domain)} / ${escapeHtml(card.stage)}</span>
      <span class="item-meta">${escapeHtml(card.category)} · ${escapeHtml(card.reviewStatus)}</span>
    </button>
  `;
}

function renderDraftDetail(): string {
  if (!state.selectedDraftId) return `<p class="empty">选择一张 draft 卡片开始审核。</p>`;
  if (!state.detail) return `<p class="empty">正在加载卡片详情...</p>`;
  const detail = state.detail;
  const qualityErrors = detail.quality?.errors || [];
  const qualityWarnings = detail.quality?.warnings || [];
  const hasErrors = detail.validation.errors.length > 0 || qualityErrors.length > 0;
  const canApply = Boolean(state.dryRun?.token) && !hasErrors;
  return `
    <div class="detail-head">
      <div>
        <h2>${escapeHtml(detail.draft.title || detail.draft.id)}</h2>
        <p>${badge(detail.draft.domain)} ${badge(detail.draft.stage)} ${badge(detail.draft.category)} ${badge(detail.draft.reviewStatus, "status")}</p>
      </div>
      <div class="actions">
        <button data-action="dry-run" ${state.loading ? "disabled" : ""}>Dry-run</button>
        <button class="primary" data-action="apply" ${canApply && !state.loading ? "" : "disabled"}>通过审核</button>
      </div>
    </div>
    ${state.actionError ? `<pre class="alert error">${escapeHtml(state.actionError)}</pre>` : ""}
    ${state.actionMessage ? `<p class="alert ok">${escapeHtml(state.actionMessage)}</p>` : ""}
    ${detail.safetyNotice ? `<p class="alert warning">${escapeHtml(detail.safetyNotice)}</p>` : ""}
    <section class="checks">
      <div>
        <h3>校验结果</h3>
        ${hasErrors ? detail.validation.errors.map((error) => `<p class="check error">ERROR ${escapeHtml(error)}</p>`).join("") : `<p class="check ok">没有阻塞性错误</p>`}
        ${detail.validation.warnings.map((warning) => `<p class="check warning">WARN ${escapeHtml(warning)}</p>`).join("")}
        ${qualityErrors.map((error) => `<p class="check error">QUALITY ERROR ${escapeHtml(error)}</p>`).join("")}
        ${qualityWarnings.map((warning) => `<p class="check warning">QUALITY WARN ${escapeHtml(warning)}</p>`).join("")}
      </div>
      <div>
        <h3>字段完整性</h3>
        <div class="field-grid">${detail.fieldStatus.map((field) => `<span class="${field.present && field.filled ? "ok" : "warning"}">${escapeHtml(field.field)}</span>`).join("")}</div>
      </div>
    </section>
    <section>
      <h3>来源</h3>
      <div class="source-list">${detail.sources.map(renderSource).join("")}</div>
    </section>
    <section>
      <div class="segmented">
        <button class="${state.detailTab === "markdown" ? "active" : ""}" data-tab="markdown">Markdown</button>
        <button class="${state.detailTab === "json" ? "active" : ""}" data-tab="json">JSON</button>
      </div>
      <pre class="preview">${escapeHtml(state.detailTab === "markdown" ? detail.markdown : JSON.stringify(detail.card, null, 2))}</pre>
    </section>
  `;
}

function renderSource(source: Source): string {
  if (source.missing) return `<div class="source missing"><strong>${escapeHtml(source.id)}</strong><span>未登记来源</span></div>`;
  return `
    <div class="source">
      <strong>${escapeHtml(source.id)}</strong>
      <span>${escapeHtml(source.title)} · ${escapeHtml(source.organization)}</span>
      <span>${escapeHtml(source.evidenceLevel)} · ${escapeHtml(source.domain)}</span>
    </div>
  `;
}

function renderSearchView(): string {
  const response = state.search.response;
  return `
    <section class="search-panel">
      <div class="toolbar">
        <label>关键词<input data-search="query" value="${escapeHtml(state.search.query)}" placeholder="例如：安全睡眠" /></label>
        <label>Domain<select data-search="domain">${optionList(state.status?.enums.domains, state.search.domain)}</select></label>
        <label>Stage<select data-search="stage">${optionList(state.status?.enums.stages, state.search.stage)}</select></label>
        <label>Limit<input data-search="limit" type="number" min="1" max="50" value="${escapeHtml(state.search.limit)}" /></label>
        <button class="primary" data-action="search">查询 reviewed</button>
      </div>
      <p class="scope">Search scope: cards/reviewed/。drafts 不作为问答依据。</p>
      ${response?.safetyNotice ? `<p class="alert warning">${escapeHtml(response.safetyNotice)}</p>` : ""}
      ${response ? renderSearchResults(response) : `<p class="empty">输入关键词或直接查询全部 reviewed 卡片。</p>`}
    </section>
  `;
}

function renderSearchResults(response: SearchResponse): string {
  if (!response.results.length) return `<p class="empty">${escapeHtml(response.message || "当前知识库资料不足")}</p>`;
  return `
    <div class="results">
      ${response.results.map((result) => `
        <article class="result">
          <h2>${escapeHtml(result.title || result.id)}</h2>
          <p>${escapeHtml(result.summary)}</p>
          <p>${badge(result.id)} ${badge(result.domain)} ${badge(result.stage)} ${badge(result.category)}</p>
          <p class="meta">matchedFields=${escapeHtml((result.matchedFields || []).join(","))}</p>
          <p class="meta">sourceIds=${escapeHtml((result.sourceIds || []).join(","))}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function bindShellEvents() {
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view as "review" | "search";
      renderShell();
    });
  });

  document.querySelectorAll<HTMLSelectElement>("[data-filter]").forEach((select) => {
    select.addEventListener("change", async () => {
      state.draftFilters[select.dataset.filter as keyof typeof state.draftFilters] = select.value;
      await loadDrafts();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-draft-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await selectDraft(button.dataset.draftId || "");
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.detailTab = button.dataset.tab as "markdown" | "json";
      renderShell();
    });
  });

  document.querySelector<HTMLButtonElement>("[data-action='dry-run']")?.addEventListener("click", runDryRun);
  document.querySelector<HTMLButtonElement>("[data-action='apply']")?.addEventListener("click", applyReview);

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-search]").forEach((input) => {
    input.addEventListener("input", () => {
      state.search[input.dataset.search as keyof typeof state.search] = input.value as never;
    });
  });
  document.querySelector<HTMLButtonElement>("[data-action='search']")?.addEventListener("click", runSearch);
}

async function loadStatus() {
  state.status = await api<StatusResponse>("/api/status");
}

async function loadDrafts() {
  const params = new URLSearchParams();
  Object.entries(state.draftFilters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const response = await api<{ drafts: CardSummary[] }>(`/api/drafts?${params.toString()}`);
  state.drafts = response.drafts;
  if (state.selectedDraftId && !state.drafts.some((draft) => draft.id === state.selectedDraftId)) {
    state.selectedDraftId = "";
    state.detail = null;
    state.dryRun = null;
  }
  renderShell();
}

async function selectDraft(id: string) {
  state.selectedDraftId = id;
  state.detail = null;
  state.dryRun = null;
  state.actionMessage = "";
  state.actionError = "";
  renderShell();
  state.detail = await api<DraftDetail>(`/api/drafts/${encodeURIComponent(id)}`);
  renderShell();
}

async function runDryRun() {
  if (!state.selectedDraftId) return;
  state.loading = true;
  state.actionError = "";
  state.actionMessage = "";
  renderShell();
  try {
    const response = await api<{ dryRunToken: string; message: string; wouldWrite: string }>(`/api/drafts/${encodeURIComponent(state.selectedDraftId)}/review-dry-run`, {
      method: "POST",
      body: JSON.stringify({})
    });
    state.dryRun = {
      token: response.dryRunToken,
      message: response.message,
      wouldWrite: response.wouldWrite
    };
    state.actionMessage = `Dry-run 通过，将写入 ${response.wouldWrite}`;
  } catch (error) {
    state.dryRun = null;
    state.actionError = error instanceof Error ? error.message : String(error);
  } finally {
    state.loading = false;
    renderShell();
  }
}

async function applyReview() {
  if (!state.selectedDraftId || !state.dryRun) return;
  const confirmed = window.confirm(`确认通过审核并迁移到 reviewed？\n\n将写入：${state.dryRun.wouldWrite}\n原 draft JSON/MD 会被移除。`);
  if (!confirmed) return;
  state.loading = true;
  state.actionError = "";
  renderShell();
  try {
    const response = await api<{ destinationJson: string }>(`/api/drafts/${encodeURIComponent(state.selectedDraftId)}/review-apply`, {
      method: "POST",
      body: JSON.stringify({
        confirmReview: true,
        dryRunToken: state.dryRun.token
      })
    });
    state.actionMessage = `审核通过：${response.destinationJson}`;
    state.selectedDraftId = "";
    state.detail = null;
    state.dryRun = null;
    await Promise.all([loadStatus(), loadDrafts()]);
  } catch (error) {
    state.actionError = error instanceof Error ? error.message : String(error);
  } finally {
    state.loading = false;
    renderShell();
  }
}

async function runSearch() {
  const params = new URLSearchParams();
  if (state.search.query.trim()) params.set("query", state.search.query.trim());
  if (state.search.domain) params.set("domain", state.search.domain);
  if (state.search.stage) params.set("stage", state.search.stage);
  if (state.search.limit) params.set("limit", state.search.limit);
  state.search.response = await api<SearchResponse>(`/api/search?${params.toString()}`);
  renderShell();
}

async function init() {
  try {
    await loadStatus();
    await loadDrafts();
  } catch (error) {
    app.innerHTML = `<pre class="fatal">${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>`;
  }
}

init();
