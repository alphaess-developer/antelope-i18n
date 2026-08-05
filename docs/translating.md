# 翻译产出流程

> 最后更新：2026-08-05
> 讲清「译文从哪来、AI 怎么用」。硬规则见 [CLAUDE.md](../CLAUDE.md)。
> ⚠️ 原「状态怎么标」那一节（`_meta` draft）已移除，见 §2 与 [decisions.md](decisions.md) D15。

## 1. 三条产出路径

```
① 新增文案（开发/PM）
   a. 手上没有真译文
      写 en-US → 提 PR → fill-missing 用英文占位补齐 10 个语种 → 后续优化
                                       ↑ 自动
   b. 手上已有真译文（供应商 / AI 产出）
      11 个语种一次填全 —— 比英文占位好，省掉后续优化那一轮

② 优化占位（PM/AI）
   把英文占位替换成真译文
   （哪些是占位？看 fill-missing 的提交 diff —— 目前没有汇总清单，见 §2）

③ 修正已有译文（PM）
   直接改对应语种文件
```

**关键：`en-US` 必须有，其余 10 个语种可选。** `en-US` 是源，缺了它这条 key 就没有源文（CI 报 `extraKeys`）。
其余语种由你填还是让 `fill-missing` 补占位，都是合法路径。

被禁的只有一种：**自己编不熟的语种**。占位符错位、术语跑偏，比老老实实留英文占位更难查出来。

> 走 ①b 时先跑 `node tools/fill-missing.mjs --write` 打好格式正确的占位再替换值 ——
> 路径、缩进、key 顺序都由脚本保证，比手写 11 个文件可靠。现有 140 个 ns 的 11 个语种文件都已齐全，
> 所以**不需要新建文件**。

## 2. ⏸ 翻译状态标记：已移除，待重做

**当前没有任何「这条是英文占位 / 那条是确认过的译文」的标记机制。**

原先的设计是 `fill-missing` 往 `_meta/<ns>.json` 写 `draft` 标记，人改过该条就清除。
**已整体移除** —— 那套机制要求前端（写入清除逻辑）、后端（新增错误码时不破坏标记）、
产品（把标记当待办清单消费）三方按同一套约定长期维护，而这个协作约定目前落实不下来。
半个机制比没有机制更糟：标记会逐渐失真，然后所有人都不再信它。

**所以现在怎么找出「哪些还是英文占位」**：

```
看 fill-missing workflow 的自动提交 diff
（提交信息：chore(i18n): 用基准语言占位补齐缺失语种）
```

也可以用「某语种的值与 `en-US` 完全相同」做近似判断 —— 但**不可靠**：有些词在多语种下本来就同形
（`SN`、`Wi-Fi`、品牌名），真译文也可能与英文一致。

恢复条件与设计草案见 [decisions.md](decisions.md) D15。**重做前先把三方的维护责任谈定**，
否则会重复踩同一个坑。

## 3. 用 AI 生成译文

这是本方案要解决的核心痛点之一 —— **AI 可以直接编辑 JSON 文件**，不需要任何接口或凭证。

> 📋 **要直接开工，别读这一节** —— [`prompts/`](../prompts/) 下有三份可整份粘贴给 AI 的任务提示词
> （补译文 / 走查 / 错误码），已经把下面这些原则都内联进去了。
> 完整协作流程（谁改文件、谁提交、AI 交付前跑什么）见 [ai-workflow.md](ai-workflow.md)。
>
> 本节只讲**为什么**是这些原则 —— 要自己写提示词或评估别的方案时看。

### 3.1 给 AI 的提示词必须交代四件事

```
1. 占位符用【单花括号】{count}，不是 {{count}}
   —— 本项目 i18next 配置为 interpolation: { prefix: '{', suffix: '}' }

2. 占位符名【绝不能翻译】
   —— {country} 在德语里也必须是 {country}，不能写成 {Land}
   —— 各语种的占位符集合必须与 en-US 完全一致

3. 术语必须遵循 glossary/terms.json
   —— 见 §3.2，把术语约束前置到提示词里

4. 参考同 ns 已有译文的语气与长度
   —— 保持措辞一致，避免同一概念在相邻 key 里译法不同
```

前两条是 CI 的**阻塞级**检查，写错会被挡住合不进去。第 3、4 条是质量问题，CI 只给警告。

### 3.2 术语约束要前置，不能事后校验

AI 生成时若拿不到术语库，会自己造译法 —— 事后靠 CI 警告纠正的成本远高于前置约束。

```
生成前：先取 glossary 的适用术语 → 拼进提示词
生成后：CI 的术语检查只是兜底
```

术语库模型与维护见 [glossary-guide.md](glossary-guide.md)。

> ⏳ `tools/glossary-prompt.mjs`（把术语库转成提示词文本）尚未实现，见 [README](../README.md) 的「后续待建」。在它就绪前，手工从 `glossary/terms.json` 摘取相关条目即可。

### 3.3 只针对缺失的 key 生成，不要重写整个文件

```
✅ 圈定一批明确要处理的 key（见 §2：从 fill-missing 的提交 diff 里取）→ 只替换这些
❌ 让 AI 重新翻译整个 ns
```

理由：

- 重写会大范围改动文件，与他人的改动**冲突概率极高**
- 已确认的译文可能被 AI「优化」成不一样的措辞，属于无谓变更
- diff 大到没法 review，等于没 review

### 3.4 AI 生成的改动单独成 PR

不要挂在长期 feature 分支上。快进快出，减少冲突面。

## 4. 占位符铁律（最容易出错的地方）

存量数据里已经有 **14 处占位符名被翻译**、**2 处双花括号**（见 [decisions.md](decisions.md) §3.3–3.4），都在生产环境显示为字面量。

```json
// en-US
{ "coverage": "{country} / {model}" }

// ❌ 变量名被翻译 —— 用户看到 "{Land} / X"
{ "coverage": "{Land} / {model}" }

// ❌ 双花括号 —— 插值失效
{ "coverage": "{{country}} / {{model}}" }

// ✅
{ "coverage": "{country} / {model}" }
```

**错误码的占位符更严格**：名字 = 后端 `apiError.data` 的字段名，`{0}` `{1}` 是位置参数不能改序号。详见 [locales/dictionaries/error-code/README.md](../locales/dictionaries/error-code/README.md)。

## 5. 本地自查

```bash
node tools/validate.mjs            # 全量校验，CI 跑的就是这个
node tools/fill-missing.mjs        # 看哪些语种缺 key
node tools/sort-keys.mjs --write   # 修复 key 顺序
```

提 PR 前跑一遍 `validate`，能省一轮 CI 往返。

## 6. 谁负责什么

| 内容 | 主要维护者 |
|---|---|
| 业务文案（`common` / `device-form/*` / `ess/*` …） | 产品 |
| 错误码（`dictionaries/error-code`） | 后端，见 [backend-guide.md](backend-guide.md) |
| 菜单字典（`dictionaries/antelope-*-menu`） | 前端（改动影响侧栏/面包屑） |
| 术语库（`glossary/`） | 产品 + 业务专家 |
| 工具与 CI（`tools/` / `.github/` / `languages.json`） | 前端 |

CODEOWNERS 会按这个划分自动 request review —— 贡献者不需要知道该找谁。
