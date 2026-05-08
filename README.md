# 家庭孕育知识库

本项目用于本地整理家庭孕育知识卡片，覆盖孕产医学保健、0-3 岁育儿、妈妈情绪支持、爸爸任务、母婴用品避坑和家庭记录归档。

## 基本规则

- 来源登记唯一入口是 `sources/source_registry.json`。
- 新内容先进入 `cards/drafts/`。
- `cards/reviewed/` 只能保存人工审核通过的卡片，问答和搜索只读取该目录。
- `family-records/` 默认不读取、不参与问答、不上传、不作为诊断依据。
- 医学、心理、疫苗、用药、婴儿安全相关内容不得替代医生或心理专业人员判断。

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

## 串联流程

1. 在 `sources/source_registry.json` 登记或确认来源。
2. 使用对应 Skill 生成草稿，只能写入 `cards/drafts/<domain>/`。
3. 运行 `npm run kb -- prepare`，依次校验来源、校验卡片、生成 Markdown。
4. 人工阅读 draft Markdown，确认内容、来源和风险提示。
5. 运行 `npm run kb -- review <card-id>` 做审核 dry-run。
6. 人工确认通过后，运行 `npm run kb -- review <card-id> --apply` 迁移到 reviewed。
7. 运行 `npm run kb -- search --query "关键词"`，只检索 `cards/reviewed/`。

## 迁移说明

早期根目录 `source_registry.json` 已迁移为 `sources/source_registry.json`。后续脚本只读取 `sources/source_registry.json`，不要再在根目录维护来源登记副本。
