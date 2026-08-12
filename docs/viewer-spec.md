# GitHub Pages 只读查看页 · 实现规格

> 状态：**已实现**（`viewer/` + `.github/workflows/viewer.yml`）· 最后更新：2026-08-05
> **本文档自包含** —— 实现时不需要去查其他仓库。设计溯源见 `translation-platform/docs/refactor/plan-b.md` §13。
>
> ⚠️ 本文档在实现后做过一轮修订：**加载策略改为按语种懒加载**（§2）、**导出改为纯前端生成**（§4.6）、
> **技术栈改为 Vite + React + shadcn/ui**（§3）。原先的「自包含单 HTML」方案已作废，理由见 `decisions.md` D13。

## 1. 目标与职责边界

给 PM、后端同事、译员一个**只读**的翻译总览页，能搜索、筛选、导出。

| 用途 | 用什么 | 权限由谁管 |
|---|---|---|
| 查看 / 搜索 / 导出 | **本查看页（GitHub Pages）** | 公开（见 §7） |
| **编辑** | **github.dev**（在仓库页面按 `.` 键） | **GitHub 自己**（登录 + Write 权限） |

### ⚠️ 为什么查看页不做编辑

GitHub Pages 是**纯静态托管，没有服务端**。静态页要写仓库，必须在浏览器里拿到 GitHub token → 需要 OAuth → 标准 OAuth 的 code 换 token 需要 client secret → **需要一个服务端**。那就破了「零后端」这个前提。

而「登录且有仓库权限才能编辑」这个能力 **github.dev 已经免费提供**，不需要自建。所以：**查看页只读，编辑走 github.dev。**

若将来确实要可写查看页，三条路（成本递减）：OAuth broker（部署一个约 20 行的无状态函数做 token 交换）／ OAuth Device Flow（不需要 client secret，但浏览器直连 token 端点的 CORS 需实测）／ 让用户粘贴细粒度 PAT。动手前先评估 inlang 的 **Fink** —— 它就是专门做「在 git 里编辑 i18n 文件」的现成 web 编辑器。

## 2. ✅ 已定：按语种懒加载

引入 shadcn/ui 就必须上打包器，产物必然是「index.html + assets/」多文件 ——「自包含单 HTML」这个前提
本身消失了（见 `decisions.md` D13）。既然已经有外链资源，按语种拆分懒加载就不再有额外代价，于是选它。

实测产物（2026-07-30，140 ns × 11 语种，`node tools/build-viewer-data.mjs`）：

| 文件 | 原始 | gzip | 何时加载 |
|---|---|---|---|
| `manifest.json` | 7 KB | 2 KB | 首屏 |
| `base.json`（en-US 全量 5,882 行） | 343 KB | 91 KB | 首屏 |
| `glossary.json` + `baseline.json` | 21 KB | ~4 KB | 首屏 |
| `lang/<lang>.json` × 10 | 2,525 KB | 673 KB | **仅选中该对照语种时** |

```
首屏（含默认对照语种 zh-CN）   ≈ 160 KB gzip
全 11 语种（点「全部语种」导出时才拉齐）  ≈ 770 KB gzip
```

加上 JS/CSS（gzip 115 KB + 8 KB），首屏总计约 285 KB gzip。SheetJS 是独立 chunk（gzip 161 KB），
**只有点了导出才下载**。

### 🔴 base.json 必须是数组

`dictionaries/error-code` 的 key 是错误码数字，**JS 引擎会把规范整数键强制按数值升序排到对象最前**。
若把行存成以 `"ns::key"` 为键的对象，前端 `JSON.parse` 后拿到的顺序就不是文件顺序，排序会凭空跑掉。

所以数据契约是：`base.json` 用**数组**保序，`lang/<lang>.json` 是与之**按下标对齐的值数组**（缺 key 为 `null`）。
见 `decisions.md` §3.1。

## 3. 技术栈与产物形态

```
tools/build-viewer-data.mjs        零依赖数据生成脚本（复用 tools/lib/core.mjs）
        ↓ 产出
viewer/public/data/                ← 被 .gitignore，派生产物不入库
        ↓ vite build
viewer/dist/                       ← 上传给 Pages 的目录
├── index.html
├── assets/index-*.js|css          应用代码
├── assets/xlsx-*.js               SheetJS，动态 import 的独立 chunk
├── assets/geist-*.woff2           自托管字体（无任何外部 CDN 请求）
└── data/                          原样拷贝的数据文件
```

| 层 | 选型 | 说明 |
|---|---|---|
| 数据生成 | Node ESM，**零依赖** | 沿用现有工具风格：`node:` 内置模块、中文注释、JSDoc |
| 构建 | Vite + React + TS | `base: '/antelope-i18n/'`，见 §6 |
| UI | **Tailwind 4 + shadcn/ui**（radix base） | 组件源码在 `viewer/src/components/ui/` |
| 虚拟滚动 | `@tanstack/react-virtual` | 5,882 行必须虚拟滚动 |
| Excel | **SheetJS 0.20.3**，动态 `import()` | 见下方说明 |

> **依赖只装在 `viewer/` 内**：根目录 `package.json` 保持零依赖，`validate.yml` 因此仍然不需要
> `npm install`，几秒跑完（`decisions.md` D12）。viewer workflow 单独在 `viewer/` 里 `npm ci`。

> **为什么 SheetJS 装的是官方 CDN 的 tarball 而不是 npm 上的 `xlsx`**：npm 上那个停在 2022 年的
> `0.18.5` 带 parse 路径的安全告警，会让 `npm audit` 长期发红 —— 而一个长期红的检查会让团队学会
> 忽略检查。装 `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` 是 SheetJS 官方现在的分发方式，
> `package-lock.json` 会记下 integrity 哈希。**代价**：CI 的 `npm ci` 需要能访问 cdn.sheetjs.com。
>
> 另注：冻结首行（`!freeze`）是 SheetJS Pro 的功能，社区版写不出来，别加 —— 那是个无声的空操作。

## 4. 页面需求

### 4.1 主表格

| 列 | 说明 | 状态 |
|---|---|---|
| namespace | 作为**分组表头行**出现，点击折叠/展开该 ns | ✅ |
| key | 等宽字体，超长截断 + `title` 悬浮显示全文 | ✅ |
| `en-US`（基准） | 始终显示，占位符高亮 | ✅ |
| 对照语种 | 下拉勾选，选中时才 fetch 该语种数据 | ✅ |
| ~~状态~~ | ~~读 `_meta/<ns>.json` 的 `draft` 标记~~ | ❌ 已取消 |

- **虚拟滚动**，5,882 行；行高固定 37px（单元格截断而非换行，避免动态测高）
- 搜索框：命中 ns / key / en-US / **任意已选语种的值**
- 「仅看缺失」开关：只留已选语种里缺译文的行
- 占位符高亮：单花括号 `{name}` 蓝色，双花括号 `{{name}}` **标红**（本项目配置下插值失效）

> **❌ 状态列已取消**：它依赖的 `_meta/` draft 标记机制**整体移除了** —— 那套机制需要前端/后端/产品
> 三方长期按同一约定维护，而这个协作约定落实不下来（`decisions.md` D15）。数据契约里也不再留位置：
> `build-viewer-data.mjs` 与 `viewer/src/` 对 `_meta` 零引用。
> 要重做先谈定维护责任，再回来改数据契约。

> **按 ns 前缀筛选**没有单独做控件 —— 搜索框本身就命中 ns 名，再加一个输入框只会让人困惑。
> 140 个 ns 的下拉列表也不比直接搜好用。

### 4.2 字典 Tab —— 与 antelope 数据字典联动维护的入口

`dictionaries/*` 下有 17 个 ns，除错误码外的 **16 个字典、310 条**。这些 ns 名由宿主项目的
`dictToNs()` 从字典 code 推导，key 由 `dictToKey()` 产生 —— **每一行都对着数据字典里的一条**，
所以需要一个单一入口，而不是散在 5,882 行主表格里。

```
这些字典与 antelope 数据字典一一对应：ns 名由 dictToNs()、key 由 dictToKey() 推导，改名等于改 key
┌─────────────────┬─────────────────────────────────────────┐
│ 16 个字典·310 条 │ dictionaries/product_config [编辑 en-US] │  ← 两张卡片上边缘对齐
├─────────────────┼─────────────────────────────────────────┤
│ ▸ product_config│ ac_power_supply_mode     AC power supply │
│ ▸ region      4 │   ·.grid                 Grid power     │
│ ▸ instruction   │   ·.diesel_generator     Diesel engine  │
│ …               │                                         │
└─────────────────┴─────────────────────────────────────────┘
 错误码见独立 Tab
```

- 左侧列出全部字典及条数，选中后右侧看内容；搜索、对照语种、导出全部沿用主表格那套
- **key 的两级结构可见**：`parent.child` 的父级前缀压暗并缩进一格。
  文件里仍是一层扁平 JSON，只是 key 字符串带点号（`CLAUDE.md` 硬规则 7）
- 每个字典一个直达编辑链接

> **两处布局上的讲究**（改动前先想清楚再动）：
>
> 1. 「N 个字典 · 共 M 条」放在**左侧卡片内部**当表头。放在卡片外面当标题，会把左卡片整体推低，
>    与右侧卡片上边缘错开一行。两侧 muted 色带也统一成 `min-h-11`，并排时高度不同很明显。
> 2. 「ns 名由 dictToNs() 推导」那段说明是**整个 Tab 的说明，不随选中的字典变化**，所以放在两列
>    之上。放在右侧卡片里选中项标题的下方，会被读成「这一项的 description」—— 但它其实一直不变。

> **错误码不在这个 Tab 里**，它有自己的 §4.3 —— 524 条、是后端同事的工作面、还有数值排序等
> 一套专属规则。混进来会把两个都变难用。字典 Tab 的侧栏底部有一句指路。

### 4.3 错误码独立 Tab

`dictionaries/error-code` 有 524 条，是后端同事的主要工作面，**单独一个 Tab**，不要混在主表里。

该 Tab 的特殊处理：

- key 按**数值**排序（不是字典序 —— 见 `CLAUDE.md` 硬规则 4）
- 显眼标出三个特殊 key：`0000`（通用兜底）、`99999`（后端直接返回文案）、`Username cannot be changed`（历史遗留）
- 高亮显示占位符（`{0}` `{sn}` 等），因为**占位符写错是这里最容易出的问题**
- 页面顶部放一句指引 + 直达编辑链接：
  ```
  https://github.com/alphaess-developer/antelope-i18n/blob/main/locales/dictionaries/error-code/en-US.json
  ```

### 4.3.1 动态表单 Tab —— 产品同事的主要工作面

`dynamic-form` 是**单一 ns**（147 条），antelope-web 的 `JsonSchemaEditor` / `JsonSchemaForm`
全部以它为 `i18nNs` —— 产品同事在编辑器里给字段挑国际化 key 时，候选就是这里的 key。

单 ns 而不按模块拆，是 ANTELOPE-6127 对 167 条已存储 schema 对账后的结论：模块
（battery / hardware / inverter …）是 admin 的**页面**边界、不是**字段语义**边界。
按模块拆会让 `maximum_grid_charging_power` 这类跨模块字段在多个 ns 各存一份（实测 8 组），
配置人员也频繁选到隔壁模块的 key（实测 5 处，后果是宿主用 label 兜底、非中文语言下静默显示中文）。

结构上是**单 ns Tab**，与错误码 Tab 同形（说明条 + 编辑链接 + `TranslationsView`，`showGroups={false}`），
**不用 `NamespaceBrowser`** —— 只有一个 ns，左侧列表只会有一项。

> **为什么没有「产品配置」Tab**：曾经有过（`product-config/` 前缀 + `NamespaceBrowser`）。
> 字段文案迁到 `dynamic-form` 后，那个前缀下只剩两类东西 —— 迁移时**刻意保留的旧副本**
> （173 条，为了能一键回滚，改了不生效）与 admin 各页面自身的静态文案（开发维护）。
> 对产品同事而言两类都是干扰，所以移除。`?ns=product-config/xxx` 会落到主表格并把 ns 当搜索词，
> 主表格本来就按 ns 分组，效果等同于筛出这个 ns。

Tab 里额外强调一件事：**合并后还要等宿主项目重新构建部署**，admin 的编辑器里才选得到新 key
（译文是构建期注入的，见 §1）。编辑器侧对这种「已合并未发版」的 key 会标成「待发版」而不是报错。

### 4.3.2 深链 —— 从 admin 直达某个 ns / key

地址栏参数只有两个，**没有 `tab`**：

| 参数 | 含义 |
|---|---|
| `ns` | 要定位的 namespace。落在哪个 Tab 由 `lib/deep-link.ts` 的 `tabForNs` 判定：先精确匹配 `dictionaries/error-code`、`dynamic-form`，再按 `dictionaries/`、`product-config/` 前缀，都不中则落主表格 |
| `q` | 预填进搜索框的词，通常是 key。主表格没有 ns 列表，此时 `ns` 也会当搜索词用 |

```
https://alphaess-developer.github.io/antelope-i18n/?ns=dynamic-form&q=bypass_enable
```

**为什么不把 tab 放进 URL**：tab 完全可由 ns 推导。不放进去，这里增减 Tab 时存量链接不会失效，
生成链接的一方（antelope-web admin）也不需要知道这里有哪些 Tab；参数没被识别的旧版本上会自然退化成首页。

🔴 `ns` 与 `q` 是**对外接口**，antelope-web 的
`apps/admin/src/components/json-schema-editor/utils.ts` 里的 `i18nViewerUrl()` 按这个格式拼链接。
改名要两边一起改。

地址栏由页面反过来维护（`history.replaceState`，不进历史记录 —— 否则「返回」会变成逐步倒放）：

- 落地时原样保留深链
- 点左侧 ns：写 `?ns=...`，同时丢掉 `q`（换了 ns，原来的搜索词就过期了）
- 切到带 ns 列表的 Tab：由该 Tab 写回自己选中的 ns
- 切到其它 Tab：清空参数，不留与所见不符的定位

### 4.4 术语库 Tab

读 `glossary/terms.json`，展示概念 / 各语种 preferred / deprecated / DNT 标记。

### 4.5 存量欠账 Tab

读 `.ci/baseline.json`，把 123 条历史问题列出来（缺失 105 / 多余 2 / 双括号 2 / 占位符不一致 14）。

**这是给 PM 的待办清单** —— 比让他们去读 JSON 强得多。每修一条从 baseline 删一条，这个 Tab 会自然清空。

### 4.6 导出 —— 纯前端生成

**不再预生成 `dist/translations.xlsx`。** 构建期产物只能是全量快照，而 PM 真正要的是
「德语里缺的那些」这种**当前筛选结果**。四个入口：

| 入口 | 内容 |
|---|---|
| Excel（当前筛选） | 当前搜索/筛选后的行 × 当前已选语种 |
| JSON（当前筛选） | 同上，`[{ ns, key, en-US, ... }]` |
| Excel（全部语种） | 当前筛选的行 × 全部 11 语种（点击时自动拉齐未加载的语种） |
| JSON（全部语种） | 同上 |

列：`namespace | key | en-US | 各已选语种…`。文件名带日期与 commit：`antelope-i18n-2026-07-30-ee196fc.xlsx`。

存量欠账 Tab 另有一个「导出 JSON」，导出当前筛选的欠账条目。

**顺带收益**：CI 不需要为生成 Excel 装依赖，`decisions.md` D12 的顾虑自然消失。

**主表格每个分组标题行上还有一个图标按钮，单独导出这一个 namespace**（PM 对某个功能模块走查时的高频需求 ——
不用先手动勾出这个 ns 的所有行）。用的还是同一个 `ExportMenu`，只是 `rows`/`indices` 换成传这一组的，
`scope` 换成该 ns 名（斜杠替换成短横线，避免文件名里出现路径分隔符）。

> 这**不是**在 §4.1 说的「按 ns 筛选的控件」—— 那条决策否决的是给搜索加一个重复的筛选输入框；
> 这里是导出场景下"就要这一个 ns"的精确诉求，复用已有的分组结构，没有新增控件。

字典 Tab 天然已有单 ns 导出效果：左侧选中一个字典后，右侧 `TranslationsView` 拿到的 `rows` 本来就只有
这一个 ns，工具栏「导出」导出的就是它。

### 4.7 帮助 Tab

页面内的操作说明，四节：

| 节 | 内容 |
|---|---|
| **三类任务**（三张并排卡片） | ① 走查并修正已有译文（定位 ns → 单 ns 导出 → Excel 走查 → 改 JSON）② 新增文案（11 语种真译文一次写齐）③ 新增/修正错误码（数值排序、位置参数不能改） |
| **写回仓库** | 共同步骤：网页编辑 / github.dev / **让 AI 提 PR** 三种方式 + `提 PR → CI → 合并 → 重新构建 → 生效` 流程条。第三种指向 `prompts/`，并写明**合并永远是人点**（`decisions.md` D17） |
| **必须遵守** | 四条 CI 阻塞级规则的正确/错误写法对照，外加 D10 的红线「严禁把非 UI 文案放进翻译库」 |
| **相关文档** | README / CLAUDE.md / translating / backend-guide / glossary-guide 直达链接 |

#### 🔴 按「要做什么」组织，不按「你是谁」

初版是「产品 / 后端走查修改指南」，**按身份分节 —— 已改掉**。理由：

同一个人可能既走查业务文案、又顺手加一条错误码。按身份切，会把**共同部分**
（怎么写回仓库、要守哪些约束）在每一节里各写一遍 —— 然后改一处就漏一处，两份说明慢慢互相矛盾。
所以共同部分抽成独立的两节，任务节只留各自特有的步骤。

> 「错误码」是一节，看着像是给后端划的，其实是按**内容类型**分的 —— 它有数值排序、
> 位置参数不能改序号这套专属规则，与谁来改无关。

##### 但「三类任务」那一节有身份筛选（2026-08-07 补）

标题旁三个小按钮：`全部` / `产品同事` / `后端同事`，选中后只显示相关的任务卡
（产品 → 走查 + 新增文案；后端 → 错误码）。

**这与上面那条不冲突**，因为上面反对的是**共同部分被复制成多份**，不是反对帮人快速定位：

| | 按身份分节（已否决） | 身份筛选（现在这样） |
|---|---|---|
| 共同部分 | 每个身份下各一份 → 改一处漏一处 | **只有一份**，不随筛选变化 |
| 任务卡 | 每份里重写一遍 | 同一份，只是隐藏不相关的 |

实现约束：筛选状态只能作用于任务卡的显示与否，**绝不允许**让「写回仓库 / 必须遵守 /
相关文档」三节随身份变化 —— 那才是被否决的形态。

#### 配色复用主表格的视觉词汇

正确/错误写法对照沿用 `PlaceholderText` 的语义：**中性底 = 正确**，**`destructive` = 在本项目会失效**。
用户在主表格里看到的 `{name}` 蓝底 / `{{name}}` 红底，和帮助页示例是同一套语言，不用二次学习。
好坏对照同时给**图标 + 底色**双重区分，不只靠颜色。

纯静态说明，不读数据文件，只用 `manifest.repo` 拼 GitHub 链接。放在最后一个 Tab，不影响默认打开的主表格。

## 5. 首次启用 Pages（一次性设置，最易漏）

```
仓库 → Settings → Pages → Build and deployment → Source → 选【GitHub Actions】
```

⚠️ **不做这一步，下面的 workflow 会直接失败**（报找不到 Pages 站点）。这是第一次用 Pages 最常见的卡点。

> Pages 有两种模式：**分支模式**（从 `gh-pages` 或 `/docs` 托管，会跑 Jekyll）和 **GitHub Actions 模式**（workflow 上传产物，**不经过 Jekyll**）。我们用后者，所以**不需要** `.nojekyll` 文件 —— 那是分支模式为了让下划线开头的目录不被忽略才要的。

## 6. URL 与子路径

部署后地址：

```
https://alphaess-developer.github.io/antelope-i18n/
                                     ^^^^^^^^^^^^^ 仓库名作为子路径
```

这叫**项目站点**。任何写成 `/assets/app.js` 的**绝对路径都会 404**。

两处处理，缺一个页面就白屏：

| 位置 | 写法 |
|---|---|
| `viewer/vite.config.ts` | `base: '/antelope-i18n/'` —— 打包器据此重写 index.html 里的资源引用 |
| `viewer/src/lib/data.ts` | `fetch(\`${import.meta.env.BASE_URL}data/...\`)` —— **不能**写成 `/data/...` |

验证方法：`viewer/dist/index.html` 里的 script/link 必须带 `/antelope-i18n/` 前缀。

字体是自托管的 woff2（`@fontsource-variable/geist`），**没有任何外部 CDN 请求** —— 内网环境也能正常显示。

## 7. 可见性

**关键限制**：「这个人有没有本仓库权限」只有 GitHub 自己能判断。任何第三方托管最多能判断「是否某个已登录账号」或「是否在我的名单里」。

| 方案 | 谁能看 | 成本 |
|---|---|---|
| **公开 Pages**（建议） | 任何拿到 URL 的人 | 零 |
| Azure SWA + 内置认证 | 登录 + 在邀请名单里（**不校验仓库权限**） | 低（团队已熟悉 SWA） |
| Enterprise 私有 Pages | 组织成员 / 有仓库读权限 | 取决于是否已有 Enterprise Cloud |

选公开的理由：译文最终会出现在公开前端 bundle 与 CDN Blob 里，本无机密性。

**因此产生一条硬性约束**：

> **严禁把任何非 UI 文案（密钥、内部标识、未公开产品名、客户信息）放进翻译库。**

⚠️ 私有仓库启用 Pages 需要付费计划，且**站点本身仍是公开的** —— 访问控制需 Enterprise 级别。若发现启不了或不接受公开，换 SWA。

> Pages 的计划限制与 SWA 认证提供方会调整，落地前核对当前官方文档。

## 8. Workflow

实际文件见 [`.github/workflows/viewer.yml`](../.github/workflows/viewer.yml)。三步：

```
npm ci（在 viewer/ 内）
  → node tools/build-viewer-data.mjs   生成 viewer/public/data/
  → npm run build（在 viewer/ 内）      产出 viewer/dist/
  → upload-pages-artifact path: viewer/dist → deploy-pages
```

五个容易漏的点：

| 项 | 漏了会怎样 |
|---|---|
| `permissions` 三项 | 缺 `pages: write` 或 `id-token: write` → deploy 步骤失败 |
| `environment: github-pages` | `deploy-pages` 报错 |
| `concurrency: group: pages` | 连续提交时多个部署冲突 |
| `paths` 过滤要含 `viewer/**` | 改 viewer 代码不会触发部署 |
| `npm ci` 的 `working-directory: viewer` | 在根目录跑会失败（根目录没有 lockfile 也没有依赖） |

> Action 大版本号会更新，落地时核对官方 README 的当前版本。

## 8.1 本地开发

```bash
npm --prefix viewer install     # 首次
npm --prefix viewer run dev     # predev 会自动先生成 data/
```

打开 **http://localhost:5173/antelope-i18n/** —— 注意带上子路径，`base` 在 dev 下同样生效。

```bash
node tools/build-viewer-data.mjs   # 只重新生成数据（改了 locales/ 之后）
npm --prefix viewer run build      # tsc --noEmit + vite build
```

## 9. 常见问题排查

| 现象 | 原因 / 处置 |
|---|---|
| deploy 报找不到 Pages 站点 | **Settings → Pages → Source 没设成 GitHub Actions**（§5） |
| deploy 报权限不足 | `permissions` 缺 `pages: write` 或 `id-token: write` |
| deploy 报缺少 environment | 没写 `environment: name: github-pages` |
| 页面空白 + 控制台一堆 404 | 子路径导致的资源路径问题 —— 检查 `base` 与 `BASE_URL`（§6） |
| 页面出来了但表格是「数据加载失败」 | `data/` 没生成或没被拷进 `dist/`；本地先跑 `node tools/build-viewer-data.mjs` |
| 部署成功但看到旧内容 | 浏览器 / CDN 缓存，强刷 `Ctrl+Shift+R`；等一两分钟 |
| 私有仓库无法启用 Pages | 计划限制（§7） |
| 多次提交后部署状态混乱 | 没配 `concurrency`（§8） |
| 表格卡顿 | 5,882 行没做虚拟滚动（§4.1） |
| `npm ci` 报拉不到 xlsx | 构建机访问不了 cdn.sheetjs.com（§3） |
| 错误码顺序错乱 | 把 `base.json` 改成了对象 —— 整数键会被 JS 重排（§2） |

## 10. 验收检查项

- [ ] **Settings → Pages → Source 已设为 GitHub Actions**（§5，最易漏，且只能人工做）
- [x] workflow 的 `permissions` 三项齐全 + `environment` + `concurrency` + `paths`（§8）
- [x] `dist/index.html` 的资源引用带 `/antelope-i18n/` 前缀（§6）
- [x] 无任何外部 CDN 请求（字体自托管）
- [x] 主表格：搜索命中 ns/key/任意已选语种值；虚拟滚动流畅
- [x] 对照语种按需加载（未选中的语种不产生请求）
- [x] **字典 Tab**：16 个字典的单一入口、key 两级结构可见、每个字典直达编辑链接（§4.2）
- [x] **错误码独立 Tab**：数值排序、三个特殊 key 标出、占位符高亮、直达编辑链接（§4.3）
- [x] 术语库 Tab、存量欠账 Tab（欠账数 123 = 105 + 2 + 2 + 14）
- [x] 导出：Excel / JSON × 当前筛选 / 全部语种，纯前端生成
- [x] 主表格分组标题行可单独导出这一个 namespace（§4.6）
- [x] **帮助 Tab**：按任务（非身份）组织的三类任务 + 共同的写回流程与约束 + 文档直达链接（§4.7）
- [x] `validate.yml` 仍保持零安装（依赖只在 `viewer/` 内）
- [ ] 首次部署后打开线上地址，确认表格能渲染、导出能下载
- ❌ `_meta` 的 `draft` 标记与状态列 —— 已取消，见 §4.1 与 `decisions.md` D15
- [x] 「禁存非 UI 文案」已写进使用规范 —— 作为红线写进**帮助 Tab 的「必须遵守」节**（§4.7），
      而不是只躺在文档里；这是最可能被真正读到的位置
