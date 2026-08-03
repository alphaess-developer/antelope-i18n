# 从翻译平台导入 / 覆盖

> 最后更新：2026-08-03
> 迁移日「重新导出一份覆盖」的操作步骤。
>
> - 首次导入：2026-07-30（commit `9d46491`），用临时脚本
> - **第二次（迁移日）导入：2026-08-03，已完成** —— 导入逻辑已固化为 `tools/import-export.mjs`
>
> ⚠️ 平台侧转只读之后，本文档只在「需要再次从平台批量导入」时才用得上。
> 日常改文案走 git，见 `antelope-web/docs/development/i18n-git-migration-plan.md` §4。

## 1. 为什么会有第二次导入

首次导入是为了**建骨架、验证结构与 CI 规则**。翻译平台在切换日之前仍可写，所以：

```
现在        用当前快照建仓库骨架、跑通 CI      ← 已完成
迁移日      重新导出一份覆盖 locales/         ← 本文档
切换后      翻译平台转只读，git 成为唯一来源
```

**好处**：翻译平台可以一直保持可写到迁移日，不存在「双源但只有一个能生效」的尴尬窗口。

## 2. 前提：导出与仓库必须走同一套规范化

覆盖时**必须能看懂 diff** —— 否则格式噪音会淹没真实的译文变更。

所以导入脚本要做的规范化与 `tools/sort-keys.mjs` **完全一致**：

| 项 | 规范 |
|---|---|
| key 顺序 | `canonicalKeyOrder`（整数键按数值升序 → 其余字典序） |
| 缩进 | 2 空格 |
| 非 ASCII | 原样保留（`ensure_ascii=False`） |
| 结尾 | 单个换行 |
| 换行符 | LF（`.gitattributes` 强制，见 [decisions.md](decisions.md) D11） |

## 3. 导出物的形态

翻译平台的导出**已经就是目标形状**，零格式转换：

```
alpha-antelope.zip
├── manifest.json                  ← exportTime + nsTime（ns → 时间戳）
├── common/en-US.json  zh-CN.json  …
├── dictionaries/error-code/…
└── device-form/battery/…
```

对应到本仓库就是 `locales/<ns>/<lang>.json`。

### 🎯 `manifest.nsTime` 是权威 ns 清单

```
Object.keys(manifest.nsTime)  =  平台侧的全量 ns 列表
```

**这比扫代码可靠得多** —— 宿主项目里有动态拼出的 ns（`dictToNs(code)`、`dictionaries/${menuI18nCode}`），静态扫描找不全。首次导入时实测：manifest 给出 140 个 ns，与目录**零差集**；而扫代码只找到 125 个静态 ns。

## 4. 操作步骤

```bash
# 1. 解压导出物到临时目录
unzip alpha-antelope.zip -d /tmp/i18n-import

# 2. 覆盖 locales/（脚本需自行准备，见 §5）
#    读取 /tmp/i18n-import 的每个 <ns>/<lang>.json → 写入 locales/ 并规范化

# 3. 规范化（保险起见再跑一遍）
node tools/sort-keys.mjs --write

# 4. 校验
node tools/validate.mjs
```

然后：

```bash
# 5. 看 diff —— 这一步是重点
git diff --stat            # 先看规模
git diff locales/          # 逐一确认
```

**diff 应该只有真实的译文变更。** 如果出现大量文件全量改动，说明规范化没对齐（§2），先排查再继续。

```bash
# 6. 若欠账清单有变化，重新生成
node tools/validate.mjs --baseline
```

⚠️ 第 6 步会把当前**所有**问题一次性豁免。只在确认新增的问题都是「存量带来的、非本次引入的」时才跑。

## 5. 导入脚本 `tools/import-export.mjs`

```bash
node tools/import-export.mjs --from=<解压目录>           # 只报告，不落盘
node tools/import-export.mjs --from=<解压目录> --write   # 实际覆盖
node tools/import-export.mjs --from=... --write --prune  # 连同删除导出里没有的 ns
```

规范化直接复用 `lib/core.mjs` 的 `stringify()` —— **与 `sort-keys.mjs` 是同一个函数**，
所以两次导入的格式逐字节一致，diff 里不会有格式噪音。2026-08-03 实测：覆盖后
`sort-keys.mjs` 扫 1551 个文件报告「0 个需要规范化」，验证了这一点。

⚠️ 默认**不删除**导出物里缺失的 ns，只报告。静默删掉整个 ns 的译文太危险，
确认那确实是平台侧的下线动作后再加 `--prune`。

### 脚本应输出的报告

2026-08-03 那次的实际输出：

```
exportTime          2026-08-03T01:50:21.360Z
ns   导出 141 · 仓库 140
  ＋ 新增 1: ess/function-codes
文件数              1551
key 总数（各语种）  65083
聚合行数（基准语言）5926
各语种覆盖率        99.5% ~ 100%（cs-CZ 最低）
缺失 <ns,lang> 组合  0        ← 指整个文件缺失；单个 key 缺失见 baseline
manifest 与目录差集  0        ← 双向零差集，导出完整
```

## 6. 迁移日检查清单

- [ ] 导出物的 `manifest.exportTime` 是最新的（确认不是拿了旧包）
- [ ] `manifest.nsTime` 的 ns 数与目录**零差集**
- [ ] 覆盖后 `git diff` 只有真实译文变更，无格式噪音
- [ ] `node tools/validate.mjs` 通过
- [ ] baseline 若有变化，确认新增条目都是存量问题而非本次引入
- [ ] 🔴 **翻译平台的 `alpha-antelope` 平台转为只读** —— 否则会出现「在旧后台改了但被 git 覆盖」，这类问题排查极痛

## 7. 已知的存量欠账

第二次导入后 **122 条**（首次 123 条，平台侧修好 1 条 `placeholderMismatch`），
记在 [`.ci/baseline.json`](../.ci/baseline.json)：

| 类别 | 数量 | 说明 |
|---|---|---|
| `missingKeys` | 105 | 部分语种缺 key。⚠️ 宿主项目配置 `fallbackLng: false`，**这些 key 当前在生产显示为 raw key** |
| `placeholderMismatch` | 14 | 占位符名被翻译（`{country}` → `{Land}`），当前显示为字面量 |
| `doubleBrace` | 2 | `{{x}}` 在本项目插值失效 |
| `extraKeys` | 2 | 目标语种有 `en-US` 里没有的 key |

**建议在迁移日之前回翻译平台修** —— 迁移日会重新导出覆盖，现在在 git 里修会被冲掉。

修完后从 baseline 删掉对应条目（**不要跑 `--baseline` 全量重生成**，那会把新问题也一起豁免）。

### 105 处缺失的分布

```
dictionaries/error-code      33 处   （cs-CZ 缺 22 条最多）
dictionaries/function_point  63 处   （9 个语种各缺 7 条）
support                       9 处
```

也可以用 `node tools/fill-missing.mjs --write` 用英文占位补齐 —— 那是**用户可见的改进**（英文优于 raw key），但迁移日会被覆盖，所以同样建议在平台侧解决。
