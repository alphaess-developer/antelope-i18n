/*
 * @Description: 用基准语言的值填充缺失的 key，并在 _meta 标记为 draft。
 * @Author: Claude
 *
 * 行为未变：只补「基准有、目标语种没有」的 key，不覆盖已有译文。
 *
 * ⚠️ 2026-08-06：draft /「只交英文占位、后续产品优化」流程暂时停用。
 *   文档约定 PR 直接带 11 语种真译文。本脚本仍可用于本地检查缺 key、给新 ns 建骨架；
 *   若用 --write 生成占位，提交前须换成真译文，不要把英文占位当作终态合入。
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
import {
  LOCALES_DIR,
  listNamespaces,
  nsFile,
  readLanguages,
  readNsFile,
  stringify,
} from './lib/core.mjs';

const WRITE = process.argv.includes('--write');
const nsArg = process.argv.find((a) => a.startsWith('--ns='))?.slice(5);

const ROOT = path.resolve(LOCALES_DIR, '..');
const META_DIR = path.join(ROOT, '_meta');

const { base, targets } = readLanguages();
const namespaces = nsArg ? [nsArg] : listNamespaces();

/** @description: _meta 文件路径，镜像 ns 路径（ns 名可含斜杠） */
function metaFile(ns) {
  return path.join(META_DIR, ...`${ns}.json`.split('/'));
}

/** @description: 读 _meta，不存在则返回空对象 */
function readMeta(ns) {
  const f = metaFile(ns);
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    console.error(`⚠️  _meta 解析失败，将重建：${ns}`);
    return {};
  }
}

/** @description: 写 _meta；内容为空则删除文件，避免留一堆空壳 */
function writeMeta(ns, meta) {
  const f = metaFile(ns);
  const hasContent = Object.keys(meta).length > 0;
  if (!hasContent) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
    return;
  }
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, stringify(meta), 'utf8');
}

let totalFilled = 0;
const perNs = [];

for (const ns of namespaces) {
  const b = readNsFile(ns, base);
  if (!b.exists || b.error) {
    if (nsArg) console.error(`❌ ${ns} 缺少或无法解析 ${base}.json`);
    continue;
  }

  const meta = readMeta(ns);
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
      meta[k] = { ...(meta[k] ?? {}), [lang]: 'draft' };
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
    if (WRITE) writeMeta(ns, meta);
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
  console.log(`\n占位内容已在 _meta/ 标记为 draft —— 这是 PM/AI 后续优化的待办清单。`);
  console.log(`别忘了从 .ci/baseline.json 的 missingKeys 里删掉已填充的条目。`);
} else {
  console.log('\n跑 `node tools/fill-missing.mjs --write` 实际填充');
  process.exit(1);
}
