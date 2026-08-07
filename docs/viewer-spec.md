# GitHub Pages 只读查看页 · 实现规格

> 状态：**已实现**（`viewer/` + `.github/workflows/viewer.yml`）· 最后更新：2026-07-30
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
| ~~状态~~ | ~~读 `_meta/<ns>.json` 的 `draft` 标记~~ | ⏸ 暂不做 |

- **虚拟滚动**，5,882 行；行高固定 37px（单元格截断而非换行，避免动态测高）
- 搜索框：命中 ns / key / en-US / **任意已选语种的值**
- 「仅看缺失」开关：只留已选语种里缺译文的行
- 占位符高亮：单花括号 `{name}` 蓝色，双花括号 `{{name}}` **标红**（本项目配置下插值失效）

> **⏸ 为什么暂不做 draft 状态列**：`_meta/` 目前只有 `.gitkeep`，一条标记都还没有 —— 现在做出来
> 整列是空的，反而像 bug。等 `fill-missing` 真正写入 `_meta` 之后再加，数据契约里已留好位置。

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

### 4.4 术语库 Tab

读 `glossary/terms.json`，展示概念 / 各语种 preferred / deprecated / DNT 标记。

### 4.5 存量欠账 Tab

读 `.ci/baseline.json`，把 123 条历史问题列出来（缺失 105 / 多余 2 / 双括号 2 / 占位符不一致 14）。

**这是给 PM 的待办清单** —— 比让他们去读 JSON 强得多。每修一条从 baseline 删一条，这个 Tab 会自然清空。

### 4.5b 帮助 Tab

纯静态说明页，不读任何数据文件（只用 `manifest.repo` 拼链接）。**按「你是谁 + 你要做哪种事」
分流，不是按文档目录罗列。** 顶部一个角色切换（产品 / 后端），各出两张卡：

| 角色 | 场景 | 页面给什么 |
|---|---|---|
| 产品 | 改一条 / 几条译文 | github.dev 三步 + 怎么从主表格定位到 ns 文件 |
| 产品 | 批量校订 | 导出 → 改表 → **一键复制的「任务 B」话术** + 主键/增删 key 的警告 |
| 后端 | 改一条错误码 | github.dev 三步 + 直达编辑链接 |
| 后端 | 新增 code / 全语种改动 | **一键复制的「任务 A」话术** + 委托单链接 |

两个 AI 卡片是这个 Tab 存在的理由：一条 key 要落在 11 个语种文件里，手工做既慢又容易错。
话术都指向 [docs/ai-agent-brief.md](ai-agent-brief.md)，规则全在那份文档里，页面上不重复。

产品的批量卡之所以也导向 AI：**Excel 导入回写尚未实现**（README「后续待建」），
导出 → 人工处理 → AI 回写是当前唯一的批量路径。导入做出来后这张卡要改。

⚠️ 页面文案与 `docs/backend-guide.md`、`docs/ai-agent-brief.md` 是同一套说法的不同载体，
**改一处要同步其余两处**。

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
- [x] **帮助 Tab**：产品 / 后端角色切换、四个场景分流、AI 委托话术可一键复制（§4.5b）
- [x] 导出：Excel / JSON × 当前筛选 / 全部语种，纯前端生成
- [x] `validate.yml` 仍保持零安装（依赖只在 `viewer/` 内）
- [ ] 首次部署后打开线上地址，确认表格能渲染、导出能下载
- ⏸ `_meta` 的 `draft` 标记 —— 暂不做，见 §4.1
- [ ] 「禁存非 UI 文案」已写进使用规范（§7）
