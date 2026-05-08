---
name: source-manager
description: Manage source intake drafts for the pregnancy-parenting knowledge base. Use when Codex needs to evaluate, normalize, or prepare source registration proposals for official Chinese sources, translated international sources, or hospital-provided materials, while respecting the project rule that skill outputs stay under cards/drafts/ and never write reviewed cards.
---

# Source Manager

## 输入

- 用户提供的来源信息：网页 URL、PDF/文件路径、来源标题、发布机构、语言、访问日期、适用知识域。
- 现有来源登记：优先读取 `sources/source_registry.json`，用于检查重复 `sourceId`、来源分组和登记格式。
- 项目规则：读取 `AGENTS.md`，确认医学、心理、购物、爸爸任务和家庭记录边界。

## 输出

- 只输出来源登记草案或来源整理备忘到 `cards/drafts/source-manager/`。
- 推荐文件名：`source-intake-<source-id>.json` 或 `source-intake-<source-id>.md`。
- 输出内容应包含建议的 `sourceId`、group、title、publisher、urlOrFile、language、sourceType、accessDate、authorityLevel、notes，以及是否适合后续制卡。
- 不直接修改 `sources/source_registry.json`；如需登记，只提出草案和人工复核建议。

## 工作流程

1. 检查来源是否已经登记，避免重复 sourceId。
2. 判断来源类型：中文权威来源、国际公开来源、医院资料、商品安全来源或其他。
3. 对英文来源只做中文整理建议，保留原始标题和原始发布机构。
4. 对医院资料标记为 `hospital-material` 草案，并说明它不能自动推广为普适医学结论。
5. 输出来源草案到 `cards/drafts/source-manager/`，等待人工确认后再由项目维护者登记。

## 禁止事项

- 禁止写入 `cards/reviewed/`。
- 禁止直接修改 `sources/source_registry.json`。
- 禁止把未登记来源当作 reviewed 卡片依据。
- 禁止基于模型常识补全医学、心理、疫苗、用药、疾病或婴儿安全结论。
- 禁止把家庭记录或含个人信息的医院资料复制到公开目录。

## 风险边界

- 该 Skill 只负责来源草案整理，不负责医学判断、诊断、用药、疫苗决策或心理评估。
- 来源权威性不足时，输出必须明确“不适合进入 reviewed，除非补充权威来源或人工审核”。
- 医院资料只能作为本地情境材料，不能替代医生面诊或公共卫生指南。
