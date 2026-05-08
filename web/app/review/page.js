"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { badgeText, fieldLabel, labelWithRaw } from "../../lib/labels.js";

const initialFilters = {
  domain: "",
  stage: "",
  category: "",
  reviewStatus: ""
};

async function api(path, init) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`API ${response.status}: expected JSON, got ${text.slice(0, 80)}`);
  }
  if (!response.ok) {
    const details = Array.isArray(payload.details) && payload.details.length ? `\n${payload.details.join("\n")}` : "";
    throw new Error(`${payload.error || "请求失败"}${details}`);
  }
  return payload;
}

function OptionList({ values = [], value, kind }) {
  return (
    <>
      <option value="">全部</option>
      {values.map((item) => (
        <option key={item} value={item}>
          {labelWithRaw(kind, item)}
        </option>
      ))}
    </>
  );
}

function Badge({ kind, value, tone = "" }) {
  return <span className={`badge ${tone}`} title={value}>{badgeText(kind, value)}</span>;
}

export default function ReviewPage() {
  const [status, setStatus] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState("markdown");
  const [dryRun, setDryRun] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  async function loadStatus() {
    setStatus(await api("/api/status"));
  }

  async function loadDrafts() {
    const response = await api(`/api/drafts${queryString ? `?${queryString}` : ""}`);
    setDrafts(response.drafts);
    if (selectedId && !response.drafts.some((draft) => draft.id === selectedId)) {
      setSelectedId("");
      setDetail(null);
      setDryRun(null);
    }
  }

  async function selectDraft(id) {
    setSelectedId(id);
    setDetail(null);
    setDryRun(null);
    setMessage("");
    setError("");
    setDetail(await api(`/api/drafts/${encodeURIComponent(id)}`));
  }

  async function runDryRun() {
    if (!selectedId) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await api(`/api/drafts/${encodeURIComponent(selectedId)}/review-dry-run`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setDryRun({
        token: response.dryRunToken,
        wouldWrite: response.wouldWrite
      });
      setMessage(`Dry-run 通过，将写入 ${response.wouldWrite}`);
    } catch (err) {
      setDryRun(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function applyReview() {
    if (!selectedId || !dryRun) return;
    const confirmed = window.confirm(`确认通过审核并迁移到 reviewed？\n\n将写入：${dryRun.wouldWrite}\n原 draft JSON/MD 会被移除。`);
    if (!confirmed) return;
    setLoading(true);
    setError("");
    try {
      const response = await api(`/api/drafts/${encodeURIComponent(selectedId)}/review-apply`, {
        method: "POST",
        body: JSON.stringify({
          confirmReview: true,
          dryRunToken: dryRun.token
        })
      });
      setMessage(`审核通过：${response.destinationJson}`);
      setSelectedId("");
      setDetail(null);
      setDryRun(null);
      await Promise.all([loadStatus(), loadDrafts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadDrafts().catch((err) => setError(err.message));
  }, [queryString]);

  const sourceTotal = status ? Object.values(status.sourceCounts).reduce((sum, value) => sum + value, 0) : 0;
  const qualityErrors = detail?.quality?.errors || [];
  const qualityWarnings = detail?.quality?.warnings || [];
  const hasErrors = Boolean(detail && (detail.validation.errors.length || qualityErrors.length));
  const canApply = Boolean(dryRun?.token) && !hasErrors && !loading;

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">cards/drafts 审核</p>
          <h1>知识库审核台</h1>
          <p>只在人工确认后把 draft 迁移到 reviewed；问答不会使用 draft。</p>
        </div>
        <nav className="tabs" aria-label="主导航">
          <Link className="active" href="/review">审核</Link>
          <Link href="/agent">Agent 对话</Link>
        </nav>
      </header>

      <section className="status-grid" aria-label="项目状态">
        <div><strong>{sourceTotal}</strong><span>已登记来源</span></div>
        <div><strong>{status?.draftCards ?? "-"}</strong><span>草稿卡片</span></div>
        <div><strong>{status?.reviewedCards ?? "-"}</strong><span>已审核卡片</span></div>
        <div><strong>{status?.reviewedJsonFiles ?? "-"}</strong><span>reviewed JSON</span></div>
      </section>

      {error ? <pre className="alert error">{error}</pre> : null}
      {message ? <p className="alert ok">{message}</p> : null}

      <main className="workbench">
        <aside className="sidebar">
          <div className="toolbar compact">
            <label>知识域<select value={filters.domain} onChange={(event) => setFilters({ ...filters, domain: event.target.value })}><OptionList kind="domain" values={status?.enums.domains} /></select></label>
            <label>阶段<select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}><OptionList kind="stage" values={status?.enums.stages} /></select></label>
            <label>分类<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><OptionList kind="category" values={status?.enums.categories} /></select></label>
            <label>审核状态<select value={filters.reviewStatus} onChange={(event) => setFilters({ ...filters, reviewStatus: event.target.value })}><OptionList kind="reviewStatus" values={status?.enums.reviewStatuses} /></select></label>
          </div>
          <div className="list" aria-label="Draft 卡片列表">
            {drafts.length ? drafts.map((draft) => (
              <button key={draft.id} className={`list-item ${draft.id === selectedId ? "selected" : ""}`} onClick={() => selectDraft(draft.id)}>
                <span className="item-title">{draft.title || draft.id}</span>
                <span className="item-meta">{badgeText("domain", draft.domain)} / {badgeText("stage", draft.stage)}</span>
                <span className="item-meta">{badgeText("category", draft.category)} · {badgeText("reviewStatus", draft.reviewStatus)}</span>
              </button>
            )) : <p className="empty">没有匹配的 draft 卡片。</p>}
          </div>
        </aside>

        <section className="detail">
          {!selectedId ? <p className="empty">选择一张 draft 卡片开始审核。</p> : null}
          {selectedId && !detail ? <p className="empty">正在加载卡片详情...</p> : null}
          {detail ? (
            <>
              <div className="detail-head">
                <div>
                  <h2>{detail.draft.title || detail.draft.id}</h2>
                  <p className="badge-row">
                    <Badge kind="domain" value={detail.draft.domain} />
                    <Badge kind="stage" value={detail.draft.stage} />
                    <Badge kind="category" value={detail.draft.category} />
                    <Badge kind="reviewStatus" value={detail.draft.reviewStatus} tone="status" />
                  </p>
                </div>
                <div className="actions">
                  <button onClick={runDryRun} disabled={loading}>Dry-run</button>
                  <button className="primary" onClick={applyReview} disabled={!canApply}>通过审核</button>
                </div>
              </div>

              {detail.safetyNotice ? <p className="alert warning">{detail.safetyNotice}</p> : null}

              <section className="checks">
                <div>
                  <h3>校验结果</h3>
                  {!hasErrors ? <p className="check ok">没有阻塞性错误</p> : null}
                  {detail.validation.errors.map((item) => <p className="check error" key={item}>ERROR {item}</p>)}
                  {detail.validation.warnings.map((item) => <p className="check warning" key={item}>WARN {item}</p>)}
                  {qualityErrors.map((item) => <p className="check error" key={item}>QUALITY ERROR {item}</p>)}
                  {qualityWarnings.map((item) => <p className="check warning" key={item}>QUALITY WARN {item}</p>)}
                </div>
                <div>
                  <h3>字段完整性</h3>
                  <div className="field-grid">
                    {detail.fieldStatus.map((field) => (
                      <span key={field.field} className={field.present && field.filled ? "ok" : "warning"} title={field.field}>
                        {fieldLabel(field.field)}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section>
                <h3>来源</h3>
                <div className="source-list">
                  {detail.sources.map((source) => (
                    <div className={`source ${source.missing ? "missing" : ""}`} key={source.id}>
                      <strong>{source.id}</strong>
                      <span>{source.missing ? "未登记来源" : `${source.title || ""} · ${source.organization || ""}`}</span>
                      {!source.missing ? <span>{badgeText("evidenceLevel", source.evidenceLevel)} · {badgeText("domain", source.domain)}</span> : null}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="segmented">
                  <button className={detailTab === "markdown" ? "active" : ""} onClick={() => setDetailTab("markdown")}>Markdown</button>
                  <button className={detailTab === "json" ? "active" : ""} onClick={() => setDetailTab("json")}>JSON</button>
                </div>
                <pre className="preview">{detailTab === "markdown" ? detail.markdown : JSON.stringify(detail.card, null, 2)}</pre>
              </section>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
