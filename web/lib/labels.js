export const labels = {
  domain: {
    medical: "医学保健",
    "early-education": "早教与亲子互动",
    "mental-health": "情绪与心理支持",
    shopping: "母婴用品",
    "father-tasks": "爸爸/丈夫任务",
    "family-records": "家庭记录归档"
  },
  stage: {
    preconception: "备孕期",
    "pregnancy-early": "孕早期",
    "pregnancy-middle": "孕中期",
    "pregnancy-late": "孕晚期",
    "pregnancy-all": "孕期通用",
    birth: "分娩期",
    postpartum: "产后",
    newborn: "新生儿",
    "infant-0-6m": "婴儿 0-6 月",
    "infant-6-12m": "婴儿 6-12 月",
    "toddler-1-3y": "幼儿 1-3 岁",
    "preschool-3-6y": "学前 3-6 岁",
    all: "全阶段",
    "not-applicable": "不适用"
  },
  category: {
    "prenatal-checkup": "孕期检查",
    "postpartum-care": "产后护理",
    "newborn-care": "新生儿护理",
    vaccination: "疫苗",
    feeding: "喂养",
    development: "发展支持",
    "early-education": "早教边界",
    "language-reading": "语言与阅读",
    "play-learning": "游戏学习",
    "red-flags": "危险信号",
    "emotion-support": "情绪支持",
    "depression-anxiety": "抑郁/焦虑识别",
    "family-support": "家庭支持",
    "shopping-list": "用品清单",
    "safe-sleep-shopping": "安全睡眠用品",
    "avoid-products": "避坑用品",
    "father-prenatal": "孕期爸爸任务",
    "father-birth": "陪产任务",
    "father-postpartum": "产后爸爸任务",
    "breastfeeding-support": "母乳喂养支持",
    "records-prenatal": "产检记录",
    "records-baby-checkup": "宝宝体检记录",
    "records-vaccine": "疫苗记录",
    "records-feeding-sleep": "喂养/睡眠记录",
    template: "模板"
  },
  reviewStatus: {
    draft: "草稿",
    "needs-review": "待审核",
    reviewed: "已审核",
    rejected: "已驳回"
  },
  evidenceLevel: {
    guideline: "指南",
    "public-health-guidance": "公共健康指导",
    "expert-consensus": "专家共识",
    "product-safety-guidance": "产品安全指导",
    "local-material": "本地材料",
    "source-backed-draft": "来源支持草稿"
  },
  shoppingType: {
    "must-have": "刚需",
    optional: "可选",
    "not-recommended": "不建议",
    "not-applicable": "不适用"
  },
  field: {
    id: "卡片 ID",
    title: "标题",
    domain: "知识域",
    stage: "阶段",
    category: "分类",
    summary: "摘要",
    actions: "具体动作",
    avoid: "不要做什么",
    askDoctorWhen: "何时求助",
    redFlags: "危险信号",
    shoppingType: "购物类型",
    fatherTasks: "爸爸任务",
    sources: "来源",
    evidenceLevel: "证据等级",
    reviewStatus: "审核状态",
    updatedAt: "更新时间",
    "all-reviewed": "全部已审核卡片",
    sourceIds: "来源 ID"
  }
};

export function badgeText(kind, value = "") {
  return labels[kind]?.[value] || value || "未设置";
}

export function labelWithRaw(kind, value = "") {
  const label = badgeText(kind, value);
  return label === value ? value : `${label}（${value}）`;
}

export function fieldLabel(value = "") {
  return labels.field[value] || value;
}

export function labelAliases() {
  return Object.entries(labels).flatMap(([kind, values]) =>
    Object.entries(values).map(([id, label]) => ({ kind, id, label }))
  );
}
