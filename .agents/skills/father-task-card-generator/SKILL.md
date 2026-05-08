---
name: father-task-card-generator
description: Generate draft-only father/husband task card files for early, middle, and late pregnancy, birth companionship, postpartum support, breastfeeding support, family communication, and father stress management in the pregnancy-parenting knowledge base. Use only when output must stay under cards/drafts/father-tasks/ and must be concrete, actionable, and source-backed.
---

# Father Task Card Generator

## 输入

- 用户给定的阶段、家庭场景、任务主题和期望卡片数量。
- 已登记来源：必须读取 `sources/source_registry.json`，只使用其中已有 sourceId。
- 项目字段要求：输出卡片必须符合 `AGENTS.md` 的必填字段。

## 输出

- 只输出到 `cards/drafts/father-tasks/`。
- JSON 是机器权威版本；如生成 Markdown，只能作为同一 draft JSON 的阅读版。
- `domain` 固定为 `father-tasks`。
- `reviewStatus` 固定为 `draft` 或 `needs-review`，不得为 `reviewed`。
- `fatherTasks` 必须包含可执行动作，不得只写抽象态度。

## 工作流程

1. 判断主题是否属于 father-tasks：孕早期、孕中期、孕晚期、陪产、产后支持、母乳喂养支持、家庭沟通、爸爸自我压力管理。
2. 检查相关 sourceId 是否已登记；来源不足时只输出任务模板或来源不足说明。
3. 每张卡片至少覆盖：具体动作、不要做什么、何时升级寻求医生或专业帮助。
4. 对医学、心理、喂养或婴儿安全相关任务，必须引用对应权威来源，并保留风险提示。
5. 保存为 draft，不进入 reviewed。

## 禁止事项

- 禁止写入 `cards/reviewed/`。
- 禁止空泛情绪价值，例如只写“多关心”“多陪伴”而没有动作。
- 禁止替代医生、助产士、心理专业人员或母乳喂养专业支持。
- 禁止要求爸爸自行解读检查报告、决定用药、决定疫苗或判断疾病风险。
- 禁止把家庭记录作为诊断依据。

## 风险边界

- 该 Skill 只生成爸爸/丈夫任务草稿，用于家庭执行清单，不提供医学或心理专业判断。
- 出现孕期异常、产后出血、宝宝呼吸异常、发热、黄疸、过敏、自伤或严重绝望等情况时，任务应升级为“联系医生/及时就医/寻求专业帮助”。
- 爸爸压力管理内容应鼓励求助和分工调整，不应压低妈妈或宝宝的安全需求。
