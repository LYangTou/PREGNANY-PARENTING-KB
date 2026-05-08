---
name: medical-card-generator
description: Generate draft-only medical knowledge card files for pregnancy, postpartum, newborn, feeding, development, vaccination, checkup, and red-flag topics in the pregnancy-parenting knowledge base. Use only when output must stay under cards/drafts/medical/ and must cite registered sourceIds from sources/source_registry.json.
---

# Medical Card Generator

## 输入

- 用户给定的医学主题、适用阶段、目标读者和期望卡片数量。
- 已登记来源：必须读取 `sources/source_registry.json`，只使用其中已有 sourceId。
- 项目字段要求：卡片必须包含 `id`、`title`、`domain`、`stage`、`category`、`summary`、`actions`、`avoid`、`askDoctorWhen`、`redFlags`、`shoppingType`、`fatherTasks`、`sources`、`evidenceLevel`、`reviewStatus`、`updatedAt`。

## 输出

- 只输出到 `cards/drafts/medical/`。
- JSON 是机器权威版本；如生成 Markdown，只能作为同一 draft JSON 的阅读版。
- `domain` 固定为 `medical`。
- `reviewStatus` 固定为 `draft` 或 `needs-review`，不得为 `reviewed`。
- `sources` 必须只包含 `sources/source_registry.json` 中已登记的 sourceId。

## 工作流程

1. 先确认主题是否属于 medical：孕期检查、产后检查、新生儿护理、0-3 岁体检、疫苗、喂养、发育、危险信号。
2. 检索已登记来源；没有足够来源时，只能输出空模板或说明“当前来源不足”，不得编写医学结论。
3. 生成卡片前核对字段枚举和必填字段。
4. 涉及异常症状时，在 `askDoctorWhen` 和 `redFlags` 中加入咨询医生或及时就医提示。
5. 保存为 draft，不进入 reviewed。

## 禁止事项

- 禁止写入 `cards/reviewed/`。
- 禁止使用 `cards/drafts/` 作为事实依据。
- 禁止无来源扩展医学、用药、疫苗、疾病、婴儿安全结论。
- 禁止诊断。
- 禁止给出具体药物剂量。
- 禁止回答或暗示“肯定没事”。

## 风险边界

- 该 Skill 只生成待审核医学知识草稿，不替代医生。
- 涉及发热、黄疸、腹痛、出血、呼吸异常、过敏、疫苗、用药或检查异常时，必须保留就医或咨询医生提示。
- 医院资料只能作为本地就诊背景，不能替代权威指南，也不能直接推广为普适建议。
