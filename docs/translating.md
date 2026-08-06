# 翻译产出流程

> 最后更新：2026-08-06
> 讲清「译文从哪来、AI 怎么用」。硬规则见 [CLAUDE.md](../CLAUDE.md)。

## 1. 两条产出路径

```
① 新增文案（开发/PM）
   写齐 11 个语种的真译文 → 提 PR → CI 绿 → 合并
                                    ↑ 推荐用 AI skill 一次写齐

② 修正已有译文（PM）
   直接改对应语种文件
```

**关键：新增内容以 `en-US` 为基准源，但 PR 必须带全量 11 语种真译文。**

> ⚠️ 原先「只写 `en-US` → fill-missing 英文占位 + `_meta` draft → 后续优化」的流程**暂时停用**。
> 不要只交英文占位进 main。

## 2. `_meta` / draft（暂时停用）

`_meta/<ns>.json` 与 `draft` 标记是为「英文占位待优化」设计的待办清单。

**当前不依赖这条链路**：新增文案直接提交真译文；viewer 的 draft 状态列也未启用（见 [decisions.md](decisions.md) D15）。

`tools/fill-missing.mjs` 仍可本地使用：

```bash
node tools/fill-missing.mjs              # 报告哪些语种缺 key
node tools/fill-missing.mjs --write      # 用 en-US 值补缺失 key（仅作骨架/自查）
```

若用 `--write` 建了骨架，**提交前必须把占位英文替换成真译文**。

## 3. 用 AI 生成译文

这是本方案要解决的核心痛点之一 —— **AI 可以直接编辑 JSON 文件**，不需要任何接口或凭证。

宿主项目侧推荐直接说「生成翻译：…」，由 `generate-i18n-translation` skill 写入 11 个语种文件。

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

### 3.3 只改需要的 key，不要重写整个文件

```
✅ 只给新增 / 待改的 key 生成译文并写入
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
node tools/fill-missing.mjs        # 看哪些语种缺 key（应为空再提 PR）
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
