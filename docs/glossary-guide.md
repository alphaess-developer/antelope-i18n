# 术语库指南

> 最后更新：2026-07-30
> 术语库文件：[`glossary/terms.json`](../glossary/terms.json)

## 1. 术语库是做什么的

**约束「同一个业务词在所有地方译法一致」。**

| 机制 | 管什么 | 粒度 | 进运行时产物？ |
|---|---|---|---|
| `locales/**` 翻译文件 | UI 上实际显示的文案 | 整条字符串 | ✅ 是 |
| **`glossary/terms.json`** | 长句**内部**的业务词该怎么译 | 词 / 短语 | ❌ **否** |

术语库**不是翻译内容** —— 前端永远不会 `t()` 它，也不会打进构建产物。它只在「创作期」起作用：约束 AI 生成、给 CI 做检查、给译员做参考。

> 举例：「逆变器离线，请检查网络」是一条 Entry（进产物）；而「逆变器 → Inverter」是一条术语（不进产物，但约束前者怎么译）。

## 2. 数据模型（概念导向）

对齐 ISO 30042 / TBX 的 `concept → term` 两层：

```json
[
  {
    "id": "inverter",
    "domain": "device",
    "definition": "光伏/储能逆变器设备",
    "terms": {
      "en-US": [
        { "text": "Inverter", "status": "preferred" },
        { "text": "Converter", "status": "deprecated" }
      ],
      "zh-CN": [{ "text": "逆变器", "status": "preferred" }]
    }
  },
  {
    "id": "alphaess-brand",
    "domain": "brand",
    "definition": "公司/产品品牌名，任何语种均不翻译",
    "dnt": true,
    "terms": { "en-US": [{ "text": "AlphaESS", "status": "preferred" }] }
  }
]
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `id` | 概念的稳定标识，kebab-case |
| `domain` | 领域分类（`device` / `brand` / `billing` / `grid` …），便于筛选 |
| `definition` | 概念定义 —— **给 AI 和译员的上下文**，不要省 |
| `dnt` | Do Not Translate。品牌名、产品名设 `true` |
| `terms.<语种>[]` | 该概念在该语种下的说法列表 |
| `terms.*.status` | `preferred`（推荐，每语种最多一条） / `admitted`（可接受的同义说法） / `deprecated`（禁用译法） |

### 为什么是「概念导向」而不是「源文 → 译法」

三个收益，简化模型都做不到：

**① 语言对称** —— 没有特权语言。基准语言是平台级配置（当前 `en-US`），若某天换源语言，术语库不用重建。

**② 同时治理源文一致性** —— 概念下可以挂**源语言的同义词**：

```json
{
  "id": "add-action",
  "terms": {
    "en-US": [
      { "text": "Add", "status": "preferred" },
      { "text": "New", "status": "deprecated" },
      { "text": "Create", "status": "admitted" }
    ],
    "zh-CN": [{ "text": "新增", "status": "preferred" }]
  }
}
```

这样既能约束「英文侧统一用 Add」，也能约束「中文侧统一用新增」。CI 的「同源文异译」警告（当前 126 组）正是这类问题的探测器。

**③ 一词多义可分开治理** —— 同一个词在不同语境是不同概念，建两个 concept 即可；简化模型下 `source_text` 唯一会打架。

附带：与 TBX 同构，将来要导入导出行业标准格式时直接映射。

## 3. 三个作用点（按价值排序）

| 作用点 | 状态 | 说明 |
|---|---|---|
| **① 喂给 AI**（最高价值） | ⏳ 待建 `tools/glossary-prompt.mjs` | 生成前把术语约束拼进提示词，见 [translating.md](translating.md) §3.2 |
| **② CI 术语检查** | ⏳ 待建 | 译文用了 `deprecated` 译法 → 警告 |
| **③ viewer 术语 Tab** | ⏳ 待建 | 见 [viewer-spec.md](viewer-spec.md) §4.3 |

> 前置约束（①）远比事后校验（②）有效 —— AI 拿不到术语库就会自己造译法，纠正成本高得多。

### `glossary-prompt` 的预期输出形态

```
Terminology constraints (must follow):
- "Inverter" → de-DE: "Wechselrichter" | zh-CN: "逆变器"
- "PV" → de-DE: "PV" | zh-CN: "光伏"        (do NOT use "Solar" / "Photovoltaic")
- "AlphaESS" → DO NOT TRANSLATE
```

## 4. 匹配规则

```
1. 在源文中查找命中的 term（preferred + admitted + deprecated 全都参与识别）
2. 长术语优先 —— 避免子串误命中（"ESS" 不应命中 "process"）
3. 同一位置只保留最长命中
```

校验译文时：

| 情况 | 结果 |
|---|---|
| 译文含 `deprecated` term | 警告（强）：用了禁用译法 |
| 译文不含 `preferred` term | 警告（弱）：建议使用「xxx」 |
| 概念标 `dnt` 且该词被改动 | 警告（强）：此词不应翻译 |
| 译文含 `admitted` | 通过，不提示 |

### 中文（CJK）匹配的已知妥协

中文无词边界，本项目**不引入分词器**。规则：子串匹配 + 最长优先 + 误命中由人确认例外。

**这是已知的精度妥协，写在这里避免反复讨论。** 好消息是基准语言是英文（有词边界），源文侧匹配可靠；中文只作为目标语言参与「译文是否包含推荐术语」的子串检查，不需要词边界。

## 5. 维护方式

| | 说明 |
|---|---|
| **Owner** | 产品 / 业务专家（**不是**开发） |
| **规模** | 几十到几百个概念。**不是翻译倾倒场** —— 整句进术语库是误用 |
| **来源** | ① 存量 Excel 术语表一次性导入 ② 日常优化发现分歧时增量沉淀 |
| **节奏** | 增量沉淀，不搞一次性大扫除 |
| **失控症状** | 概念数上千且多数无人引用；CI 警告长期无人处理 |

### 当前状态

`glossary/terms.json` 只有 **3 条种子**（逆变器 / 光伏 / AlphaESS-DNT），需要填充。

建议优先补：**核心设备与业务词**（逆变器、光伏、储能、并网、电站、SOC、BMS…）与**全部品牌/产品名**（设 `dnt: true`）。后者尤其重要 —— 品牌名被翻译是最尴尬的错误。

## 6. 与 Dictionary 的区别（别混）

| | `locales/dictionaries/*` | `glossary/terms.json` |
|---|---|---|
| 是什么 | 枚举/树形**内容**的译文，运行时要取值 | 用词**标准**，约束翻译过程 |
| 前端 `t()` 它吗 | ✅ 是 | ❌ 否 |
| 进构建产物 | ✅ 是 | ❌ 否 |

判断依据：**这条内容会不会被前端渲染出来？** 会 → 属于 `locales/`；只是「该怎么译」的规定 → 属于 `glossary/`。
