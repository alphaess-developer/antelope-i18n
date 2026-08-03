# 决策记录

> 最后更新：2026-07-30
> **本文档记录「为什么是这样」以及「哪些方案已被否决」。** 提新方案前先看一眼 §2 —— 大概率已经讨论过了。
> 完整的设计推导过程见 `translation-platform/docs/refactor/plan-b.md`（本仓库不需要它也能运作）。

## 1. 已定

### D1 · 试点范围 = antelope 业务线整体

`antelope` 是一条**业务线**，对应旧 TMS 里**一个 platform**（`alpha-antelope`），包含 `antelope-web` 的 5 个 app（`admin` / `business` / `customer` / `portal` / `users-center`）。**5 个 app 共用同一套 ns 与同一份翻译文件。**

不在范围内的是户用、工商业等其他业务线 —— 它们是各自独立的 platform，继续用旧 TMS。

### D2 · 加载方式 = 一次性全量构建时注入

宿主项目在**构建时**把译文打进产物，不是运行时拉取。切换是一次性的，不分批。

**为什么不能按 app 分步**：`antelope-web` 的 apps 是薄壳，页面几乎全在 `packages/shared/src/pages/`，`initI18n` 也在 shared。改一次就影响全部 5 个 app —— **不存在「先切一个 app」的中间状态**。

**顺带收益**：现有配置是 `useSuspense: true` + `http-backend`，首屏要等翻译请求回来才能渲染。构建时注入消掉了这个等待。

### D3 · 基准语言 = `en-US`

不是 `en`。存量导出确认无 `en`/`en-US` 混用。新文案先写英文。

### D4 · error-code 不特殊处理

**加载方式**：与其他 ns 一样构建时注入。后端加错误码要等前端发版；急用时走 `99999` + `error` 逃生舱。

**目录位置**：保持 `locales/dictionaries/error-code/` 不变。

详细理由见 §2.1 与 §2.2。

### D5 · 文件组织的四条规则

| 规则 | 为什么 |
|---|---|
| 一个 ns 一个目录，一个语种一个文件 | 改不同功能就改不同文件 → 冲突概率最低 |
| 文件内**一层扁平**，值必须是字符串 | 嵌套结构的 merge 冲突常落在括号层级上，合并后易产生语法错 |
| key 走 `canonicalKeyOrder`（**不是字典序**） | 新增 key 落在不同行 → git 自动合并；数字 key 必须按数值排，见 §3.1 |
| **文件路径严格等于 ns 名** | 构建时注入的 glob 查表、i18n Ally 的 pathMatcher、CI 校验三者共同依赖 |

### D6 · submodule 而非 npm package

宿主项目用 `git submodule` 引入，挂在仓库根的 `i18n/`。

**为什么不用 npm package**：submodule 让文件路径落在宿主仓库工作区内 → **i18n Ally 零配置就能扫到**，这正是「开发时看不到译文」这个痛点的解法。npm package 方案下要把 `localesPaths` 指向 `node_modules`，且改翻译后要重装才可见。

submodule 的版本管理负担由自动化消除（i18n 仓库更新后自动向宿主项目开 bump PR）。

### D7 · `.ci/baseline.json` 豁免机制

记录迁移带来的 **123 条历史欠账**，CI 对清单内条目放行；**新增内容不受豁免**。

**为什么需要**：不做豁免，首次 CI 必红。而一个长期红的 CI 会让团队学会绕过检查 —— 那比没有检查更糟。这是给遗留数据引入 linter 的标准做法。

⚠️ **绝不许为了让 CI 变绿往 baseline 里加新条目。** 见 `CLAUDE.md` 硬规则 6。

### D8 · `fill-missing` 用英文占位，不在 CI 调 AI

后端/PM 只加基准语言，其余 10 个语种由 workflow 自动用英文占位补齐，并在 `_meta` 标 draft。

**为什么用英文占位而非留空**：宿主项目配置 `fallbackLng: false`，缺 key 会**直接把 key 名显示给用户**。显示英文远好于显示 `some_key_name`。

**为什么不在 CI 调 AI**：不需要配密钥；英文占位是可接受的降级，与「产品持续优化」的工作流一致。

### D9 · viewer 只读，编辑走 github.dev

GitHub Pages 是纯静态托管，没有服务端。静态页要写仓库需要 OAuth token 交换 → 需要服务端 → 破了「零后端」前提。

而「登录且有仓库权限才能编辑」这个能力 **github.dev 已经免费提供**（在仓库页面按 `.` 键）。

### D10 · Pages 公开 + 禁存非 UI 文案

viewer 用公开 Pages。理由：译文最终会出现在公开前端 bundle 与 CDN Blob 里，本无机密性。

**因此产生一条硬性约束**：严禁把任何非 UI 文案（密钥、内部标识、未公开产品名、客户信息）放进翻译库。

### D11 · 强制 LF（`.gitattributes`）

本仓库会被多方编辑：Windows 本地 / github.dev 浏览器 / CI 脚本。放任换行符自动转换会产生「整文件 diff」这种纯噪音，也会让迁移日「重新导出覆盖」的 diff 无法阅读。

### D12 · 工具零依赖

`tools/*.mjs` 只用 `node:` 内置模块。好处：CI 不需要 `npm install`，校验几秒跑完；贡献者装了 Node 20+ 就能本地跑。

viewer 的前端依赖**只装在 `viewer/` 内**（自带 `package.json` 与 lockfile），viewer workflow 单独
`working-directory: viewer` 跑 `npm ci`，**`validate.yml` 保持零安装**。
`tools/build-viewer-data.mjs` 本身仍是零依赖的。

### D13 · viewer 用 shadcn/ui，因此放弃「自包含单 HTML」，改按语种懒加载

`viewer-spec.md` 原先建议方案 A：把 CSS/JS/全部译文内联成一个 HTML（960 KB gzip），换来「零资源路径问题」。

**选了 shadcn/ui 之后这个前提消失了** —— shadcn = React + Tailwind + Radix，必须走打包器，
产物必然是 `index.html + assets/*.js|css` 多文件。自包含带来的好处一个都留不下。

既然已经有外链资源，按语种拆分懒加载就不再有额外代价，于是同时改掉加载策略：

```
首屏  manifest + base.json + 默认对照语种   ≈ 160 KB gzip（数据）+ 123 KB（JS/CSS）
其余 9 个语种   选中时才 fetch
SheetJS         点导出才 fetch（独立 chunk，gzip 161 KB）
```

代价是必须正确处理子路径：`vite.config.ts` 的 `base` 与 `fetch` 用的 `import.meta.env.BASE_URL`
两处都不能漏。见 `viewer-spec.md` §6。

**这条同时结掉了原「待决 #2」**（viewer 加载策略）。

### D14 · 导出纯前端生成，不预生成 xlsx

原方案是构建期生成 `dist/translations.xlsx` 供下载。改成浏览器内用 SheetJS 生成，因为：

1. 构建期产物只能是**全量快照**，而 PM 真正要的是「德语里缺的那些」这种**当前筛选结果**
2. CI 不必为生成 Excel 装依赖 —— D12 的顾虑自然消失

SheetJS 装的是**官方 CDN 的 0.20.3 tarball**，不是 npm 上停更于 2022 年的 `xlsx@0.18.5`。
后者带 parse 路径的安全告警，会让 `npm audit` 长期发红 —— 而长期红的检查会让团队学会忽略检查
（同 D7 的逻辑）。代价是 CI 的 `npm ci` 需要能访问 cdn.sheetjs.com。

### D15 · viewer 暂不做 draft 状态列

`viewer-spec.md` 原先要求主表格有一列读 `_meta/<ns>.json` 的 `draft` 标记。

**暂不做**：`_meta/` 目前只有 `.gitkeep`，一条标记都还没写入 —— 现在做出来整列是空的，反而像 bug。
等 `fill-missing` 真正往 `_meta` 写标记之后再加；数据契约里已经留好位置。

### D16 · 字典有独立 Tab，且与错误码 Tab 分开

`dictionaries/*` 的 ns 名由 `dictToNs()` 从字典 code 推导、key 由 `dictToKey()` 产生 ——
**每一行都对着 antelope 数据字典里的一条**。联动维护需要一个单一入口，散在 5,882 行主表格里
找不到。所以除错误码外的 16 个字典（310 条）合成一个 Tab，左侧列表 + 右侧内容。

**为什么不把错误码也并进去**：错误码 524 条、是后端同事的工作面、还有数值排序与三个特殊 key
这套专属规则（`viewer-spec.md` §4.3）。524 : 310 的体量差会让侧栏被它一条占满，两套规则混在
一个表里也会互相干扰 —— 合并会把两个 Tab 都变难用。字典 Tab 的侧栏底部放一句指路解决可发现性，
这与 §2.2「可发现性不该靠目录深度解决」是同一个思路。

---

## 2. 已否决（别再提了）

### 2.1 ❌ 混合加载：error-code 保留运行时拉取

**方案**：`dictionaries/error-code` 继续从远程拉，其余 ns 构建时注入。这样后端加错误码不用等前端发版。

**为什么否决**：要维护一个远程源 + 两套加载机制，而收益被既有的三层兜底大幅抵消 ——

```ts
// packages/shared/src/hooks/useFetch.tsx
tE('0000', { errorCode, defaultValue: 'System Error' })   // ① 通用兜底，用户能看到错误码
code === '99999' → 直接用后端 error 文本                   // ② 逃生舱
tE(code, { ...params, defaultValue: systemError })        // ③ 缺 key 不显示裸 key
```

缺译文的表现是「通用提示 + 错误码数字」，不是白屏也不是裸 key；`99999` 覆盖真正紧急的场景。为此单独维护一套运行时加载不划算。

### 2.2 ❌ 把 error-code 挪到独立目录

| 提过的方案 | 为什么否决 |
|---|---|
| 上移到 `locales/error-codes/` | `locales/` 下有约 40 个同级目录，从「dictionaries 的子目录」变成「40 个之一」，**并没有更好找** |
| 与 `locales/` 平级独立一层 | 留下四处永久特例：glob 加第二模式、`listNamespaces()` 扫两个根、CI 校验同上，**而 i18n Ally 的 `pathMatcher` 是单值配置，会让编辑器插件对错误码失效** —— 那正是本方案要解决的核心痛点 |

**可发现性不该靠目录深度解决。** 真正起作用的三样都与路径无关：

1. **直达链接** —— 给后端一个书签，而不是让他们浏览目录
2. **CODEOWNERS** —— 改该目录自动 request 双方 review
3. **自动补齐语种** —— 消除「要填 11 个语种」这个真正的摩擦点

附带好处：维持原路径让宿主项目**零代码改动**。

### 2.3 ❌ Translation Memory（翻译记忆库）

**方案**：建一个 TM，整条文案译过一次别处复用，跨 ns 自动填充。

**为什么否决**：业务线内部 5 个 app **共享同一份翻译文件**，一致性是文件层面天然保证的 —— 不存在「两处各译一遍」的场景。

TM 的真正价值在**跨业务线**（如「电站」在户用译 `System`、在工商业译 `Plant`，需要建议而非强制）。那是本仓库范围之外的事。

**保留的替代品**：CI 的「同源文异译」警告（同一句英文在不同 ns 译法不一致），当前 126 组，供逐步清理。

### 2.4 ❌ 跨项目引用机制（`common` 共享）

**方案**：建 `shared` 源 + 引用表 + 发布期合并，让多个项目共用一份 `common`。

**为什么否决**：同 §2.3 —— 业务线内本来就共用一份文件。引用机制要三条规则同时正确（冲突优先级、路径解析、时间戳联动），全是 bug 温床，而收益为零。

### 2.5 ❌ 按 app 或按 ns 分批切换

见 D2 —— 代码结构不支持按 app 分步；而既然一次性切换可行，按 ns 分批只是徒增管理成本。

### 2.6 🅿️ 可写 viewer（挂起，非否决）

现阶段不做（见 D9）。将来若要做，三条路成本递减：

| 方案 | 代价 |
|---|---|
| OAuth broker（Decap CMS 模式） | 部署一个约 20 行的无状态函数做 token 交换 —— 破了零后端，但不存数据、不需运维 |
| OAuth Device Flow | 不需要 client secret，但**浏览器直连 token 端点的 CORS 需实测** |
| 让用户粘贴细粒度 PAT | 最土但零基础设施 |

**动手前先评估 inlang 的 Fink** —— 它是专门做「在 git 里编辑 i18n 文件」的现成 web 编辑器。同时值得看 **Sherlock**（IDE 插件）与 **Paraglide**（编译式运行时）。

---

## 3. 实施中踩到的坑（已解决，勿回退）

### 3.1 JS 整数键会被强制按数值排序

`dictionaries/error-code` 的 key 是错误码数字。**JS 引擎把规范整数键强制按数值升序排到对象最前**，与文件书写顺序无关：

```
实际迭代序: '0','1','2','100','400',…,'601001', 然后才是 '0000','Username cannot be changed'
字典序:     '0','0000','1','100','100000',…                    ← 永远对不上
```

`'0000'` 有前导零，不是规范整数键，所以排在后面。

**所以 key 排序检查不能用字典序** —— 否则 error-code 的校验永远无法通过。`canonicalKeyOrder()` 让「文件顺序 = JS 实际迭代顺序」：整数键按数值升序，其余按字典序。见 `tools/lib/core.mjs`。

### 3.2 换行符会毁掉迁移日的 diff

见 D11。若没有 `.gitattributes`，Git 会把 LF 转 CRLF，导致整文件 diff。

### 3.3 存量数据里已有 14 处占位符被翻译

```
business-home:coverage_country_model
  en-US:  {country} {model}
  de-DE:  {Land}    {model}   ← 变量名被翻成德语
  cs-CZ:  {země}    fr-FR: {pays}   it-IT: {paese}   pl-PL: {kraj} …
```

外加 `basic-settings/audit-logs:num_changes`（el-GR 译成 `{αριθμός}`）和 `dictionaries/error-code:6074`。

**这些在生产环境已经显示为字面量。** 已记入 baseline，CI 的阻塞级检查会拦住新增的同类问题。

### 3.4 存量数据里有 2 处双花括号

`common:range_min_max` 与 `ess/run-log:hidden_records_tip_n`，**11 个语种全是 `{{}}` 包括 en-US** —— 说明是写 key 时按 i18next 默认习惯写错了，插值在生产环境**当前就是失效的**。

---

### 3.5 聚合行数「5,927」与 viewer 显示的「5,926」差 1

不是 bug，是两种口径：

| 口径 | 数 |
|---|---|
| 各语种 key 的**并集** | 5,927（`CLAUDE.md`、`README.md` 用的是这个） |
| 以 **en-US 为准**（viewer 的 `base.json`） | 5,926 |

差的那一条是 `dictionaries/product_config::auxdry_contact_control_status` —— 它**只存在于 sv-SE 与
zh-CN，en-US 里没有**（`.ci/baseline.json` 的 `extraKeys` 两条就是它）。

viewer 的主表格以基准语言为骨架，所以看不到这条；它出现在**存量欠账 Tab 的「多余 key」**里。
修掉那条欠账后两个数字会一致。

## 4. 待决 / 待办

| # | 事项 | 影响 |
|---|---|---|
| 1 | `.github/CODEOWNERS` 的用户名目前全指向一人 | 错误码那条本意是「后端 + 前端双 review」，后端同事就位后需补上 |
| 2 | ~~viewer 的加载策略~~ | ✅ 已定，见 D13：按语种懒加载 |
| 3 | 123 条存量欠账何时修 | 建议在**迁移日之前回翻译平台修** —— 迁移日会重新导出覆盖，现在在 git 里修会被冲掉 |
| 4 | Excel 往返、glossary-prompt、自动 bump PR | 见 `README.md` 的「后续待建」 |
| 5 | **首次启用 Pages 需人工操作一次** | Settings → Pages → Source 设为 GitHub Actions，不做 workflow 会失败。见 `viewer-spec.md` §5 |
| 6 | `_meta` 的 draft 标记落地后补上 viewer 的状态列 | 见 D15 |
