# AI 协作工作流

> 最后更新：2026-08-05
> **本文讲「怎么和 AI 协作」，不重复铁律。** 铁律以 [CLAUDE.md](../CLAUDE.md) 为准 —— 冲突时它优先。
> 可直接粘贴给 AI 的任务提示词在 [`prompts/`](../prompts/)。

## 1. 边界：AI 改文件，人提交

```
人        选定任务与范围（哪个 ns、哪些 key、哪些语种）
 ↓
AI        读上下文 → 改 locales/*.json → 跑校验脚本自查 → 报告改了什么
 ↓
人        看 diff → commit → push → 开 PR
 ↓
CI        阻塞级检查 → 绿了才能合并
```

**AI 不碰 git 的写操作**（`commit` / `push` / `gh pr create` 都不给它）。只读的 `git diff` / `git status`
可以用，那是它自查范围的手段。

三条理由：

| 理由 | 说明 |
|---|---|
| PR 是人的责任 | `main` 有分支保护，CODEOWNERS 会 request review。谁提的 PR 谁答辩 —— 这个环节不该由 AI 代劳 |
| 但自证合规该交给 AI | `tools/*.mjs` 零依赖、几秒跑完。AI 改完自己跑一遍 `validate`，能把「格式/顺序/占位符」这类机械错误在人看到之前清掉 |
| git 历史是审计线索 | 半年后查「这条德语谁改的、为什么」，作者写着人名才有人能答 |

> **没有仓库怎么办**（PM 用 ChatGPT 网页版、手上只有一份 Excel）：`prompts/` 里的提示词都自包含，
> AI 能照着产出译文，但**跑不了校验**。这种情况下人贴进 github.dev 后要靠 CI 兜底 ——
> 比 AI 在克隆里自查多一轮往返，但不会出错，CI 是同一套检查。

## 2. 三个可粘贴的任务提示词

| 文件 | 任务 | 谁常用 |
|---|---|---|
| [`prompts/translate.md`](../prompts/translate.md) | 把缺失/英文占位补成真译文 | 产品 |
| [`prompts/review.md`](../prompts/review.md) | 走查某个 ns 的现有译文，找问题 | 产品 |
| [`prompts/error-code.md`](../prompts/error-code.md) | 新增 / 修正错误码文案 | 后端 |

每份都自包含（不需要 AI 先读别的文档），末尾留了「参数」一节由人填。

## 3. 按角色的入口

**规则不在这一节** —— 这里只回答「我该用哪个提示词、我的范围是哪些文件」。规则见 §4，只有一份。

### 后端同事

| 项 | 值 |
|---|---|
| 范围 | `locales/dictionaries/error-code/en-US.json` —— **一个文件** |
| 任务 | 新增 / 修正错误码英文文案 |
| 提示词 | [`prompts/error-code.md`](../prompts/error-code.md) |
| 其余 10 个语种 | 不用管，`fill-missing` workflow 自动补英文占位 |

不想用 AI、想手工三步走 → [docs/backend-guide.md](backend-guide.md)（可直接转发给后端团队）。

### 产品同事

| 项 | 值 |
|---|---|
| 范围 | `locales/<业务 ns>/*.json`，以及 `locales/dictionaries/` 下**除 error-code 外**的 16 个字典 |
| 任务 A | 某模块开发完成，走查它的译文 → [`prompts/review.md`](../prompts/review.md) |
| 任务 B | 把英文占位替换成真译文 → [`prompts/translate.md`](../prompts/translate.md) |
| 任务 C | 新增文案 → 自己写 `en-US`，其余语种走任务 B |

字典类 ns（`dictionaries/*`）的 key 由宿主项目 `dictToKey()` 从数据字典推导，
**改 key 等于改数据字典**，只改值不要动 key。

### 前端 / 机制维护者

`tools/` `.github/` `languages.json` `.ci/` 这些是机制，不在本文范围。AI 改这些要单独评估。

## 4. 共享执行规则

这一节是给 AI 的实质约束。`prompts/` 里的每份提示词都内联了它的压缩版 —— 便于粘贴，
**本节是权威表述**。

### 4.1 🔴 只改被指定的 key —— 最重要的一条

```
✅ 人给了 ns + key 列表 → 只动这些 key 的这些语种
❌ 「顺手把这个 ns 的译文都优化一遍」
```

这是 AI 最容易违反、后果最贵的一条。三个后果：

1. **大范围 diff 与他人改动冲突概率极高** —— 这个仓库被多方同时编辑
2. **已确认的译文被「优化」成别的措辞**，属于无谓变更，而 review 的人看不出哪些是有意改的
3. **diff 大到没法 review，等于没 review**

改动规模应该和任务描述**一一对应**。AI 若认为范围外还有别的问题，**报告，不要顺手改** ——
那是下一个 PR 的事（见 §6 的交付格式）。

### 4.2 占位符铁律

| 规则 | 正确 | 错误 |
|---|---|---|
| 单花括号 | `{name}` | `{{name}}`（本项目插值失效） |
| 名字不翻译 | `de-DE: {country}` | `de-DE: {Land}` |
| 集合与 `en-US` 完全一致 | 不多不少 | 漏一个 / 多一个 |
| 错误码位置参数不改序 | `{0}` `{1}` | 换序、改名 |

「把 `{country}` 翻译成 `{Land}`」是 AI 的天然倾向 —— 它在做翻译，变量名看起来就是待翻译的词。
**必须显式禁止。** 存量里已有 14 处这种错（`.ci/baseline.json`），生产环境显示为字面量。

### 4.3 顺序与格式交给脚本，不要手工排

```bash
node tools/sort-keys.mjs --write   # 唯一正确的排序方式
```

key 顺序由 `canonicalKeyOrder` 决定：**整数键按数值升序**，其余按字典序 —— **不是纯字典序**。
`dictionaries/error-code` 的 key 是错误码数字，JS 引擎会把规范整数键强制排到对象最前，
手工按字母排会让校验**永远无法通过**。

所以规则是：AI 加 key 时**插在哪一行都行**，最后跑一次脚本。缩进 2 空格、LF、结尾单换行也由脚本保证。

### 4.4 一致性靠什么锚定

⚠️ **术语库目前只有 3 条**（`inverter` / `pv` / `AlphaESS`），其中只有前两条有 zh-CN，
**其余 9 个目标语种一条都没有**。所以「遵循术语库」对捷克语/希腊语/波兰语几乎是空约束。

优先级：

```
1. 同 ns 已有译文        ← 主要参照。语气、长度、术语都对着它
2. glossary/terms.json   ← 有就必须遵守（尤其 dnt: true 的品牌名不译）
3. 全仓库同源文的既有译法 ← 同一句英文别在新地方译出第三种说法
```

AI 若发现某个概念反复出现却不在术语库里，**在报告里建议补术语**，不要自己改 `glossary/terms.json` ——
术语库由产品 + 业务专家维护（[glossary-guide.md](glossary-guide.md)）。

> CI 有「同源文异译」警告（当前 126 组），不阻塞，但新增内容别再往里加。

### 4.5 不许碰的东西

| 对象 | 原因 |
|---|---|
| `.ci/baseline.json` **加条目** | 那是存量欠账豁免清单，不是绕过检查的逃生舱。新内容过不了 CI 就改内容 |
| `en-US` 的值（除非任务就是改源文） | 它是源。改它等于改所有语种的翻译依据 |
| key 本身（字典类尤其） | 由 `dictToKey()` 从数据字典推导，改名等于改数据字典 |
| 错误码的 `0000` / `99999` / `Username cannot be changed` | 三个特殊 key，见 [error-code/README.md](../locales/dictionaries/error-code/README.md) |
| `languages.json` / `tools/` / `.github/` | 机制部分 |
| 新建语种文件 | 现有 140 个 ns 的 11 个语种文件**都已齐全**。要打占位用 `fill-missing --write` |

## 5. AI 交付前必须跑

```bash
node tools/sort-keys.mjs --write   # 规范化顺序与格式
node tools/validate.mjs            # 全量校验（CI 跑的就是这个）
```

```bash
git diff --stat    # 确认改动规模与任务描述一致
```

**`validate.mjs` 必须是「✅ 校验通过」才算交付。** 它输出的警告（重复源文、同源文异译）不阻塞，
但 AI 应该在报告里说明自己有没有新增警告。

## 6. AI 的交付格式

要求 AI 报告这五项 —— 人 review 时靠它决定看哪里：

```
1. 改了哪些文件、哪些 key、哪些语种（数量 + 清单）
2. validate.mjs 的结果（必须通过）
3. 拿不准的条目：为什么拿不准、按什么处理了
4. 范围外发现的问题（只报告，不改）
5. 建议补进术语库的概念（如有）
```

第 3 项是关键。让 AI **显式暴露不确定性**，而不是把猜测混在 200 行 diff 里 ——
比如「`{sn}` 在捷克语上下文里不确定该不该加冠词，按不加处理」。

## 7. 人接手时 review 什么

AI 跑过 `validate` 之后，机械错误基本清了。人要看的是它**验证不了**的东西：

- [ ] **改动范围**和任务描述一致？有没有顺手改了别的（§4.1）
- [ ] 占位符肉眼扫一遍 —— CI 能查「集合是否一致」，查不出「位置放得对不对」
- [ ] 语气、长度是否和同 ns 其它条目一致（长文案会撑破 UI）
- [ ] AI 报告里「拿不准的条目」逐条确认
- [ ] 母语者抽查 —— 尤其捷克语/希腊语/波兰语这些**术语库完全没覆盖**的语种

然后 commit（conventional commits）、push、开 PR。

## 8. 已知缺口

| 缺口 | 影响 | 出处 |
|---|---|---|
| 没有「哪些还是英文占位」的机器可读清单 | AI 只能靠「值与 `en-US` 相同」近似判断。实测全仓库 **1,618 处**命中，可靠度差 4 倍：`el-GR` 1.1% / `zh-CN` 1.4%（信号强）vs `de-DE` 4.2% / `nl-NL` 4.8%（约一半是 `Status` `Model` 这类本来就同形的技术词）。详见 [`prompts/translate.md`](../prompts/translate.md) | `_meta` draft 机制已移除，见 [decisions.md](decisions.md) D15 |
| 术语库只有 3 条 | 9 个语种无术语约束 | [glossary-guide.md](glossary-guide.md)；README「后续待建」 |
| `tools/glossary-prompt.mjs` 未实现 | 术语约束要手工摘进提示词 | [translating.md](translating.md) §3.2 |
| Excel 不能自动导回 | 走查结果要手工改 JSON | README「后续待建」 |
| CODEOWNERS 全是占位用户名 | review 请求不会正确分派 | [decisions.md](decisions.md) §4 待办 #1 |

## 相关文档

| 文档 | 内容 |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | **铁律权威表述**，与本文冲突时它优先 |
| [translating.md](translating.md) | 译文产出的三条路径、AI 生成的原则 |
| [glossary-guide.md](glossary-guide.md) | 术语库模型与维护 |
| [backend-guide.md](backend-guide.md) | 后端手工三步走（不用 AI 的路径） |
| [decisions.md](decisions.md) | 决策记录与已否决方案 |
