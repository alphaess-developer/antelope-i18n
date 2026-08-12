# 任务：新增 / 修改动态表单的字段文案

> **用法**：把本文整份粘贴给 AI，然后填最后的「参数」一节。
> 本文自包含。若 AI 能读到仓库，`CLAUDE.md` 的规则优先于本文。
>
> 用途：产品同事在 antelope-web admin 的「产品配置」里给动态表单字段配国际化时，
> 发现**没有合适的现成 key**，需要新增；或者要改某条已有字段文案。

---

## 你的角色

你在为 AlphaESS 的 **Antelope 业务线**（储能/光伏的 Web 管理端）维护动态表单的字段文案。

**动态表单是什么**：产品同事在 admin「产品配置」页用 JSON Schema 编辑器搭出设备参数表单，
给每个字段配「标签 / 提示 / 帮助文本」三种文案。这些表单最终渲染在 **customer 与 business 端的设备设置页**，
终端用户直接看到。

**它们全部住在同一个 namespace 里**：

```
locales/dynamic-form/<语种>.json        一层扁平 JSON，值必须是字符串
```

基准语言 `en-US`（源）。目标语种 10 个：
`zh-CN` `de-DE` `fr-FR` `es-ES` `it-IT` `nl-NL` `sv-SE` `el-GR` `pl-PL` `cs-CZ`

你的产出会**直接进生产环境**，长度和语气比「翻得漂亮」更重要 —— 表单标签过长会撑破布局。

### 为什么是一个 ns，不按模块分

曾经按 admin 页面模块拆成 `product-config/battery`、`product-config/hardware` 等 7 个 ns。
对 167 条已存储的表单配置做过对账，结论是这个划分在制造问题：

- **跨模块字段被迫存多份** —— `maximum_grid_charging_power` 在三个 ns 各存一份
- **配置人员频繁选到隔壁模块的 key** —— 实测 5 处，后果是页面静默回退显示中文

模块是 admin 的**页面**边界，不是**字段语义**边界。所以合并成一个 ns。
**这意味着 key 名必须自己带够上下文**（见下面第 1 条）。

---

## 🔴 铁律（违反会被 CI 阻塞，PR 合不进去）

### 1. 先查重，再新增 —— 这是本任务最重要的一条

单 ns 的全部收益就在这里：通用字段只该有一份。新增之前**必须**先在
`locales/dynamic-form/en-US.json` 里搜一遍：

```
按 key 搜：   grep -i "charging_power" locales/dynamic-form/en-US.json
按英文搜：    grep -i "Bypass" locales/dynamic-form/en-US.json
```

`begin_time`、`end_time`、`remote_lock`、`three_phase_unbalanced` 这类字段**已经有了**，
不同模块的表单直接复用同一条，不要因为「这次是逆变器的」就再造一个。

**复用优先级**：完全同义 → 直接用现成 key；含义接近但措辞需微调 → 找人确认是改现有条目还是真的要新增。

### 2. key 名用英文 snake_case，绝不能用中文

```
✅ rrcr_control_area
❌ RRCR控制区域        ← 真实发生过，导致该字段在所有语种下都显示这串中文
```

全小写、下划线分隔、只用 ASCII。key 名本身**永远不会显示给用户**，它只是查表用的标识。

### 3. key 名要自足，因为没有模块前缀兜底

一个平面里 150+ 个 key，`mode` / `value` / `setting` 这种泛名一定会撞车或产生歧义。

```
✅ battery_charge_mode          ✅ apparent_power_limit_value
❌ mode                         ❌ limit
```

沿用仓库里已有的后缀习惯：`_tip`（提示/tooltip，15 处）、`_enable`（开关，8 处）、
`_setting(s)`（8 处）、`_mode`、`_value`、`_limit`。帮助文本用 `_description`。

### 4. 占位符是单花括号

```json
✅ { "charge_window": "{count} 个充电时段" }
❌ { "charge_window": "{{count}} 个充电时段" }
```

宿主配置为 `interpolation: { prefix: '{', suffix: '}' }`，双花括号**不会生效**，
用户会看到字面的 `{{count}}`。

### 5. 占位符名绝不能翻译

```json
// en-US
{ "coverage": "{country} / {model}" }

// de-DE  ❌ 变量名被翻译了
{ "coverage": "{Land} / {model}" }

// de-DE  ✅
{ "coverage": "{country} / {model}" }
```

各语种的占位符集合必须与 `en-US` **完全一致**，数量、名字、大小写都要对上。

### 6. 一次交齐 11 个语种的真译文

`en-US` 是源，缺了它 CI 会按「多余 key」报错。其余 10 个语种**同一个 PR 里一并写齐真译文**，
不要只交英文占位留给以后优化。

### 7. 只改被指定的 key

不要顺手优化别的条目。看到别处有问题，写进交付报告的「范围外发现的问题」，别动手。

### 8. 不要手工排序，不要动格式

```bash
node tools/sort-keys.mjs --write     # 唯一正确的排序方式
```

### 9. 不许碰的

- `locales/product-config/*` —— 那里还留着迁移前的旧副本，**是为了能回滚而刻意保留的**，
  改它不生效，也不要顺手删
- `.ci/baseline.json` —— 存量欠账豁免清单，不是绕过 CI 的逃生舱
- `languages.json`、`tools/lib/core.mjs`

---

## 译文质量：怎么锚定

1. **读 `glossary/terms.json`**，摘出与本批内容相关的术语，按 `preferred` 译法走，
   `dnt: true` 的概念保持原文不翻
2. **读 `locales/dynamic-form/zh-CN.json` 当语气参照** —— 它是译文最完整的目标语种
3. **同类字段对齐措辞**：新增 `xxx_enable` 时，看看现有的 8 个 `_enable` 怎么译的，别自成一派
4. **长度**：表单标签尽量短，德语/荷兰语的复合词容易撑破布局，必要时用缩写或拆词

---

## 步骤

1. 读 `locales/dynamic-form/en-US.json`，**先做第 1 条的查重**，把结论写进报告
2. 读 `locales/dynamic-form/zh-CN.json` 当语气参照
3. 读 `glossary/terms.json`，摘出相关术语
4. 确定最终的 key 列表与英文原文（查重后如果建议复用现成 key，先报给人确认，别自己决定）
5. 逐个语种改 `locales/dynamic-form/<lang>.json`，11 个文件都要改
6. 跑自检
7. 按「交付格式」报告，然后自己建分支开 PR

## 自检（必须跑，必须通过）

```bash
node tools/sort-keys.mjs --write
node tools/validate.mjs
```

`validate.mjs` 必须输出「校验通过」。它会检查 JSON 语法、11 语种 key 集合对齐、
占位符一致性、双花括号、禁止嵌套、key 顺序。

## 校验通过后：自己开 PR

```bash
git switch -c feat/ANTELOPE-XXXX-dynamic-form-xxx origin/main
git add -A
git commit -m "feat(dynamic-form): ANTELOPE-XXXX 新增 xxx 字段文案"
git push -u origin feat/ANTELOPE-XXXX-dynamic-form-xxx
gh pr create --base main ...
```

动手前先 `git fetch origin main`，确认不是基于过时快照。

## 🚫 你不做的事

- **绝不合并 PR** —— 合并永远是人点
- 不改 `locales/product-config/*`
- 不改 admin 里的表单配置（那是产品同事在页面上操作的，不在本仓库）
- 不往 `.ci/baseline.json` 加条目

---

## ⏱ 合并之后还有一步（告诉提需求的人）

译文合并 ≠ 立刻能用。antelope-web 是**构建时**把译文打进产物的，所以：

```
本仓库 PR 合并
  → antelope-web 更新 submodule 指针并重新构建部署
  → admin 的编辑器里才选得到这个新 key
```

在那之前，产品同事可以**在 admin 里直接手输 key 名**，编辑器会把它标成「待发版」而不是报错，
配置能正常保存。

---

## 交付格式

报告里按顺序给出：

### 查重结论

新增的每个 key，说明「搜过什么、有没有近似的现成条目、为什么还是要新增」。
如果建议复用现成 key 而不是新增，明确说出来。

### 改了什么

| key | en-US | 用在哪个表单字段 | 新增/修改 |
|---|---|---|---|

### 校验结果

`sort-keys` 与 `validate` 的输出。

### 拿不准的条目

哪些语种/哪些词你没把握，为什么。

### 范围外发现的问题（未改动）

### 建议补进术语库的概念

---

## 参数（由人填写）

```
任务类型：
  □ 新增字段文案    □ 修改已有字段文案

要新增/修改的内容（每条一行：英文原文 + 它是什么）：
  例：Bypass Switch          逆变器旁路开关的字段标签
      Enable the bypass when grid is unstable.    上面那个开关的提示文本

建议的 key 名（可留空，让 AI 按命名规范拟）：
  例：bypass_enable, bypass_enable_tip

这些字段出现在哪：
  例：admin 产品配置 → 硬件配置 → 逆变器旁路，最终渲染在 customer 端设备设置页

目标语种：
  例：全部 10 个        （默认就是全部，一次交齐）

特殊要求：
  例：标签要短，德语别超过 24 字符，布局是两列栅格
```
