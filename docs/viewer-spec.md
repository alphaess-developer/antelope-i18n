# GitHub Pages 只读查看页 · 实现规格

> 状态：待实现 · 最后更新：2026-07-30
> **本文档自包含** —— 实现时不需要去查其他仓库。设计溯源见 `translation-platform/docs/refactor/plan-b.md` §13。

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

## 2. 🔴 先定：数据规模与加载策略

实测（2026-07-30，140 ns × 11 语种）：

```
聚合行数（ns × key）      5,883
全 11 语种内联            2.93 MB 原始  /  960 KB gzip
仅 en-US + 1 个对照语种    0.63 MB 原始  /  162 KB gzip
```

三个方案，**实现前必须先选一个**：

| 方案 | 首屏 | 取舍 |
|---|---|---|
| **A. 全量内联 + 虚拟滚动**（建议） | 960 KB gzip | 保持**单文件自包含**，完全没有子路径问题（§6）；5,883 行必须虚拟滚动 |
| B. 默认 base + 1 个对照语种，其余按需 fetch | 162 KB gzip | 快，但破了自包含，需要处理子路径下的相对 fetch |
| C. 按语种拆 11 个 JSON + 主 HTML 懒加载 | 最快 | 同 B 的子路径问题，且文件多 |

**建议 A**：960 KB 对内部工具可接受，换来的是「一个 HTML 文件、零资源路径问题」。GitHub Pages 会 gzip 传输。

> §6 会解释为什么「自包含」在 Pages 上价值这么高。

## 3. 产物形态

```
dist/
├── index.html          自包含：CSS + JS + 翻译数据全部内联
└── translations.xlsx   导出文件（为后续 Excel 往返流程铺路）
```

由 `tools/build-viewer.mjs` 生成。**沿用现有工具风格**：Node ESM、零依赖（`node:` 内置模块）、中文注释、JSDoc 类型标注。

> Excel 生成需要依赖（如 `exceljs`）。若为此引入 devDependency，**注意别破坏 `validate.yml` 的零安装优势** —— 让 viewer workflow 单独 `npm ci`，validate workflow 保持不装。

## 4. 页面需求

### 4.1 主表格

| 列 | 说明 |
|---|---|
| namespace | 可点击折叠/展开同 ns 的行 |
| key | 等宽字体 |
| `en-US`（基准） | 始终显示 |
| 对照语种 | 可切换要看哪几个语种 |
| 状态 | 读 `_meta/<ns>.json`，`draft` 标红（= 英文占位，待优化） |

- **虚拟滚动**（方案 A 下必须），5,883 行
- 顶部一个搜索框：命中 ns / key / 任意语种的值
- 筛选：按 ns 前缀、按状态（draft / 已确认）、按语种是否缺失

### 4.2 错误码独立 Tab

`dictionaries/error-code` 有 524 条，是后端同事的主要工作面，**单独一个 Tab**，不要混在主表里。

该 Tab 的特殊处理：

- key 按**数值**排序（不是字典序 —— 见 `CLAUDE.md` 硬规则 4）
- 显眼标出三个特殊 key：`0000`（通用兜底）、`99999`（后端直接返回文案）、`Username cannot be changed`（历史遗留）
- 高亮显示占位符（`{0}` `{sn}` 等），因为**占位符写错是这里最容易出的问题**
- 页面顶部放一句指引 + 直达编辑链接：
  ```
  https://github.com/alphaess-developer/antelope-i18n/blob/main/locales/dictionaries/error-code/en-US.json
  ```

### 4.3 术语库 Tab

读 `glossary/terms.json`，展示概念 / 各语种 preferred / deprecated / DNT 标记。

### 4.4 存量欠账 Tab（建议加）

读 `.ci/baseline.json`，把 123 条历史问题列出来（缺失 105 / 多余 2 / 双括号 2 / 占位符不一致 14）。

**这是给 PM 的待办清单** —— 比让他们去读 JSON 强得多。每修一条从 baseline 删一条，这个 Tab 会自然清空。

### 4.5 导出按钮

链接到 `./translations.xlsx`（**相对路径**，见 §6）。列建议：`ns | key | en-US | 各语种… | state`。

## 5. 首次启用 Pages（一次性设置，最易漏）

```
仓库 → Settings → Pages → Build and deployment → Source → 选【GitHub Actions】
```

⚠️ **不做这一步，下面的 workflow 会直接失败**（报找不到 Pages 站点）。这是第一次用 Pages 最常见的卡点。

> Pages 有两种模式：**分支模式**（从 `gh-pages` 或 `/docs` 托管，会跑 Jekyll）和 **GitHub Actions 模式**（workflow 上传产物，**不经过 Jekyll**）。我们用后者，所以**不需要** `.nojekyll` 文件 —— 那是分支模式为了让下划线开头的目录不被忽略才要的。

## 6. URL 与子路径（自包含方案的价值所在）

部署后地址：

```
https://alphaess-developer.github.io/antelope-i18n/
                                     ^^^^^^^^^^^^^ 仓库名作为子路径
```

这叫**项目站点**。任何写成 `/assets/app.js` 的**绝对路径都会 404**。

方案 A 的自包含单文件从根上规避了这个问题：CSS/JS/数据全部内联，唯一的外部引用是 `./translations.xlsx`（相对路径）。

若将来 viewer 复杂到需要打包器，记得设 `base: '/antelope-i18n/'`。

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

`.github/workflows/viewer.yml`：

```yaml
name: Build & Deploy Viewer

on:
  push:
    branches: [main]
    paths:                       # 只有内容或工具变了才重新部署
      - 'locales/**'
      - '_meta/**'
      - 'glossary/**'
      - '.ci/**'
      - 'languages.json'
      - 'tools/**'
  workflow_dispatch:             # 允许手动触发

permissions:                     # 三项都必需
  contents: read
  pages: write
  id-token: write

concurrency:                     # 避免连续提交时多个部署互相打架
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      # 若 Excel 生成引入了依赖，在这里 npm ci（validate.yml 保持零安装）
      - run: node tools/build-viewer.mjs      # 产出 dist/
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:                             # deploy-pages 要求声明
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

四个容易漏的点：

| 项 | 漏了会怎样 |
|---|---|
| `permissions` 三项 | 缺 `pages: write` 或 `id-token: write` → deploy 步骤失败 |
| `environment: github-pages` | `deploy-pages` 报错 |
| `concurrency: group: pages` | 连续提交时多个部署冲突 |
| `paths` 过滤 | 改个 README 也触发一次部署 |

> Action 大版本号会更新，落地时核对官方 README 的当前版本。

## 9. 常见问题排查

| 现象 | 原因 / 处置 |
|---|---|
| deploy 报找不到 Pages 站点 | **Settings → Pages → Source 没设成 GitHub Actions**（§5） |
| deploy 报权限不足 | `permissions` 缺 `pages: write` 或 `id-token: write` |
| deploy 报缺少 environment | 没写 `environment: name: github-pages` |
| 页面空白 + 控制台一堆 404 | 子路径导致的资源路径问题 —— 用自包含单文件（§2 方案 A），或设 `base` |
| 部署成功但看到旧内容 | 浏览器 / CDN 缓存，强刷 `Ctrl+Shift+R`；等一两分钟 |
| 私有仓库无法启用 Pages | 计划限制（§7） |
| 多次提交后部署状态混乱 | 没配 `concurrency`（§8） |
| 表格卡顿 | 5,883 行没做虚拟滚动（§4.1） |

## 10. 验收检查项

- [ ] Settings → Pages → Source 已设为 **GitHub Actions**（§5，最易漏）
- [ ] workflow 的 `permissions` 三项齐全 + `environment` + `concurrency` + `paths`（§8）
- [ ] 产物是**自包含单 HTML**（无外链资源），子路径下打开正常（§2 / §6）
- [ ] 主表格：搜索命中 ns/key/任意语种值；虚拟滚动流畅
- [ ] `_meta` 的 `draft` 标记可见可筛
- [ ] **错误码独立 Tab**：数值排序、三个特殊 key 标出、占位符高亮、直达编辑链接（§4.2）
- [ ] 术语库 Tab、存量欠账 Tab
- [ ] 导出 Excel 用相对路径且可下载
- [ ] `validate.yml` 仍保持零安装（未被 viewer 的依赖污染）
- [ ] 「禁存非 UI 文案」已写进使用规范（§7）
