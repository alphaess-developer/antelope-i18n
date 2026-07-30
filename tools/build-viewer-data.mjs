/*
 * @Description: 生成 GitHub Pages 查看页所需的数据文件
 * @Author: Claude
 *
 * 与其他 tools/*.mjs 一样零依赖（只用 node: 内置模块），复用 lib/core.mjs。
 *
 * 产出（默认写到 viewer/public/data/，Vite 会原样拷进 dist/data/）：
 *
 *   manifest.json      语种声明 / ns 清单与 key 数 / 各语种覆盖统计 / 构建戳
 *   base.json          基准语言全量行，**数组保序**（见下方「为什么必须是数组」）
 *   lang/<lang>.json   目标语种译文，按 base.json 的行下标对齐的**值数组**
 *   glossary.json      术语库原样
 *   baseline.json      存量欠账清单，解析成结构化行
 *
 * ⚠️ 为什么 base.json 必须是数组而不是对象：
 * `dictionaries/error-code` 的 key 是错误码数字，JS 引擎会把规范整数键强制按数值
 * 升序排到对象最前面。若把行存成对象，前端 JSON.parse 后拿到的顺序就不是文件顺序，
 * 排序规则会凭空跑掉。数组不受此影响。见 docs/decisions.md §3.1。
 *
 * 用法：
 *   node tools/build-viewer-data.mjs
 *   node tools/build-viewer-data.mjs --out=dist/data
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readLanguages, listNamespaces, readNsFile, readBaseline } from './lib/core.mjs';

const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith('--out='));
const OUT_DIR = path.resolve(ROOT, outArg ? outArg.slice('--out='.length) : 'viewer/public/data');

/** @description: 取当前 commit 短 hash，CI 里优先用 GITHUB_SHA */
function readCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** @description: 写 JSON（紧凑格式 —— 这是给浏览器下载的产物，不需要给人读） */
function writeJson(relPath, data) {
  const file = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
  return fs.statSync(file).size;
}

/** @description: 把 "ns::key" / "ns::key::lang" 解析成结构化行 */
function parseBaselineEntry(entry) {
  const parts = entry.split('::');
  return { ns: parts[0], key: parts[1] ?? '', lang: parts[2] };
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const { base: baseLang, targets, all } = readLanguages();
const namespaces = listNamespaces();

/**
 * 基准语言全量行。ns 名重复出现 5883 次太浪费，抽成索引表。
 * @type {Array<[nsIndex: number, key: string, value: string]>}
 */
const rows = [];
/** @type {Array<{ ns: string, keyCount: number }>} */
const nsList = [];

namespaces.forEach((ns, nsIndex) => {
  const { exists, data, error } = readNsFile(ns, baseLang);
  if (!exists || error) {
    console.error(`✗ ${ns}/${baseLang}.json ${error ? `解析失败: ${error}` : '不存在'}`);
    process.exitCode = 1;
    nsList.push({ ns, keyCount: 0 });
    return;
  }
  // Object.keys 的顺序已经等于 canonicalKeyOrder（文件本身按该顺序写入），直接用
  const keys = Object.keys(data);
  for (const key of keys) rows.push([nsIndex, key, String(data[key])]);
  nsList.push({ ns, keyCount: keys.length });
});

const sizes = {};
sizes['base.json'] = writeJson('base.json', { ns: namespaces, rows });

/**
 * 各目标语种：一个与 rows 等长的值数组，缺 key 用 null。
 * 按下标对齐而不是用 "ns::key" 做 key —— 省掉 5883 次 ns 名重复，也天然保序。
 */
/** @type {Record<string, { missing: number, extra: number }>} */
const langStats = {};

/** 基准语言各 ns 的 key 集合，用于统计目标语种的多余 key */
const baseKeysByNs = new Map();
for (const [nsIndex, key] of rows) {
  if (!baseKeysByNs.has(nsIndex)) baseKeysByNs.set(nsIndex, new Set());
  baseKeysByNs.get(nsIndex).add(key);
}

for (const lang of all) {
  if (lang === baseLang) {
    langStats[lang] = { missing: 0, extra: 0 };
    continue;
  }
  /** @type {Record<string, Record<string, unknown>>} */
  const perNs = {};
  let extra = 0;
  namespaces.forEach((ns, nsIndex) => {
    const { exists, data, error } = readNsFile(ns, lang);
    perNs[nsIndex] = exists && !error ? data : {};
  });

  const values = rows.map(([nsIndex, key]) => {
    const v = perNs[nsIndex]?.[key];
    return typeof v === 'string' ? v : null;
  });
  const missing = values.filter((v) => v === null).length;

  // 多余 key（目标语种有、基准语言没有）—— 数量少，只统计不逐条列出
  for (const [nsIndex, data] of Object.entries(perNs)) {
    const baseKeys = baseKeysByNs.get(Number(nsIndex)) ?? new Set();
    for (const key of Object.keys(data)) if (!baseKeys.has(key)) extra += 1;
  }

  langStats[lang] = { missing, extra };
  sizes[`lang/${lang}.json`] = writeJson(`lang/${lang}.json`, { lang, values });
}

// 术语库：原样透传
const glossaryFile = path.join(ROOT, 'glossary/terms.json');
const glossary = fs.existsSync(glossaryFile) ? JSON.parse(fs.readFileSync(glossaryFile, 'utf8')) : [];
sizes['glossary.json'] = writeJson('glossary.json', glossary);

// 存量欠账：解析成结构化行，供「待办清单」Tab 渲染
const rawBaseline = readBaseline();
const baselineTypes = [
  { type: 'missingKeys', label: '缺失 key' },
  { type: 'extraKeys', label: '多余 key' },
  { type: 'doubleBrace', label: '双花括号' },
  { type: 'placeholderMismatch', label: '占位符不一致' },
];
const baselineRows = baselineTypes.flatMap(({ type, label }) =>
  (rawBaseline[type] ?? []).map((entry) => ({ type, label, ...parseBaselineEntry(entry) })),
);
sizes['baseline.json'] = writeJson('baseline.json', { rows: baselineRows });

// manifest 最后写 —— 它引用了上面统计出来的数字
sizes['manifest.json'] = writeJson('manifest.json', {
  builtAt: new Date().toISOString(),
  commit: readCommit(),
  repo: 'alphaess-developer/antelope-i18n',
  baseLang,
  targets,
  rowCount: rows.length,
  nsList,
  langStats,
  baselineCount: baselineRows.length,
  glossaryCount: glossary.length,
});

const total = Object.values(sizes).reduce((a, b) => a + b, 0);
console.log(`✓ ${path.relative(ROOT, OUT_DIR)}  ${namespaces.length} ns × ${all.length} 语种 · ${rows.length} 行`);
console.log(`  base.json      ${kb(sizes['base.json'])}`);
console.log(`  lang/*.json    ${kb(total - sizes['base.json'] - sizes['glossary.json'] - sizes['baseline.json'] - sizes['manifest.json'])}（${targets.length} 个文件）`);
console.log(`  其余           ${kb(sizes['glossary.json'] + sizes['baseline.json'] + sizes['manifest.json'])}`);
console.log(`  合计           ${kb(total)}（首屏只需 manifest + base = ${kb(sizes['manifest.json'] + sizes['base.json'])}）`);
