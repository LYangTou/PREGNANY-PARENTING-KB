---
name: shopping-card-generator
description: Generate draft-only shopping and product-safety card files for maternity bags, newborn supplies, safe sleep products, avoid-buying guidance, and buying timelines in the pregnancy-parenting knowledge base. Use only when output must stay under cards/drafts/shopping/ and must avoid brand recommendations or affiliate-style language.
---

# Shopping Card Generator

## 输入

- 用户给定的用品主题、宝宝阶段、购买场景和期望卡片数量。
- 已登记来源：必须读取 `sources/source_registry.json`，优先使用医院、NHS、AAP、CPSC、监管机构或其他安全来源。
- 项目字段要求：输出卡片必须符合 `AGENTS.md` 的必填字段。

## 输出

- 只输出到 `cards/drafts/shopping/`。
- JSON 是机器权威版本；如生成 Markdown，只能作为同一 draft JSON 的阅读版。
- `domain` 固定为 `shopping`。
- `reviewStatus` 固定为 `draft` 或 `needs-review`，不得为 `reviewed`。
- `shoppingType` 必须明确为 `must-have`、`optional`、`not-recommended` 或 `not-applicable`。

## 工作流程

1. 判断主题是否属于 shopping：待产包、新生儿用品、安全睡眠用品、不建议购买的产品、购买时间线。
2. 优先检查安全来源；没有安全来源时，不输出安全结论。
3. 明确区分“刚需”“可选”“不建议”，并把对应理由写入 `summary`、`actions` 或 `avoid`。
4. 涉及睡眠、窒息、跌落、召回、过敏或呼吸风险时，在 `askDoctorWhen` 和 `redFlags` 中保留安全提示。
5. 保存为 draft，不进入 reviewed。

## 禁止事项

- 禁止写入 `cards/reviewed/`。
- 禁止品牌推荐、带货口吻、价格诱导、购买链接导购。
- 禁止推荐存在安全争议的婴儿睡眠产品。
- 禁止把网红经验、商家页面或用户评价当作安全依据。
- 禁止无来源输出婴儿安全、睡眠安全、疫苗、用药或疾病相关结论。

## 风险边界

- 该 Skill 只生成购物和安全避坑草稿，不承担商品推荐或医疗判断。
- 对睡眠用品、喂养用品、消毒用品、药品、保健品等高风险类别，必须优先依据监管或医学安全来源。
- 商品是否适合具体宝宝，仍应结合医生建议、产品说明和当地监管要求。
