# 任务提示词

**把这里的文件整份粘贴给 AI，然后填末尾的「参数」一节。** 每份都自包含 —— 不需要 AI 先读仓库其它文档。

完整协作流程见 [docs/ai-workflow.md](../docs/ai-workflow.md)。

## 选哪一份

| 文件 | 什么时候用 |
|---|---|
| [translate.md](translate.md) | 某些 key 缺译文，或还是英文占位，要补成真译文 |
| [review.md](review.md) | 某个模块开发完成，要走查它的译文质量 |
| [error-code.md](error-code.md) | 新增或修正错误码文案（后端） |

## 两种使用环境

### A. AI 能读写仓库（Claude Code / Cursor / 克隆 + 任意 agent）

推荐。AI 直接改 `locales/*.json`，并且**能自己跑校验脚本**：

```bash
node tools/sort-keys.mjs --write
node tools/validate.mjs
```

改完由**你**看 diff、commit、push、开 PR —— 提示词里已写明 AI 不碰 git 写操作。

### B. AI 读不到仓库（ChatGPT 网页版等）

也能用，但 AI 跑不了校验。做法：把提示词 + 相关 JSON 片段一起贴给它，拿到结果后你自己贴进
github.dev。**CI 会兜底同一套检查**，只是多一轮往返。

这种情况下建议额外把 `locales/<ns>/en-US.json` 和一个已有译文完整的语种文件（如 `zh-CN.json`）
贴给它当参照 —— 否则它没有语气和术语的锚点。

## 通用铁律（三份提示词里都内联了）

```
1. 占位符单花括号 {name}，不是 {{name}}
2. 占位符名绝不翻译 —— {country} 在德语里也是 {country}
3. 只改被指定的 key，不要顺手优化别的
4. 不要手工排序 —— 跑 node tools/sort-keys.mjs --write
5. 不要往 .ci/baseline.json 加条目
```

权威表述在 [CLAUDE.md](../CLAUDE.md)，冲突时以它为准。
