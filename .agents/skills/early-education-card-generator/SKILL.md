---
name: early-education-card-generator
description: Generate draft-only early-education knowledge card files for prenatal bonding and fetal early-education boundaries, toddler and preschool parent-child interaction, language and reading, play-based learning, positive parenting, and scientific early childhood education in the pregnancy-parenting knowledge base. Use only when output must stay under cards/drafts/early-education/ and must cite registered sourceIds from sources/source_registry.json.
---

# Early Education Card Generator

## 输入

- 用户给定的胎儿早教边界、孕期亲子联结、幼儿教育主题、年龄阶段、目标读者和期望卡片数量。
- 已登记来源：必须读取 `sources/source_registry.json`，只使用其中已有 sourceId。
- 项目字段要求：卡片必须包含 `id`、`title`、`domain`、`stage`、`category`、`summary`、`actions`、`avoid`、`askDoctorWhen`、`redFlags`、`shoppingType`、`fatherTasks`、`sources`、`evidenceLevel`、`reviewStatus`、`updatedAt`。

## 输出

- 只输出到 `cards/drafts/early-education/`。
- JSON 是机器权威版本；如生成 Markdown，只能作为同一 draft JSON 的阅读版。
- `domain` 固定为 `early-education`。
- `stage` 优先使用 `pregnancy-all`、`pregnancy-middle`、`toddler-1-3y` 或 `preschool-3-6y`，不确定时用 `all`。
- `category` 优先使用 `early-education`、`language-reading`、`play-learning`、`development` 或 `family-support`。
- `shoppingType` 固定为 `not-applicable`。
- `fatherTasks` 固定为空数组，除非用户明确要求生成家庭分工。
- `reviewStatus` 固定为 `draft` 或 `needs-review`，不得为 `reviewed`。
- `sources` 必须只包含 `sources/source_registry.json` 中已登记的 sourceId。

## 工作流程

1. 确认主题属于 early-education：胎儿早教边界、孕期亲子联结、胎儿熟悉声音、亲子互动、语言阅读、讲故事、游戏学习、科学探究、艺术体验、生活自理、正向养育、规则和情绪表达。
2. 检索已登记来源；没有足够来源时，只能输出空模板或说明“当前来源不足”，不得编写教育或发育结论。
3. 优先把建议写成可执行的日常家庭动作，例如“每天共同看图书”“用孩子感兴趣的话题交谈”“用假装游戏练习表达”等。
4. 处理胎儿早教时，只写“孕期亲子联结、读书唱歌熟悉声音、照护者放松和愉快”的边界；不得写成胎儿智力、语言、性格、音乐或学习能力训练。
5. 把边界写清楚：幼儿教育卡片不替代产检、儿科、儿童保健、心理或发育评估。
6. 涉及胎动异常、孕期不适、发育迟缓、语言迟缓、听力问题、行为严重异常、安全风险、吞咽窒息、溺水、过度屏幕暴露等情况时，在 `askDoctorWhen` 或 `redFlags` 中加入咨询医生、儿童保健机构或专业人员的提示。
7. 保存为 draft，不进入 reviewed。

## 禁止事项

- 禁止写入 `cards/reviewed/`。
- 禁止使用 `cards/drafts/` 作为事实依据。
- 禁止无来源扩展幼儿发育、教育、医学、心理、用药、疫苗、疾病或安全结论。
- 禁止把胎儿早教写成胎儿能力训练或出生前教学。
- 禁止承诺提升智力、语言能力、性格、专注力、学习成绩或入学表现。
- 禁止鼓励超前教育、机械识字、刷题训练、强化训练或用单一指标评价孩子。
- 禁止课程、机构、App、玩具、绘本、教具或品牌推荐。
- 禁止诊断发育迟缓、语言迟缓、自闭症、注意力问题或心理问题。

## 风险边界

- 该 Skill 只生成待审核幼儿教育知识草稿，不替代医生、儿童保健机构、心理专业人员、特殊教育评估或托育/幼教专业判断。
- 涉及发育异常、语言明显落后、听力疑虑、退化、持续攻击或自伤行为、严重睡眠/进食问题、窒息、溺水、误服、跌落等安全风险时，必须保留专业求助或及时就医提示。
- HealthyChildren 和 NHS prenatal bonding 来源适合用于孕期亲子联结和胎儿熟悉声音边界；教育部 3-6 岁来源适合用于学前教育和科学保教；CDC toddler 来源适合用于 1-3 岁正向养育和亲子互动。不要跨年龄段硬套目标。
