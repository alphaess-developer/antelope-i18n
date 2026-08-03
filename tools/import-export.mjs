/*
 * @Description: 从翻译平台的导出物覆盖 locales/
 * @Author: Claude
 *
 * 与其他 tools/*.mjs 一样零依赖（只用 node: 内置模块），复用 lib/core.mjs。
 *
 * ## 为什么要固化成脚本而不是临时跑一段
 *
 * 覆盖时**必须能看懂 diff** —— 否则格式噪音会淹没真实的译文变更，而「逐一确认 diff」
 * 正是这次覆盖唯一的质量保障。要做到这一点，两次导入必须走**完全相同**的规范化逻辑，
 * 所以这里直接复用 `lib/core.mjs` 的 `stringify()`，与 `sort-keys.mjs` 是同一个函数：
 * canonicalKeyOrder + 2 空格缩进 + 非 ASCII 原样 + 结尾单个换行。
 *
 * 见 docs/import-from-tms.md §2 / §5。
 *
 * ## 导出物形态
 *
 *   <导出目录>/manifest.json          exportTime + nsTime（ns → 时间戳）
 *   <导出目录>/<ns>/<lang>.json       与 locales/<ns>/<lang>.json 一一对应
 *
 * `Object.keys(manifest.nsTime)` 是**平台侧的权威 ns 清单** —— 比扫代码可靠，
 * 因为宿主项目有 dictToNs(code) 这类运行时拼出来的动态 ns，静态扫描找不全。
 *
 * 用法：
 *   node tools/import-export.mjs --from=/tmp/i18n-import           # 只报告，不落盘
 *   node tools/import-export.mjs --from=/tmp/i18n-import --write   # 实际覆盖
 *   node tools/import-export.mjs --from=... --write --prune        # 连同删除导出里没有的 ns
 *
 * ⚠️ 默认**不删除**导出物里缺失的 ns —— 静默删掉整个 ns 的译文太危险，
 * 只报告，确认那确实是平台侧的下线动作后再加 --prune。
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, LOCALES_DIR, readLanguages, listNamespaces, stringify } from './lib/core.mjs';

const args = process.argv.slice(2);
const fromArg = args.find((a) => a.startsWith('--from='));
const WRITE = args.includes('--write');
const PRUNE = args.includes('--prune');

if (!fromArg) {
  console.error('用法: node tools/import-export.mjs --from=<解压后的导出目录> [--write] [--prune]');
  process.exit(1);
}
const FROM = path.resolve(process.cwd(), fromArg.slice('--from='.length));

if (!fs.existsSync(path.join(FROM, 'manifest.json'))) {
  console.error(`✗ ${FROM} 下找不到 manifest.json，确认解压路径是否正确`);
  process.exit(1);
}

/**
 * @description: 列出某个根目录下的全部 ns（= 含 .json 文件的子目录，ns 名可含斜杠）
 * @param {string} root
 * @return {string[]}
 */
function listNsUnder(root) {
  /** @type {string[]} */
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json') && dir !== root) {
        const ns = path.relative(root, dir).split(path.sep).join('/');
        if (!found.includes(ns)) found.push(ns);
      }
    }
  };
  walk(root);
  return found.sort();
}

const manifest = JSON.parse(fs.readFileSync(path.join(FROM, 'manifest.json'), 'utf8'));
const manifestNs = Object.keys(manifest.nsTime ?? {}).sort();
const exportNs = listNsUnder(FROM);
const repoNs = listNamespaces();
const { base, all } = readLanguages();

console.log(`导出物   ${FROM}`);
console.log(`exportTime  ${manifest.exportTime ?? '(缺失)'}`);
console.log('');

// ── 一致性检查：manifest 与导出目录必须零差集，否则导出不完整 ────────────────
const missingInDir = manifestNs.filter((ns) => !exportNs.includes(ns));
const missingInManifest = exportNs.filter((ns) => !manifestNs.includes(ns));
if (missingInDir.length || missingInManifest.length) {
  console.error('✗ manifest 与导出目录不一致，导出可能不完整：');
  if (missingInDir.length) console.error(`  manifest 有而目录没有: ${missingInDir.join(', ')}`);
  if (missingInManifest.length) console.error(`  目录有而 manifest 没有: ${missingInManifest.join(', ')}`);
  process.exit(1);
}

// ── 与仓库现状对比 ──────────────────────────────────────────────────────────
const addedNs = exportNs.filter((ns) => !repoNs.includes(ns));
const removedNs = repoNs.filter((ns) => !exportNs.includes(ns));

console.log(`ns   导出 ${exportNs.length} · 仓库 ${repoNs.length}`);
if (addedNs.length) console.log(`  ＋ 新增 ${addedNs.length}: ${addedNs.join(', ')}`);
if (removedNs.length) {
  console.log(`  － 导出里没有 ${removedNs.length}: ${removedNs.join(', ')}`);
  console.log(PRUNE ? '    → --prune 已指定，将删除' : '    → 保留（要删请加 --prune）');
}

// ── 覆盖 ────────────────────────────────────────────────────────────────────
/** @type {Record<string, number>} 各语种的 key 总数 */
const keyCount = {};
/** @type {string[]} 缺失的 <ns,lang> 组合 */
const missingCombos = [];
let fileCount = 0;
let baseKeyTotal = 0;

for (const ns of exportNs) {
  for (const lang of all) {
    const src = path.join(FROM, ...ns.split('/'), `${lang}.json`);
    if (!fs.existsSync(src)) {
      missingCombos.push(`${ns}::${lang}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(src, 'utf8'));
    const keys = Object.keys(data);
    keyCount[lang] = (keyCount[lang] ?? 0) + keys.length;
    if (lang === base) baseKeyTotal += keys.length;
    fileCount += 1;

    if (WRITE) {
      const dest = path.join(LOCALES_DIR, ...ns.split('/'), `${lang}.json`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // 复用 stringify —— 与 sort-keys.mjs 同一个函数，保证 diff 里没有格式噪音
      fs.writeFileSync(dest, stringify(data), 'utf8');
    }
  }
}

if (WRITE && PRUNE) {
  for (const ns of removedNs) {
    fs.rmSync(path.join(LOCALES_DIR, ...ns.split('/')), { recursive: true, force: true });
  }
}

// ── 报告 ────────────────────────────────────────────────────────────────────
const totalKeys = Object.values(keyCount).reduce((sum, n) => sum + n, 0);
console.log('');
console.log(`文件数              ${fileCount}`);
console.log(`key 总数（各语种）  ${totalKeys}`);
console.log(`聚合行数（基准语言）${baseKeyTotal}`);
console.log('');
console.log('各语种 key 数（相对基准语言的覆盖率）：');
for (const lang of all) {
  const n = keyCount[lang] ?? 0;
  const pct = baseKeyTotal ? ((n / baseKeyTotal) * 100).toFixed(1) : '0.0';
  console.log(`  ${lang.padEnd(6)} ${String(n).padStart(6)}  ${pct.padStart(5)}%`);
}

if (missingCombos.length) {
  console.log('');
  console.log(`缺失的 <ns,lang> 组合  ${missingCombos.length} 处`);
  const byLang = {};
  for (const combo of missingCombos) {
    const lang = combo.split('::')[1];
    byLang[lang] = (byLang[lang] ?? 0) + 1;
  }
  console.log(`  按语种: ${Object.entries(byLang).map(([l, n]) => `${l}×${n}`).join('  ')}`);
}

console.log('');
if (WRITE) {
  console.log(`✓ 已覆盖 ${path.relative(ROOT, LOCALES_DIR)}`);
  console.log('  下一步: node tools/validate.mjs && git diff --stat');
} else {
  console.log('（未落盘，加 --write 才会覆盖）');
}
