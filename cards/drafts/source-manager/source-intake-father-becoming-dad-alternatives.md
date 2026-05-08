# Becoming a Dad 替代来源评估

- status: source-intake-draft
- updatedAt: 2026-05-08
- targetExistingSourceId: march-of-dimes-becoming-a-dad
- reason: March of Dimes 页面和 PDF 在当前环境被 Cloudflare/HTTP 403 阻断，不适合作为自动提取来源。

## 当前来源问题

- 已登记来源：`march-of-dimes-becoming-a-dad`
- 登记 URL：`https://www.marchofdimes.org/find-support/becoming-dad`
- 当前可用性：浏览器和 Node fetch 均被 Cloudflare/403 阻断。
- 本地缓存异常：`sources/cache/march-of-dimes-becoming-a-dad.json` 的 `url` 当前显示为 Mental Health Foundation 的 Becoming Dad URL，和 `source_registry.json` 登记 URL 不一致，建议后续人工清理或重新提取。

## 推荐替代 1：NHS Advice for partners during pregnancy

- proposedSourceId: `nhs-advice-for-partners-pregnancy`
- group: `father-tasks`
- title: `Advice for partners during pregnancy`
- publisher: `NHS`
- urlOrFile: `https://www.nhs.uk/best-start-in-life/pregnancy/advice-for-partners/`
- language: `en`
- sourceType: `public-health-guidance`
- authorityLevel: `high`
- suggestedEvidenceLevel: `public-health-guidance`
- suggestedUseFor:
  - `孕期伴侣支持`
  - `爸爸孕期家庭支持`
  - `健康生活方式和分娩前准备`
- 可用性测试：Node fetch 返回 200，可被现有 `extract-sources` 类脚本提取。
- 适合后续制卡：适合。内容覆盖戒烟酒、产前课程、规划去医院路线、行政和育儿假准备、一起运动、健康饮食、宝宝出生后喂养支持等可执行任务。
- 限制：偏家庭支持和健康教育，不是专门的爸爸身份转变心理指南。

## 推荐替代 2：ACOG A Partner's Guide to Pregnancy

- proposedSourceId: `acog-partners-guide-pregnancy`
- group: `father-tasks`
- title: `A Partner's Guide to Pregnancy`
- publisher: `American College of Obstetricians and Gynecologists`
- urlOrFile: `https://www.acog.org/womens-health/faqs/a-partners-guide-to-pregnancy`
- language: `en`
- sourceType: `professional-guideline`
- authorityLevel: `high`
- suggestedEvidenceLevel: `public-health-guidance`
- suggestedUseFor:
  - `孕期伴侣支持`
  - `产检陪同和分娩准备`
  - `产后支持和心理风险识别边界`
- 可用性测试：Node fetch 返回 200；Playwright 可打开页面。页面内容以 FAQ 折叠面板呈现，提取后需人工核对折叠内容是否完整。
- 适合后续制卡：适合。主题直接覆盖 partner 如何支持孕期、理解孕期、产检、生活方式、分娩准备、产后抑郁/焦虑识别、母乳喂养参与等。
- 限制：属于 ACOG 面向公众的教育材料，不应替代产检医生判断。

## 推荐替代 3：Tommy's Getting involved in the pregnancy

- proposedSourceId: `tommys-getting-involved-pregnancy`
- group: `father-tasks`
- title: `Getting involved in the pregnancy - for dads, partners and non-birthing parents`
- publisher: `Tommy's`
- urlOrFile: `https://www.tommys.org/pregnancy-information/dads-and-partners/getting-involved-in-the-pregnancy`
- language: `en`
- sourceType: `public-health-guidance`
- authorityLevel: `medium`
- suggestedEvidenceLevel: `public-health-guidance`
- suggestedUseFor:
  - `孕早期爸爸任务`
  - `孕中期爸爸任务`
  - `孕晚期爸爸任务`
  - `伴侣支持和异常症状升级提醒`
- 可用性测试：Node fetch 返回 200；页面声明经临床准确性审核，PIF TICK 认证，最后审核 January 2026。
- 适合后续制卡：很适合。内容按 first 3 months、months 4 to 6、last 3 months before birth 分段，能直接支持孕早/中/晚父亲任务卡。
- 限制：当前项目已登记 Tommy's 的分娩准备页面；新增此页时应避免和 `tommys-dads-partners-birth-prep` 混淆。

## 不推荐作为自动来源：Mental Health Foundation Becoming Dad

- candidateSourceId: `mental-health-foundation-becoming-dad`
- title: `Becoming Dad: A guide for new fathers`
- publisher: `Mental Health Foundation / Fatherhood Institute`
- urlOrFile: `https://www.mentalhealth.org.uk/explore-mental-health/publications/becoming-dad`
- 可用性测试：搜索索引可读，但当前浏览器和 Node fetch 均触发 Cloudflare/403。
- 适合性：内容主题很贴近爸爸身份转变、自我照顾、关系、求助和心理支持；但自动提取不可用。
- 建议：除非人工下载 PDF 并作为本地来源登记，否则暂不作为自动批量生成来源。

## 处理建议

1. 若目标是替换 March of Dimes 的“成为爸爸/孕期支持”用途，优先登记 `nhs-advice-for-partners-pregnancy`。
2. 若目标是强化医学和产后心理风险边界，登记 `acog-partners-guide-pregnancy`。
3. 若目标是继续优化孕早/中/晚父亲任务卡，登记 `tommys-getting-involved-pregnancy`。
4. 将 `march-of-dimes-becoming-a-dad` 标记为 `deprecated` 或保留但注明当前提取不可用，需要人工决定；不要继续依赖其缓存生成 reviewed 内容。
