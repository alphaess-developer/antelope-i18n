# 委托 AI 助手改翻译（把本文整篇发给 AI）

> **给后端 / 产品同事**：你不用读完这份文档。
> 复制下面对应你场景的那段话 + 本文链接，发给你的 AI 助手（Claude Code / Cursor / Copilot 皆可），
> 它会照着做完并提 PR，你在 GitHub 上点审核就行。

## 怎么用

### 任务 A · 新增 / 修改错误码（后端同事）

```text
请按 https://github.com/alphaess-developer/antelope-i18n/blob/main/docs/ai-agent-brief.md
的「任务 A」规则，往 antelope-i18n 仓库提一个 PR。

新增/修改的错误码（英文基准）：
  6199 = Device {sn} is offline
  6200 = {0} has been locked, please try again in {1} minutes

需求背景：[一句话说明，比如「设备锁定接口新增两个错误返回」]
Jira：[ANTELOPE-xxxx，没有就写「无」]
```

**只需要给英文。** 其余 10 个语种由 AI 按下面的规则一并译好。

### 任务 B · 批量回写译文（产品同事）

从查看页导出 Excel / JSON，在表里改好译文，然后连文件一起发给 AI：

```text
请按 https://github.com/alphaess-developer/antelope-i18n/blob/main/docs/ai-agent-brief.md
的「任务 B」规则，把附件里改好的译文回写进 antelope-i18n 仓库并提 PR。

附件：[导出的 xlsx / json 文件]
改动范围：[比如「device-form/battery 的 de-DE 和 fr-FR」]
说明：[比如「按新术语表统一了 Inverter 的译法」]
```

⚠️ 表里**没改动的行不要回写** —— 让 AI 只写差异行，PR 才看得懂。

---

以下是给 AI 助手看的部分。

---

## 通用背景

仓库：`https://github.com/alphaess-developer/antelope-i18n`（Antelope 业务线翻译内容仓库，无后端、无数据库、零 npm 依赖）

内容布局：`locales/<ns>/<lang>.json`，**文件路径严格等于 namespace 名**。共 **11 个语种**：

```
en-US（基准）  zh-CN  de-DE  fr-FR  es-ES  it-IT  nl-NL  sv-SE  el-GR  pl-PL  cs-CZ
```

权威语种清单以仓库根的 `languages.json` 为准，**不要硬编码本文的列表** —— 读文件。

每个 key 必须在 **11 个文件里都存在**，缺一个 CI 就会红。

两类任务共用同一套硬规则、同一套校验命令、同一份自检清单（见下方通用部分）。

## 任务 A · 新增 / 修改错误码

目标文件：`locales/dictionaries/error-code/<lang>.json`。key 就是接口返回的 `code`（字符串形式的数字）。

1. **克隆并新建分支**（`main` 有分支保护，禁止直推）

   ```bash
   git clone https://github.com/alphaess-developer/antelope-i18n.git
   cd antelope-i18n
   git checkout -b feat/error-code-<简短描述>
   ```

2. **先写基准语种** —— 把用户给的英文写进 `en-US.json`。位置随便插，规范化步骤会排序。

3. **翻译其余 10 个语种**，逐个文件写入同名 key。翻译要求见下方「翻译要求」。
   - 若用户明确说「先占位、之后人工翻译」，改用
     `node tools/fill-missing.mjs --write --ns=dictionaries/error-code`
     用英文占位补齐，并在 PR 描述里注明「待人工优化」。

4. **修改既有 code 时**：只改用户点名的语种/条目，不要顺手改别的行。

5. 跳到下方「通用：规范化 → 校验 → 提 PR」。

### 三个特殊 key（不要动、不要模仿）

| key | 用途 |
|---|---|
| `0000` | 通用兜底。任何码查不到文案时显示它，带 `{errorCode}` |
| `99999` | 约定为「后端直接返回文案」，前端不查此表 |
| `Username cannot be changed` | 历史遗留的非数字 key，别新增同类 |

## 任务 B · 批量回写译文

用户给的是从查看页导出的 Excel 或 JSON，列结构固定：

```
namespace | key | en-US | <语种1> | <语种2> | …
```

（JSON 是等价的对象数组：`{ ns, key, "en-US", "de-DE", … }`）

1. 克隆并新建分支：`git checkout -b feat/i18n-<简短描述>`

2. **先算差异，再动手。** 逐行把表里的值和 `locales/<ns>/<lang>.json` 里的现值比对，
   列出真正有变化的 `(ns, key, lang)` 三元组。**只写这些行。**
   - 把差异清单先输出给用户看一眼，再落盘 —— 批量回写写错的代价比错误码大得多。

3. **不要凭表格增删 key。** 表里多出来的行、少掉的行一律**不执行**，改为报告给用户：
   - 新增 key 要 11 个语种一起加，且基准语种得先有 —— 这是另一个任务，让用户确认
   - 表里缺的行通常只是他们导出时筛过，不代表要删

4. **`ns` 和 `key` 两列是主键，绝不修改。** 只写语种列。

5. **空单元格 = 不改**，不是「清空这条」。要清空必须用户明确说。

6. 若用户改的是 `en-US`（基准语种）：其余 10 个语种的旧译文**可能已经对不上了**。
   不要自作主张重译，把受影响的 key 列出来报告给用户。

7. 跳到下方「通用：规范化 → 校验 → 提 PR」。

## 通用：规范化 → 校验 → 提 PR

**两条命令都必须跑，且必须全绿才提交：**

```bash
node tools/sort-keys.mjs --write
node tools/validate.mjs
```

脚本零依赖，Node 20+ 直接跑，**不要 `npm install`**，不要给根目录 `package.json` 加依赖。

提交信息用 conventional commits，**中文正文**，例如：

```
feat(dictionaries/error-code): ANTELOPE-5940 新增设备离线错误码 6199-6200（11 语种）
fix(device-form/battery): 统一 de-DE / fr-FR 的 Inverter 译法（12 条）
```

PR 描述里列出：改动清单、影响的 ns 与语种、需求背景、Jira 号。
提完 PR 后**等 CI 跑完**。若红了，读报错自己修，不要走下面「绝对不要做」里的捷径。

## 🔴 硬规则（违反必然被 CI 拦住）

| # | 规则 | 说明 |
|---|---|---|
| 1 | **占位符是单花括号** | 是 `{0}` `{sn}`，**不是** `{{0}}`。宿主项目 i18next 配为 `prefix:'{' suffix:'}'`，双花括号会失效 |
| 2 | **占位符名/序号绝不翻译、绝不改** | 德语里也必须是 `{sn}`，不能写 `{Nummer}`；`{0}` `{1}` 是后端位置参数，序号不能调换 |
| 3 | **各语种占位符集合与 en-US 完全一致** | 不能多、不能少 |
| 4 | **key 顺序由 `tools/sort-keys.mjs` 决定** | 不是字典序。error-code 的数字 key 会被 JS 引擎按**数值**升序排到对象最前（`6022` 在 `601000` 前）。手工按字母排会让校验永远过不了 |
| 5 | **一层扁平 JSON，值必须是字符串** | 禁止嵌套对象。`dictionaries/*` 的 key 含点号，那仍是一层扁平，不是嵌套 |
| 6 | **文件路径严格等于 namespace 名** | 不要新建目录、不要挪动既有 ns 的位置 |
| 7 | **换行符 LF** | 仓库有 `.gitattributes` 强制，不要改它 |

## 翻译要求

- **语气**：面向终端用户，简洁、中性、不指责用户。跟同一个 ns 里既有条目的措辞风格保持一致
  —— **动手前先读几十条现有译文**。
- **术语**：`glossary/terms.json` 是术语库，命中的概念按 `preferred` 译法走。
- **占位符原样保留**，位置可以按目标语言语序移动，但名字/序号不变。
- **标点**：中文用全角，其余语种用该语言习惯的半角标点。
- 拿不准的语种宁可保守直译，也不要发挥。

### `_meta` 标记

新写的机器翻译在 `_meta/<ns>.json` 里标为 `draft`，作为「这条还没人工确认」的记录：

```json
{ "6199": { "zh-CN": "draft", "de-DE": "draft" } }
```

基准语种（`en-US`）不标。**任务 B 里人工确认过的条目，要把对应标记删掉** —— 那正是批量回写的意义。

## ❌ 绝对不要做

- **不要往 `.ci/baseline.json` 加条目。** 那是迁移遗留欠账的豁免清单，不是绕过 CI 的逃生舱。
  新增内容触发了阻塞级检查 = 内容有问题，改内容。
- 不要跑 `npm run baseline` / `--baseline`（会一次性豁免当前所有问题）。
- 不要改 `tools/lib/core.mjs` 的 `canonicalKeyOrder`、`languages.json` 的 `base`、`.gitattributes`。
- 不要为了让 key 集合对齐而删除任何既有 key。
- 不要直推 `main`。
- 不要在根目录 `package.json` 加依赖（`validate.yml` 靠零依赖免掉 `npm install`）。
- 不要顺手「优化」用户没点名的条目 —— PR 越小越好审。

## 提交前自检清单

- [ ] 涉及的 key 在 11 个语种文件里都存在，值都是非空字符串
- [ ] 每个语种的占位符集合与 en-US 逐条一致，无双花括号
- [ ] `node tools/sort-keys.mjs --write` 跑过，`git diff` 里没有意外的大范围重排
- [ ] `node tools/validate.mjs` 全绿
- [ ] `.ci/baseline.json` **无改动**
- [ ] 只动了用户点名范围内的文件（外加 `_meta/`），没有误伤其他 ns
- [ ] **任务 B 额外**：`git diff` 的行数与你报给用户的差异条数对得上，没有多写
- [ ] PR 描述列清了改动清单与背景

## 更多背景

| 文档 | 内容 |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | 仓库全量规则（7 条硬规则） |
| [docs/backend-guide.md](backend-guide.md) | 后端同事的人工操作路径 |
| [docs/translating.md](translating.md) | 翻译产出规则与 `_meta` 状态标记 |
| [docs/glossary-guide.md](glossary-guide.md) | 术语库模型与匹配规则 |
| [locales/dictionaries/error-code/README.md](../locales/dictionaries/error-code/README.md) | 错误码的特殊约定 |
