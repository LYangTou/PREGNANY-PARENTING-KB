import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home">
      <section className="home-panel">
        <p className="eyebrow">家庭孕育知识库</p>
        <h1>本地审核与受限问答</h1>
        <p>
          审核台用于人工检查 draft 卡片并迁移到 reviewed；Agent 只基于 reviewed 卡片回答，并展示 cardId 与 sourceId。
        </p>
        <div className="home-actions">
          <Link className="button primary" href="/review">进入审核台</Link>
          <Link className="button" href="/agent">进入 Agent 对话</Link>
        </div>
      </section>
    </main>
  );
}
