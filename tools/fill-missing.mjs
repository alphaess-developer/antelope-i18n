/*
 * @Description: 用基准语言的值填充缺失的 key（不覆盖已有译文）。
 * @Author: Claude
 *
 * 行为：只补「基准有、目标语种没有」的 key，用 en-US 值占位。
 *
 * ⚠️ 2026-08-06：文档约定 PR 应直接带 11 语种真译文。本脚本用于：
 *   - 本地检查哪些语种缺 key
 *   - 给新 ns / 新 key 建骨架（提交前须换成真译文）
 *   - CI workflow 兜底，避免只加 en-US 时被 key 对齐检查挡住
 *   不要把英文占位当作可合并的终态。见 docs/decisions.md D8。
 *
 * 为什么用英文占位而不是留空：
 *   宿主项目配置 `fallbackLng: false`，缺 key 会**直接显示 key 本身**给用户。
 *   显示英文远好于显示 `some_key_name`。
 *
 * 用法：
 *   node tools/fill-missing.mjs                只报告
 *   node tools/fill-missing.mjs --write        实际填充
 *   node tools/fill-missing.mjs --write --ns=dictionaries/error-code   只处理指定 ns
 */
import fs from 'node:fs';
import path from 'node:path';
import { listNamespaces, nsFile, readLanguages, readNsFile, stringify } from './lib/core.mjs';

const WRITE = process.argv.includes('--write');
const nsArg = process.argv.find((a) => a.startsWith('--ns='))?.slice(5);

const { base, targets } = readLanguages();
const namespaces = nsArg ? [nsArg] : listNamespaces();

let totalFilled = 0;
const perNs = [];

for (const ns of namespaces) {
  const b = readNsFile(ns, base);
  if (!b.exists || b.error) {
    if (nsArg) console.error(`❌ ${ns} 缺少或无法解析 ${base}.json`);
    continue;
  }

  let nsFilled = 0;
  const detail = [];

  for (const lang of targets) {
    const t = readNsFile(ns, lang);
    if (t.error) {
      console.error(`⚠️  跳过（JSON 语法错）：${ns}/${lang}.json`);
      continue;
    }
    const data = t.exists ? { ...t.data } : {};
    const missing = Object.keys(b.data).filter((k) => !(k in data));
    if (!missing.length) continue;

    for (const k of missing) {
      data[k] = b.data[k]; // 用基准语言值占位
    }
    nsFilled += missing.length;
    detail.push(`${lang} +${missing.length}`);

    if (WRITE) {
      const f = nsFile(ns, lang);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, stringify(data), 'utf8');
    }
  }

  if (nsFilled) {
    totalFilled += nsFilled;
    perNs.push({ ns, count: nsFilled, detail });
  }
}

if (!totalFilled) {
  console.log('✅ 没有缺失的 key，无需填充');
  process.exit(0);
}

console.log(`${WRITE ? '已填充' : '待填充'} ${totalFilled} 处缺失（${perNs.length} 个 namespace）：\n`);
for (const { ns, count, detail } of perNs.slice(0, 30)) {
  console.log(`  ${ns}  ${count} 处  [${detail.join(', ')}]`);
}
if (perNs.length > 30) console.log(`  …还有 ${perNs.length - 30} 个 namespace`);

if (WRITE) {
  console.log(`\n⚠️  填的是英文占位，不是真译文 —— 提交前请换成真译文（见 docs/decisions.md D8）。`);
  console.log(`别忘了从 .ci/baseline.json 的 missingKeys 里删掉已填充的条目。`);
} else {
  console.log('\n跑 `node tools/fill-missing.mjs --write` 实际填充');
  process.exit(1);
}
