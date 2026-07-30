# CLAUDE.md

本文件为 Claude Code / AI 助手与新协作者提供本仓库的规则。**动手前先读完硬规则那一节。**

## 项目定位

**Antelope 业务线的翻译内容仓库。** 这里是所有多语言文案的唯一来源。

宿主项目 [`antelope-web`](https://github.com/alphaess-developer/antelope-web) 以 git submodule 引入本仓库（挂载点 `i18n/`），在**构建时**把译文打进产物 —— 不是运行时拉取。

- 本仓库无后端、无数据库。GitHub 承担存储/写入/权限/历史，CI 承担质量门禁。
- 改文案 → 提 PR → CI 绿 → 合并 → 宿主项目重新构建部署后生效。

## 规模

| 项 | 值 |
|---|---|
| namespace | **140 个** |
| 语种 | **11 个**（基准 `en-US` + 10 个目标语种） |
| 文件 | 1540 个 `locales/<ns>/<lang>.json` |
| key | 聚合 **5,883** 行（ns × key），含各语种共 64,599 条 |

## 🔴 硬规则（违反必然被 CI 挡住）

### 1. 占位符是**单花括号**

```json
{ "greeting": "你好 {name}，共 {count} 条" }
```

**是 `{name}` 不是 `{{name}}`。** 宿主项目配置为 `interpolation: { prefix: '{', suffix: '}' }`（见 `antelope-web/packages/shared/src/i18n/index.ts`），双花括号插值会**失效**。

> 这是最容易犯的错 —— i18next 的默认写法是双花括号，凭习惯写就会错。

### 2. 占位符名**绝不能翻译**

```json
// en-US
{ "coverage": "{country} / {model}" }

// de-DE  ❌ 错误：变量名被翻译了
{ "coverage": "{Land} / {model}" }

// de-DE  ✅ 正确
{ "coverage": "{country} / {model}" }
```

各语种的占位符集合必须与 `en-US` **完全一致**。存量数据里已经有 14 处这种错（见 `.ci/baseline.json`），后果是用户看到 `{Land} / X` 这种字面量。

错误码里的 `{0}` `{1}` 是后端传的位置参数，同理不能改序号。

### 3. 基准语言是 `en-US`，新增内容**只写基准语言**

```
✅ 在 locales/<ns>/en-US.json 加 key，提 PR
   → fill-missing workflow 自动用英文占位补齐其余 10 个语种
   → _meta/ 里标记为 draft，供后续优化

❌ 手工往 11 个文件里各塞一份自己编的译文
```

若确实要一次补齐真译文，用 `node tools/fill-missing.mjs --write` 打好占位后再逐个替换，**不要手工新建文件**。

### 4. key 顺序由 `canonicalKeyOrder` 决定，**不是字典序**

```bash
node tools/sort-keys.mjs --write   # 唯一正确的排序方式
```

⚠️ 不要手工按字母排。`dictionaries/error-code` 的 key 是错误码数字，**JS 引擎会把规范整数键强制按数值升序排到对象最前**（`6022` 在 `601000` 前），与文件书写顺序无关。按字典序写文件会让校验**永远无法通过**。规则实现见 `tools/lib/core.mjs` 的 `canonicalKeyOrder()`。

### 5. 文件路径**严格等于 namespace 名**

```
locales/dictionaries/region/en-US.json   →   ns 名 dictionaries/region
locales/device-form/battery/en-US.json   →   ns 名 device-form/battery
```

这条规则是**构建时注入的 glob 查表、i18n Ally 的 pathMatcher、CI 校验**三者的共同基石。ns 名由宿主项目的 `dictToNs()` 从字典 code 推导，**不能为任何理由给某个 ns 开路径特例**。

已评估并否决过两个「把错误码挪到独立目录」的方案，理由见 `locales/dictionaries/error-code/README.md`。

### 6. ⚠️ `.ci/baseline.json` 是欠账清单，**不是绕过检查的逃生舱**

里面记录的是从翻译平台迁移时带来的 **123 条历史问题**，CI 对清单内条目放行。

```
✅ 修好一条 → 从清单里删掉那一条
❌ 新问题过不了 CI → 把它加进清单
```

**绝不要为了让 CI 变绿而往 baseline 里加新条目。** 如果新增内容触发了阻塞级检查，那就是内容有问题，改内容。

重新生成命令（`--baseline`）会把当前**所有**问题一次性豁免，只在明确知道后果时用。

### 7. 文件内一层扁平，值必须是字符串

```json
✅ { "inverter_tab": "Inverter", "status.online": "Online" }
❌ { "inverter": { "tab": "Inverter" } }
```

`dictionaries/*` 的 key 天生含点号（由 `dictToKey()` 产生），那仍是**一层扁平 JSON**，只是 key 字符串里有点号 —— 不是嵌套对象。

## 常用命令

```bash
node tools/validate.mjs            # 全量校验（CI 跑的就是这个）
node tools/sort-keys.mjs --write   # 修复 key 顺序
node tools/fill-missing.mjs        # 看哪些语种缺 key
```

```bash
node tools/fill-missing.mjs --write --ns=dictionaries/error-code   # 只补某个 ns
```

也有 npm scripts（`validate` / `sort` / `fill` / `baseline`），但**脚本刻意零依赖**（只用 `node:` 内置模块），装了 Node 20+ 就能直接跑 `node tools/*.mjs`，不需要 `npm install`。

## 目录结构

```
locales/<ns>/<lang>.json      翻译内容，ns 名可含斜杠
├── common/  auth/  layout/   通用与骨架文案
├── device-form/battery/ …    业务文案
└── dictionaries/             字典译文
    ├── error-code/           错误码（后端同事主要改这里）
    ├── antelope-*-menu/      三个 app 各自的菜单
    └── region/ product_config/ …

languages.json                基准语言 + 目标语种声明
_meta/<ns>.json               未翻译标记（{ key: { lang: 'draft' } }），缺省即已确认
glossary/terms.json           术语库（约束译法，不进运行时产物）
.ci/baseline.json             存量欠账豁免清单（见硬规则 6）
tools/                        零依赖校验与规范化脚本
inbox/                        PM 上传 Excel 的落点（往返流程待建）
```

## CI 检查项

| 检查 | 级别 |
|---|---|
| JSON 语法 / key 集合对齐 / 占位符一致性 / 双花括号 / 禁止嵌套 / key 顺序 | 🔴 阻塞 |
| 重复源文 / 同源文异译（措辞漂移预警） | ⚪ 警告 |

当前警告基线：**944 组重复源文、126 组同源文异译** —— 是业务线内部一致性的现状，不阻塞，供逐步清理。

## 不要碰什么

| 对象 | 原因 |
|---|---|
| `.gitattributes` | 强制 LF。本仓库被多方编辑（Windows 本地 / github.dev 浏览器 / CI），放任换行符转换会产生「整文件 diff」纯噪音 |
| `languages.json` 的 `base` | 改基准语言会让全部 key 对齐检查重算 |
| `tools/lib/core.mjs` 的 `canonicalKeyOrder` | 改了会让 error-code 的校验永久失败，见硬规则 4 |
| `.ci/baseline.json` 加条目 | 见硬规则 6 |

## 相关文档

| 文档 | 内容 |
|---|---|
| [README.md](README.md) | 面向 PM 与一般协作者的入口 |
| **[docs/decisions.md](docs/decisions.md)** | **决策记录 + 已否决方案** —— 提新方案前先看，大概率已讨论过 |
| [docs/translating.md](docs/translating.md) | 翻译产出流程：AI 生成规则、`_meta` 状态标记、占位符铁律 |
| [docs/glossary-guide.md](docs/glossary-guide.md) | 术语库模型（概念导向）、匹配规则、维护方式 |
| [docs/backend-guide.md](docs/backend-guide.md) | **给后端同事**：新增/修正错误码的三步操作，可直接转发 |
| [docs/viewer-spec.md](docs/viewer-spec.md) | GitHub Pages 只读查看页的实现规格 |
| [docs/import-from-tms.md](docs/import-from-tms.md) | 迁移日「重新导出覆盖」的操作步骤 |
| [locales/dictionaries/error-code/README.md](locales/dictionaries/error-code/README.md) | 错误码的特殊约定与目录位置决策 |
| `translation-platform/docs/refactor/plan-b.md` | 整套方案的设计推导（本仓库不需要它也能运作） |
| `antelope-web/docs/development/i18n-git-migration-plan.md` | 宿主项目侧的接入与切换计划 |

## 约定

- 注释、提交信息、文档用**中文**（与 antelope-web 一致）
- 提交信息遵循 conventional commits
- `main` 有分支保护：禁止直推，必须走 PR 且 CI 通过
