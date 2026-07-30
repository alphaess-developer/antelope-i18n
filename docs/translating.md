# 翻译产出流程

> 最后更新：2026-07-30
> 讲清「译文从哪来、状态怎么标、AI 怎么用」。硬规则见 [CLAUDE.md](../CLAUDE.md)。

## 1. 三条产出路径

```
① 新增文案（开发/PM）
   写 en-US → 提 PR → fill-missing 用英文占位补齐 10 个语种 → 后续优化
                                    ↑ 自动

② 优化占位（PM/AI）
   把 _meta 里标 draft 的条目替换成真译文 → 清除 draft 标记
                                              ↑ 自动（人改过就是确认过）

③ 修正已有译文（PM）
   直接改对应语种文件
```

**关键：新增内容只写基准语言 `en-US`。** 不要手工往 11 个文件里各塞一份自己编的译文。

## 2. `_meta` 状态标记

```
_meta/<ns>.json          镜像 ns 路径，如 _meta/dictionaries/error-code.json
```

```json
{
  "6199": { "de-DE": "draft", "fr-FR": "draft" }
}
```

| 规则 | 说明 |
|---|---|
| **只记 draft，缺省即已确认** | 让常见情况零字节，减少文件变动 |
| 谁写入 | `fill-missing` 补占位时自动写 |
| 谁清除 | 有人改动该 key 的该语种时清除（人改过就是确认过） |
| 基准语言不记状态 | 它是源不是译文 |
| 内容为空时 | 文件会被删除，不留空壳 |

**用途**：这是 PM/AI 的待办清单 —— 「哪些语种还是英文占位」。viewer 会把 draft 标红。

## 3. 用 AI 生成译文

这是本方案要解决的核心痛点之一 —— **AI 可以直接编辑 JSON 文件**，不需要任何接口或凭证。

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
✅ 读 _meta 找出标 draft 的条目 → 只替换这些
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
