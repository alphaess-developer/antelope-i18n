# 任务：新增 / 修正错误码文案

> **用法**：把本文整份粘贴给 AI，然后填最后的「参数」一节。
> 本文自包含。若 AI 能读到仓库，`CLAUDE.md` 的规则优先于本文。
>
> 不想用 AI、想手工三步走 → `docs/backend-guide.md`（可直接转发给后端团队）。

---

## 你的角色

你在帮后端同事维护 AlphaESS **Antelope 业务线**的错误码文案。这些文案在纯 git 的翻译仓库里：

```
locales/dictionaries/error-code/en-US.json     ← 基准源
locales/dictionaries/error-code/<语种>.json    ← 其余 10 个语种，一并写真译文
```

**key 就是接口返回的 `code` 字段**（字符串形式的数字）。文件长这样：

```json
{
  "6028": "{0} cannot be empty",
  "6032": "{0} already exists",
  "6060": "{0} (SN, license): {1} is a GTL system. Please work on the GTL platform"
}
```

## 默认写齐 11 个语种

新增 / 修正时，**以 `en-US` 为源，同时写入其余 10 个语种的真译文**。不要只改 `en-US` 指望英文占位当终态。

```
写齐 11 语种 → 提 PR → CI 绿 → 合并
```

除非人在「参数」里明确要求「仅改 en-US」，否则默认补全全部语种。

## 🔴 铁律

### 1. 占位符名必须和接口返回的 `data` 字段名一字不差

这是本任务**唯一真正危险**的地方：

```
接口返回   { code: 6032, data: { 0: "SN12345" } }
文案       "{0} already exists"
用户看到   "SN12345 already exists"
```

| 规则 | 说明 |
|---|---|
| **单花括号** | 是 `{0}`，**不是** `{{0}}`。双花括号插值会失效 |
| **名字不能改** | `{sn}` 就得是 `{sn}`，不能改成 `{deviceSn}`，任何语种都不能翻译成别的词 |
| **位置参数按序** | `{0}` `{1}` 对应 `data` 里的 `0` `1`，序号不能乱 |

写错的后果是用户看到 `{Nummer} already exists` 这种字面量 —— **比没有文案更难发现**。
存量里已有一处（`dictionaries/error-code:6074`）记在 `.ci/baseline.json`。

**如果人没告诉你 `data` 里有哪些字段，就问，不要猜占位符名。**

### 2. 顺序不用纠结，但必须跑脚本

key 顺序规则是「**整数键按数值升序**，其余按字典序」—— **不是纯字典序**。
原因：JS 引擎会把规范整数键强制按数值排到对象最前，与文件书写顺序无关。

```
实际迭代序：'0','1','2',…,'6022','601000',… 然后才是 '0000','Username cannot be changed'
按字母排：  永远对不上，校验永远无法通过
```

所以你插在哪一行都行，最后跑：

```bash
node tools/sort-keys.mjs --write
```

**绝对不要手工按字母排序。**

### 3. 三个特殊 key —— 别动

| key | 用途 |
|---|---|
| `0000` | 通用兜底。任何错误码查不到文案时显示它，带 `{errorCode}` 让用户看到原始码 |
| `99999` | 约定为「后端直接返回文案」，前端不查此表，直接用响应里的 `error` 字段 |
| `Username cannot be changed` | 历史遗留的非数字 key。别新增同类 |

### 4. 不许碰的

- `.ci/baseline.json` —— **绝不加条目**。存量欠账豁免清单，不是让 CI 变绿的逃生舱
- 其它 namespace —— 你的范围只有 `locales/dictionaries/error-code/`
- `languages.json` / `tools/` / `.github/`
- 已有错误码的 key（改 key 等于改接口契约）

### 5. 结构

一层扁平，值必须是字符串。不能嵌套。

## 英文文案怎么写

产出会直接显示给终端用户（电站业主、安装商、分销商），不是给开发看的日志。

| 项 | 要求 | 例 |
|---|---|---|
| 陈述事实，不指责用户 | ✅ `{0} already exists` ❌ `You entered a duplicate!` | |
| 简洁 | 一句话。多余的解释放不进弹窗 | |
| 与同类错误码一致 | 先读几条相邻的，对齐句式 | `{0} cannot be empty` / `{0} already exists` |
| 不要句尾句号 | 参照文件里既有习惯（多数无句号） | |
| 可操作 | 能说清下一步就说 | `Please work on the GTL platform` |
| 不泄露内部信息 | 不写表名、内部服务名、堆栈 | |

> 🔴 **严禁把非 UI 文案放进翻译库** —— 密钥、内部标识、未公开产品名、客户信息。
> 译文会进公开的前端 bundle，且本仓库的在线查看页是公开的。

## 步骤

1. 读 `locales/dictionaries/error-code/en-US.json`
2. 找几条相邻/同类的错误码，对齐句式与占位符风格
3. 确认占位符名 = 接口 `data` 的字段名（不确定就问）
4. 加入或修改 `en-US.json` 里的条目
5. 若人要求补真译文，再改对应语种文件（占位符集合必须与 `en-US` 完全一致）
6. 跑自检
7. 按「交付格式」报告

## 自检（必须跑，必须通过）

```bash
node tools/sort-keys.mjs --write
node tools/validate.mjs
```

```bash
git diff --stat
```

`validate.mjs` 必须输出 **`✅ 校验通过`**。

## 校验通过后：自己开 PR

若你能读写这个仓库的克隆，**一路做到开 PR 为止**（合并永远是人点）：

```bash
git fetch origin main && git log --oneline HEAD..origin/main   # 先确认不是基于过时快照
git checkout -b feat/error-code-<简短描述>                      # 绝不在 main 上改
git commit                                                     # conventional commits，中文正文
git push -u origin <分支名>
gh pr create --base main
```

commit 结尾加一行 `Co-Authored-By: <模型名> <noreply@anthropic.com>`。

**PR 描述必须写明**：这是 AI 生成的、由谁委托、下面「交付格式」的全部内容。

开完等 CI（`gh pr checks`）。红了自己修、追加 commit 到同一个 PR。

## 🚫 你不做的事

- 🔴 **不合并 PR**（`gh pr merge`）—— 任何情况下都不行，那是人的一步
- 不直推 `main`、不 `push --force`
- 不往 `.ci/baseline.json` 加条目来让 CI 变绿 —— 过不了就改内容
- 不碰用户没点名的错误码

## 交付格式

```
## 改了什么
| code | en-US 文案 | 占位符 | 新增/修正 |

## 校验结果
- node tools/validate.mjs → ✅ 校验通过

## 占位符确认
| code | 占位符 | 对应接口 data 字段 | 是否已确认 |
（没确认的必须标出来）

## 拿不准的
- ...

## 提醒人类
- 已写入 11 语种真译文（若参数要求仅 en-US，请在此说明）
- 文案是构建时打进前端产物的，合并后要等前端发版才生效
  急用可让接口返回 code: 99999 + error 字段直接带文案
```

---

## 参数（由人填写）

```
任务类型：
  □ 新增错误码
  □ 修正已有错误码文案

错误码：
  例：6199

这个错误什么时候返回：
  例：设备离线时，用户尝试下发远程指令
  （必填 —— 没有场景写不出得体的文案）

接口 data 里有哪些字段：
  例：{ sn: "AL1234567" }        → 文案用 {sn}
  例：{ 0: "SN", 1: "GTL" }      → 文案用 {0} {1}
  □ 没有参数

期望的英文文案（可选，你可以润色）：
  例：Device {sn} is offline

语种范围：
  □ 补全 11 语种真译文（默认）
  □ 仅改 en-US（例外；需人明确要求）
```
