# 家庭孕育知识库

本项目用于本地整理家庭孕育知识卡片，覆盖孕产医学保健、0-3 岁育儿、幼儿教育与亲子互动、妈妈情绪支持、爸爸/丈夫任务、母婴用品避坑和家庭记录归档。

## 基本规则

- 来源登记唯一入口是 `sources/source_registry.json`。
- 新内容先进入 `cards/drafts/`。
- `cards/reviewed/` 只能保存人工审核通过的卡片。
- 搜索和问答只读取 `cards/reviewed/`，不得把 draft 作为问答依据。
- 默认不读取 `family-records/`，不把家庭记录用于诊断或公开输出。
- 医学、心理、疫苗、用药、疾病和婴儿安全相关内容不得替代医生或心理专业人员判断。

## 常用命令

```bash
npm run kb -- status
npm run kb -- prepare
npm run kb -- review <card-id-or-draft-json-path>
npm run kb -- review <card-id-or-draft-json-path> --apply
npm run kb -- search --query "安全睡眠"

npm run validate:sources
npm run validate:cards
npm run generate:md
npm run search -- --query "安全睡眠"
npm run review:card -- <card-id-or-draft-json-path> --dry-run
npm run review:card -- <card-id-or-draft-json-path>
```

## 本地 Web 应用

Web UI 使用 Next.js，仅作为本地应用运行：

```bash
npm run web:dev
```

默认地址：`http://127.0.0.1:8790`。

- `/review`：知识库审核台，浏览 draft、查看校验结果、执行 dry-run，并在人工确认后迁移到 reviewed。
- `/agent`：Agent 对话页，只基于 `cards/reviewed/` 检索和回答，展示 cardId/sourceId 引用。
- Agent 使用 DeepSeek API，需要配置 `DEEPSEEK_API_KEY`。默认模型为 `deepseek-v4-flash`，可通过 `DEEPSEEK_MODEL` 覆盖。
- Agent 对话历史只保存在浏览器内存，刷新后清空。

## 串联流程

1. 在 `sources/source_registry.json` 登记或确认来源。
2. 使用对应 Skill 生成草稿，只能写入 `cards/drafts/<domain>/`。
3. 运行 `npm run kb -- prepare`，依次校验来源、校验卡片、生成 Markdown。
4. 人工阅读 draft Markdown，确认内容、来源和风险提示。
5. 运行 `npm run kb -- review <card-id>` 做审核 dry-run。
6. 人工确认通过后，运行 `npm run kb -- review <card-id> --apply` 或在 `/review` 页面迁移到 reviewed。
7. 搜索和 Agent 问答只检索 `cards/reviewed/`。

## 迁移说明

早期根目录 `source_registry.json` 已迁移为 `sources/source_registry.json`。后续脚本只读取 `sources/source_registry.json`，不要再维护根目录来源登记副本。
