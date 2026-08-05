# antelope-i18n

**Antelope 业务线的翻译内容仓库。** 这里是所有多语言文案的唯一来源 —— 改文案就在这里改。

宿主项目 [`antelope-web`](https://github.com/alphaess-developer/antelope-web) 以 git submodule 方式引入本仓库，在**构建时**把译文打进产物。

> 完整方案与实施计划见 `antelope-web/docs/development/i18n-git-migration-plan.md`。

## 目录结构

```
locales/<namespace>/<语种>.json     翻译内容，namespace 名可含斜杠
├── common/en-US.json               通用文案
├── device-form/battery/en-US.json  业务文案
└── dictionaries/                   字典译文（见下）
    ├── error-code/                 错误码文案
    ├── antelope-admin-menu/        菜单（admin）
    └── region/  product_config/ …  各类数据字典

languages.json                      基准语言 + 目标语种声明
glossary/terms.json                 术语库（约束译法，不进运行时产物）
.ci/baseline.json                   存量已知问题的豁免清单
tools/                              校验与规范化脚本（零依赖）
prompts/                            可粘贴给 AI 的任务提示词
```

**规则：文件路径严格等于 namespace 名。** `locales/dictionaries/region/en-US.json` 对应 ns `dictionaries/region`。这条规则是构建时注入、编辑器插件、CI 校验三者的共同基石，不要为任何理由破坏它。

## 语种

| 项 | 值 |
|---|---|
| 基准语言（源） | **`en-US`** —— 新文案先写英文 |
| 目标语种 | `zh-CN` `de-DE` `fr-FR` `es-ES` `it-IT` `nl-NL` `sv-SE` `el-GR` `pl-PL` `cs-CZ` |

当前规模：**141 个 namespace × 11 个语种**，每语种约 5,900 条 key。

## 在线查看 / 导出

**https://alphaess-developer.github.io/antelope-i18n/**

只读页面，不用装任何东西，打开就能用：

- 搜索 namespace / key / 任意语种的译文
- 勾选要对照的语种，并排看
- 「仅看缺失」找出某语种还没译的条目
- **字典 Tab**（和 antelope 数据字典联动维护的入口，16 个字典一处看全）
- **错误码独立 Tab**（后端同事的入口，带直达编辑链接）
- 术语库、存量欠账清单
- **导出 Excel / JSON** —— 导当前筛选结果或全量，在浏览器里生成，不用等谁给你发文件；
  主表格每个 namespace 分组标题行上也有单独的导出按钮，走查某个模块时不用先手动筛出这一个 ns
- **帮助 Tab** —— 页面内的操作说明：走查修正 / 新增文案 / 改错误码三类任务怎么做，改完怎么写回仓库

翻译合并进 `main` 后会自动重新构建，一两分钟后刷新就是最新的。

> 要**改**文案不在这个页面 —— 见下一节。

## 怎么改文案

### 方式一：github.dev（推荐）

在本仓库页面**按一下 `.` 键** —— 浏览器里直接打开完整的 VS Code，零安装。改完从左侧「源代码管理」提交，会自动开 PR。

比网页铅笔编辑好得多：语法高亮、括号匹配、全局搜索、多语种文件并排对照。

### 方式二：网页直接编辑

打开文件 → 点 ✏️ → 改 → Commit。适合改一两个错别字。

### 方式三：Excel 往返（批量）

> ⏳ 待实现，见「后续待建」。

---

**改不坏东西**：`main` 有分支保护，所有改动必须走 PR 且 CI 通过才能合并。JSON 语法错、漏了某个语种、占位符丢失，都会在 CI 被挡住 —— 合不进去就影响不到生产。

## ⚠️ 占位符是单花括号

```json
{ "greeting": "你好 {name}，共 {count} 条" }
```

**是 `{name}` 不是 `{{name}}`。** 宿主项目的 i18next 配置为 `interpolation: { prefix: '{', suffix: '}' }`，写成双花括号插值会**失效**。

几条硬规则：

- **占位符名绝对不能翻译**：`{country}` 在德语里也必须是 `{country}`，不能写成 `{Land}`
- 各语种的占位符集合必须与 `en-US` **完全一致**
- 错误码里的 `{0}` `{1}` 是后端传的位置参数，同样不能改

这三条都是 CI 的**阻塞级**检查。

## 错误码文案

在 **`locales/dictionaries/error-code/`**，key 就是后端返回的错误码数字。详见该目录下的 `README.md`。

## 本地校验

```bash
node tools/validate.mjs      # 全量校验（CI 跑的就是这个）
node tools/sort-keys.mjs     # 检查 key 顺序
```

```bash
node tools/sort-keys.mjs --write   # 自动修复 key 顺序
```

脚本零依赖，装了 Node 20+ 就能跑，不需要 `npm install`。

## CI 检查项

| 检查 | 级别 | 说明 |
|---|---|---|
| JSON 语法 | 🔴 阻塞 | 文件必须能解析 |
| key 集合对齐 | 🔴 阻塞 | 每个语种的 key 必须与 `en-US` 一致 |
| 占位符一致性 | 🔴 阻塞 | 占位符不能丢、不能改名 |
| 双花括号 | 🔴 阻塞 | `{{x}}` 在本项目会失效 |
| 禁止嵌套 | 🔴 阻塞 | 值必须是字符串 |
| key 顺序 | 🔴 阻塞 | 降低多人协作的 git 冲突 |
| 重复源文 / 同源文异译 | ⚪ 警告 | 提示措辞漂移，不阻塞 |

### 关于 `.ci/baseline.json`

从翻译平台迁移时带来的**历史欠账**记在这里（缺失 key、占位符不一致等），CI 对清单内的条目放行。

**新增内容不受豁免** —— 阻塞级检查照常生效。修好一条就从清单里删一条，永久防回归。

## 多人协作约定

三条规则都是为了降低 git 冲突：

1. **一个 namespace 一个目录，一个语种一个文件** —— 改不同功能就改不同文件
2. **文件内一层扁平，禁止嵌套对象**
3. **key 保持规范顺序** —— 新增 key 落在不同行，git 能自动合并

> `dictionaries/*` 下的 key 天生含点号（如 `status.online`），那仍是**一层扁平 JSON**，只是 key 字符串里有点号，不是嵌套对象。

## 文档索引

| 文档 | 给谁看 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | **AI 助手与新协作者** —— 7 条硬规则，动手前必读 |
| **[docs/ai-workflow.md](docs/ai-workflow.md)** | **想让 AI 干活的人** —— 协作边界、后端/产品入口、交付与 review 清单 |
| **[prompts/](prompts/)** | 同上 —— 三份可整份粘贴给 AI 的任务提示词，自包含 |
| [docs/decisions.md](docs/decisions.md) | 想改方案的人 —— 决策记录与**已否决清单** |
| [docs/translating.md](docs/translating.md) | 产出译文的人 —— AI 生成规则、状态标记、占位符铁律 |
| [docs/glossary-guide.md](docs/glossary-guide.md) | 维护术语库的人（产品/业务专家） |
| [docs/backend-guide.md](docs/backend-guide.md) | **后端同事** —— 新增错误码三步走，可直接转发 |
| [docs/viewer-spec.md](docs/viewer-spec.md) | 实现查看页的人 |
| [docs/import-from-tms.md](docs/import-from-tms.md) | 迁移日执行覆盖的人 |

## 后续待建

- [ ] Excel **导入**（批量编辑回写；导出已可用）
- [x] GitHub Pages 只读查看页（搜索、筛选、导出；错误码独立 Tab）
- [ ] 向 `antelope-web` 自动开 submodule bump PR
- [x] AI 协作流程与任务提示词（[docs/ai-workflow.md](docs/ai-workflow.md) + [prompts/](prompts/)）
- [ ] `tools/glossary-prompt.mjs` —— 把术语库转成提示词文本，免去手工摘录
      （术语库只有 3 条，实现它的收益要等术语填充之后才明显）
- [ ] **翻译状态标记**（区分「英文占位」与「确认过的译文」）—— 原 `_meta` draft 方案已移除，
      需先谈定前端/后端/产品的维护责任再重做，见 [docs/decisions.md](docs/decisions.md) D15
- [ ] 术语库内容填充（`glossary/terms.json` 目前只有骨架）
