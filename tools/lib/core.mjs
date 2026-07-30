/*
 * @Description: 公共工具 —— 配置读取、locales 遍历、占位符提取
 * @Author: Claude
 *
 * 刻意零依赖（只用 node: 内置模块），这样 CI 不需要 install 就能跑校验。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 仓库根目录 */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** 翻译文件根目录 */
export const LOCALES_DIR = path.join(ROOT, 'locales');
/** 存量问题豁免清单 */
export const BASELINE_FILE = path.join(ROOT, '.ci/baseline.json');

/**
 * @description: 读取语种配置
 * @return {{ base: string, targets: string[], all: string[] }}
 */
export function readLanguages() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
  return { ...cfg, all: [cfg.base, ...cfg.targets] };
}

/**
 * @description: 列出全部 namespace（= locales 下含语种文件的目录，ns 名可含斜杠）
 * @return {string[]} 如 ['common', 'dictionaries/error-code', 'device-form/battery']
 */
export function listNamespaces() {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name.endsWith('.json'))) {
      found.push(path.relative(LOCALES_DIR, dir).split(path.sep).join('/'));
    }
    for (const e of entries) if (e.isDirectory()) walk(path.join(dir, e.name));
  };
  walk(LOCALES_DIR);
  return found.sort();
}

/** @description: 某 ns 某语种的文件路径 */
export function nsFile(ns, lang) {
  return path.join(LOCALES_DIR, ...ns.split('/'), `${lang}.json`);
}

/**
 * @description: 读取一个 ns/语种文件
 * @return {{ exists: boolean, data?: Record<string, unknown>, raw?: string, error?: string }}
 */
export function readNsFile(ns, lang) {
  const file = nsFile(ns, lang);
  if (!fs.existsSync(file)) return { exists: false };
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return { exists: true, data: JSON.parse(raw), raw };
  } catch (e) {
    return { exists: true, raw, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * @description: 提取占位符。
 *
 * ⚠️ 本项目 i18next 配置为 `interpolation: { prefix: '{', suffix: '}' }`，
 * 即**单花括号** `{count}`，不是 i18next 默认的 `{{count}}`。
 * 见 antelope-web/packages/shared/src/i18n/index.ts
 *
 * @param {string} value
 * @return {string[]} 排序去重后的占位符，如 ['{0}', '{count}']
 */
export function extractPlaceholders(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.match(/\{[^{}]*\}/g) ?? [])].sort();
}

/**
 * @description: 检测双花括号 —— 在本项目配置下是 BUG（插值会失效）
 * @param {string} value
 */
export function hasDoubleBrace(value) {
  return typeof value === 'string' && /\{\{[^{}]*\}\}/.test(value);
}

/** @description: 读取豁免清单（存量已知问题，修一条删一条） */
export function readBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

/**
 * @description: 是否是 JS 规范意义上的"整数索引"键。
 * 规范整数键（无前导零、在数组索引范围内）会被 JS 引擎强制排到对象最前面并按**数值**升序，
 * 与文件里的书写顺序无关。所以 `'0000'`（有前导零）不算，`'6022'` 算。
 * @param {string} k
 */
function isIntegerIndex(k) {
  return /^(0|[1-9]\d*)$/.test(k) && Number(k) <= 2 ** 32 - 2;
}

/**
 * @description: 计算 key 的规范顺序 —— 让**文件顺序与 JS 实际迭代顺序一致**。
 *
 * 为什么不能直接用字典序：`dictionaries/error-code` 的 key 是错误码数字，
 * JS 会把它们按数值升序排在最前（`6022` 在 `601000` 前），而字典序会得到
 * `601000` 在 `6022` 前。若按字典序写文件，校验永远无法通过。
 *
 * 规则：整数索引键按数值升序 → 其余键按字典序（保证文件确定性）。
 * @param {string[]} keys
 * @return {string[]}
 */
export function canonicalKeyOrder(keys) {
  const ints = keys.filter(isIntegerIndex).sort((a, b) => Number(a) - Number(b));
  const rest = keys.filter((k) => !isIntegerIndex(k)).sort();
  return [...ints, ...rest];
}

/** @description: 统一的 JSON 序列化格式（2 空格 / 非 ASCII 原样 / 结尾换行），key 按规范顺序 */
export function stringify(obj) {
  const ordered = Object.fromEntries(canonicalKeyOrder(Object.keys(obj)).map((k) => [k, obj[k]]));
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
