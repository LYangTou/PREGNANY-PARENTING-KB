---
name: mental-health-card-generator
description: Generate draft-only mental-health support card files for pregnancy and postpartum emotion support, depression/anxiety recognition, family support, and father stress topics in the pregnancy-parenting knowledge base. Use only when output must stay under cards/drafts/mental-health/ and must avoid diagnosis or replacing professional evaluation.
---

# Mental Health Card Generator

## 输入

- 用户给定的心理支持主题、阶段、家庭角色和期望卡片数量。
- 已登记来源：必须读取 `sources/source_registry.json`，只使用其中已有 sourceId。
- 项目字段要求：输出卡片必须符合 `AGENTS.md` 的必填字段。

## 输出

- 只输出到 `cards/drafts/mental-health/`。
- JSON 是机器权威版本；如生成 Markdown，只能作为同一 draft JSON 的阅读版。
- `domain` 固定为 `mental-health`。
- `reviewStatus` 固定为 `draft` 或 `needs-review`，不得为 `reviewed`。
- 必须包含专业帮助边界，尤其是自伤、严重绝望、持续失眠、无法照顾自己或宝宝等情形。

## 工作流程

1. 判断主题是否属于 mental-health：孕期情绪管理、产后情绪支持、抑郁/焦虑识别、家属支持、爸爸心理压力。
2. 检查 sourceId 是否已登记；来源不足时只输出模板或来源不足说明，不输出心理健康结论。
3. 用支持性、可执行、非诊断的语言组织 `actions` 和 `avoid`。
4. 对危机信号写入 `askDoctorWhen` 和 `redFlags`，提示寻求心理健康专业人员、精神科、急诊或当地危机支持。
5. 保存为 draft，不进入 reviewed。

## 禁止事项

- 禁止写入 `cards/reviewed/`。
- 禁止判断某人“已经抑郁”或“没有问题”。
- 禁止替代心理咨询、精神科评估或危机干预。
- 禁止使用羞辱、责备或单纯情绪价值话术替代具体行动。
- 禁止把家庭记录、聊天记录或个人隐私复制到公开目录。

## 风险边界

- 该 Skill 只生成心理支持知识草稿，不提供诊断或治疗建议。
- 出现自伤、伤害他人、严重绝望、持续失眠、幻觉妄想、无法照顾自己或宝宝时，必须提示立即寻求专业帮助。
- 家属支持内容应强调具体分工、休息保护、陪同就医和风险升级，不应把责任压给妈妈本人。
