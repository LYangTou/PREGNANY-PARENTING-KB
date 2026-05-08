"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { badgeText, fieldLabel, labelWithRaw } from "../../lib/labels.js";

const initialFilters = {
  domain: "",
  stage: "",
  category: "",
  limit: "5"
};

function OptionList({ values = [], kind }) {
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

function Badge({ kind, value }) {
  return <span className="badge" title={value}>{badgeText(kind, value)}</span>;
}

function InlineMarkdown({ text }) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function MarkdownRenderer({ content }) {
  const lines = String(content || "").split(/\r?\n/);
  const blocks = [];
  let list = null;

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${blocks.length}`}>
        {list.items.map((item, index) => <li key={index}><InlineMarkdown text={item} /></li>)}
      </Tag>
    );
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const Tag = heading[1].length <= 2 ? "h3" : "h4";
      blocks.push(<Tag key={`heading-${blocks.length}`}><InlineMarkdown text={heading[2]} /></Tag>);
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    flushList();
    blocks.push(<p key={`p-${blocks.length}`}><InlineMarkdown text={line} /></p>);
  }
  flushList();

  return <div className="markdown-answer">{blocks}</div>;
}

async function loadStatus() {
  const response = await fetch("/api/status", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "加载状态失败");
  return payload;
}

function parseSseChunk(buffer, onEvent) {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";
  for (const part of parts) {
    const lines = part.split("\n");
    const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
    const data = lines.filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
    if (!event || !data) continue;
    onEvent(event, JSON.parse(data));
  }
  return rest;
}

function audienceText(value) {
  return {
    mother: "妈妈/孕妇",
    father: "爸爸/伴侣",
    joint: "共同事项",
    family: "家庭"
  }[value] || "家庭";
}

export default function AgentPage() {
  const [status, setStatus] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [retrievalPlan, setRetrievalPlan] = useState(null);
  const [safetyNotice, setSafetyNotice] = useState("");
  const [model, setModel] = useState("deepseek-v4-pro");
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    loadStatus()
      .then((payload) => {
        setStatus(payload);
        setModel(payload.agent?.model || "deepseek-v4-pro");
        setThinking(Boolean(payload.agent?.thinking));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function askAgent(event) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;

    setMessages((items) => [...items, { role: "user", content: cleanQuestion }]);
    setQuestion("");
    setCurrentAnswer("");
    setEvidence([]);
    setRetrievalPlan(null);
    setSafetyNotice("");
    setError("");
    setLoading(true);
    setLoadingLabel("检索中...");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/agent/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, filters }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = await response.json();
        throw new Error(payload.error || "Agent 请求失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let failed = "";

      const onEvent = (eventName, payload) => {
        if (eventName === "meta") {
          setEvidence(payload.results || []);
          setRetrievalPlan(payload.retrievalPlan || null);
          setSafetyNotice(payload.safetyNotice || "");
          setModel(payload.model || model);
          setThinking(Boolean(payload.thinking));
          setLoadingLabel(payload.configured ? "生成中..." : "");
          if (!payload.configured) {
            setError("未配置 DEEPSEEK_API_KEY，检索结果已显示，但不能调用 DeepSeek 生成回答。");
          }
        }
        if (eventName === "token") {
          answer += payload.text || "";
          setCurrentAnswer(answer);
        }
        if (eventName === "error") {
          failed = payload.error || "Agent 请求失败";
          setError(failed);
          setLoadingLabel("");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseChunk(buffer, onEvent);
      }
      if (buffer.trim()) parseSseChunk(`${buffer}\n\n`, onEvent);

      if (answer) {
        setMessages((items) => [...items, { role: "assistant", content: answer }]);
      } else if (failed) {
        setMessages((items) => [...items, { role: "assistant", content: failed }]);
      }
      setCurrentAnswer("");
    } catch (err) {
      if (err.name !== "AbortError") setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setLoadingLabel("");
  }

  function clearChat() {
    stopStream();
    setMessages([]);
    setCurrentAnswer("");
    setEvidence([]);
    setRetrievalPlan(null);
    setSafetyNotice("");
    setError("");
  }

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">cards/reviewed 问答</p>
          <h1>Agent 对话</h1>
          <p>只基于 reviewed 卡片检索和回答；对话记录只保存在当前浏览器内存。</p>
        </div>
        <nav className="tabs" aria-label="主导航">
          <Link href="/review">审核</Link>
          <Link className="active" href="/agent">Agent 对话</Link>
        </nav>
      </header>

      <section className="status-grid" aria-label="Agent 状态">
        <div><strong>{status?.reviewedCards ?? "-"}</strong><span>已审核卡片</span></div>
        <div><strong>{model}</strong><span>DeepSeek 模型</span></div>
        <div><strong>{thinking ? "Thinking" : "普通"}</strong><span>思考模式</span></div>
        <div><strong>{status?.agent?.configured ? "已配置" : "未配置"}</strong><span>DEEPSEEK_API_KEY</span></div>
      </section>

      {error ? <p className="alert warning">{error}</p> : null}

      <main className="agent-grid">
        <section className="chat-panel">
          <form className="chat-form" onSubmit={askAgent}>
            <label>
              问题
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="例如：孕早期应该干什么？"
              />
            </label>
            <div className="toolbar">
              <label>知识域<select value={filters.domain} onChange={(event) => setFilters({ ...filters, domain: event.target.value })}><OptionList kind="domain" values={status?.enums.domains} /></select></label>
              <label>阶段<select value={filters.stage} onChange={(event) => setFilters({ ...filters, stage: event.target.value })}><OptionList kind="stage" values={status?.enums.stages} /></select></label>
              <label>分类<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><OptionList kind="category" values={status?.enums.categories} /></select></label>
              <label>数量<input type="number" min="1" max="10" value={filters.limit} onChange={(event) => setFilters({ ...filters, limit: event.target.value })} /></label>
              <button className="primary" type="submit" disabled={loading || !question.trim()}>发送</button>
              <button type="button" onClick={loading ? stopStream : clearChat}>{loading ? "停止" : "清空"}</button>
            </div>
          </form>

          <p className="scope">回答范围：仅 cards/reviewed/。drafts 和 family-records 不参与检索。</p>
          {loadingLabel ? <p className="loading-state">{loadingLabel}</p> : null}
          {safetyNotice ? <p className="alert warning">{safetyNotice}</p> : null}

          <div className="messages">
            {messages.length || currentAnswer ? null : <p className="empty">输入问题后，Agent 会先检索 reviewed 卡片，再流式生成回答。</p>}
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <strong>{message.role === "user" ? "你" : "Agent"}</strong>
                {message.role === "assistant" ? <MarkdownRenderer content={message.content} /> : <pre>{message.content}</pre>}
              </article>
            ))}
            {currentAnswer ? (
              <article className="message assistant">
                <strong>Agent</strong>
                <div className={loading ? "token-cursor" : ""}>
                  <MarkdownRenderer content={currentAnswer} />
                </div>
              </article>
            ) : null}
          </div>
        </section>

        <aside className="evidence-panel">
          <h2>检索证据</h2>
          <p className="scope">每次提问只展示本次命中的 reviewed 卡片和来源。</p>
          {retrievalPlan ? (
            <div className="retrieval-plan">
              <strong>查询规划</strong>
              <p>{retrievalPlan.reasons?.join("、") || "按原始问题检索"}</p>
              <p className="meta">扩展词：{(retrievalPlan.terms || []).slice(1, 12).join("、")}</p>
            </div>
          ) : null}
          <div className="evidence-list">
            {evidence.length ? evidence.map((item) => (
              <article className="evidence-card" key={item.id}>
                <h3>{item.title || item.id}</h3>
                <p>{item.summary}</p>
                <p className="badge-row">
                  <Badge value={item.id} />
                  <span className="badge">{audienceText(item.audience)}</span>
                  <Badge kind="domain" value={item.domain} />
                  <Badge kind="stage" value={item.stage} />
                  <Badge kind="category" value={item.category} />
                </p>
                <p className="meta">匹配字段：{(item.matchedFields || []).map(fieldLabel).join("、") || "全部已审核卡片"}</p>
                <p className="meta">sourceId：{(item.sourceIds || []).join("、")}</p>
                <div className="source-list">
                  {(item.sources || []).map((source) => (
                    <div className="source" key={source.id}>
                      <strong>{source.id}</strong>
                      <span>{source.title || "未登记来源"} · {source.organization || ""}</span>
                    </div>
                  ))}
                </div>
              </article>
            )) : <p className="empty">暂无检索结果。</p>}
          </div>
        </aside>
      </main>
    </div>
  );
}
