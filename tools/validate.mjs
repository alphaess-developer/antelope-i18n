/*
 * @Description: CI 校验主入口。阻塞级失败 → 退出码 1；警告级只打印。
 * @Author: Claude
 *
 * 用法：
 *   node tools/validate.mjs              正常校验
 *   node tools/validate.mjs --baseline   重新生成存量豁免清单（.ci/baseline.json）
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  BASELINE_FILE,
  canonicalKeyOrder,
  extractPlaceholders,
  hasDoubleBrace,
  listNamespaces,
  readBaseline,
  readLanguages,
  readNsFile,
  stringify,
} from './lib/core.mjs';

const REGEN = process.argv.includes('--baseline');

const { base, targets, all } = readLanguages();
const namespaces = listNamespaces();

/** 阻塞级问题 */
const errors = [];
/** 警告级问题 */
const warnings = [];

/** 豁免清单的分类 */
const CATEGORIES = ['missingKeys', 'extraKeys', 'doubleBrace', 'placeholderMismatch'];
/** 本次实际发现的存量问题（用于 --baseline 重新生成） */
const found = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
const baseline = REGEN ? Object.fromEntries(CATEGORIES.map((c) => [c, []])) : readBaseline();

/**
 * @description: 记录一个问题；若已在豁免清单中则不计入阻塞
 * @return {boolean} true = 需要报错
 */
function track(category, id) {
  if (!found[category].includes(id)) found[category].push(id);
  return !(baseline[category] ?? []).includes(id);
}

// ── 1. JSON 语法 + 扁平结构 + key 顺序 ─────────────────────────────
for (const ns of namespaces) {
  for (const lang of all) {
    const { exists, data, error } = readNsFile(ns, lang);
    if (!exists) continue; // 缺文件由 §2 负责报
    if (error) {
      errors.push(`[JSON 语法] ${ns}/${lang}.json：${error}`);
      continue;
    }
    // 扁平结构：值必须是字符串。
    // 注意 dictionaries/* 的 key 天生含点号（如 status.online），那是**扁平 key 里含点号**，
    // 不是嵌套对象 —— 这里只禁止值为对象/数组。
    for (const [k, v] of Object.entries(data)) {
      if (typeof v !== 'string') {
        errors.push(`[禁止嵌套] ${ns}/${lang}.json：key "${k}" 的值不是字符串（${typeof v}）`);
      }
    }
    // 用 canonicalKeyOrder 而非字典序 —— 见 core.mjs：
    // error-code 的数字 key 会被 JS 引擎强制按数值升序，纯字典序永远对不上。
    const keys = Object.keys(data);
    const want = canonicalKeyOrder(keys);
    if (keys.some((k, i) => k !== want[i])) {
      errors.push(`[key 顺序] ${ns}/${lang}.json 顺序不规范 —— 跑 npm run sort 自动修复`);
    }
  }
}

// ── 2. key 集合对齐（以 base 语种为准） ────────────────────────────
for (const ns of namespaces) {
  const b = readNsFile(ns, base);
  if (!b.exists) {
    errors.push(`[缺基准语言] ${ns} 缺少 ${base}.json —— 基准语言是源文，必须存在`);
    continue;
  }
  if (b.error) continue; // 语法错已在 §1 报过
  const baseKeys = new Set(Object.keys(b.data));
  for (const lang of targets) {
    const t = readNsFile(ns, lang);
    if (!t.exists) {
      errors.push(`[缺语种文件] ${ns}/${lang}.json 不存在`);
      continue;
    }
    if (t.error) continue;
    const tKeys = new Set(Object.keys(t.data));

    const missing = [...baseKeys].filter((k) => !tKeys.has(k) && track('missingKeys', `${ns}::${k}::${lang}`));
    if (missing.length) {
      errors.push(
        `[key 缺失] ${ns}/${lang}.json 缺 ${missing.length} 个 key：` +
          `${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}`,
      );
    }

    const extra = [...tKeys].filter((k) => !baseKeys.has(k) && track('extraKeys', `${ns}::${k}::${lang}`));
    if (extra.length) {
      errors.push(
        `[key 多余] ${ns}/${lang}.json 有 ${extra.length} 个 ${base} 里没有的 key：` +
          `${extra.slice(0, 5).join(', ')}${extra.length > 5 ? ' …' : ''}`,
      );
    }
  }
}

// ── 3. 双花括号（在本项目配置下是 BUG） ────────────────────────────
for (const ns of namespaces) {
  for (const lang of all) {
    const { exists, data, error } = readNsFile(ns, lang);
    if (!exists || error) continue;
    for (const [k, v] of Object.entries(data)) {
      if (!hasDoubleBrace(v)) continue;
      if (!track('doubleBrace', `${ns}::${k}`)) continue;
      errors.push(
        `[双花括号] ${ns}/${lang}.json key "${k}"：本项目插值是单花括号 {x}，{{x}} 会失效` +
          ` —— ${JSON.stringify(String(v).slice(0, 60))}`,
      );
    }
  }
}

// ── 4. 占位符与基准语言一致 ────────────────────────────────────────
for (const ns of namespaces) {
  const b = readNsFile(ns, base);
  if (!b.exists || b.error) continue;
  for (const lang of targets) {
    const t = readNsFile(ns, lang);
    if (!t.exists || t.error) continue;
    for (const [k, bv] of Object.entries(b.data)) {
      const tv = t.data[k];
      if (typeof bv !== 'string' || typeof tv !== 'string') continue;
      const bp = extractPlaceholders(bv);
      const tp = extractPlaceholders(tv);
      if (bp.join('|') === tp.join('|')) continue;
      if (!track('placeholderMismatch', `${ns}::${k}::${lang}`)) continue;
      errors.push(
        `[占位符不一致] ${ns} key "${k}" ${lang}：基准 [${bp.join(', ')}] vs 译文 [${tp.join(', ')}]` +
          '\n    占位符名不可翻译，必须与基准语言完全一致',
      );
    }
  }
}

// ── 5. 警告：重复源文 / 同源文异译（业务线内部的措辞漂移） ──────────
{
  /** @type {Map<string, string[]>} 基准语言原文 → ['ns::key', …] */
  const byText = new Map();
  for (const ns of namespaces) {
    const b = readNsFile(ns, base);
    if (!b.exists || b.error) continue;
    for (const [k, v] of Object.entries(b.data)) {
      if (typeof v !== 'string' || v.trim().length < 3) continue;
      const list = byText.get(v) ?? [];
      list.push(`${ns}::${k}`);
      byText.set(v, list);
    }
  }
  // 预读各语种，避免重复 IO
  const cache = new Map();
  const get = (ns, lang) => {
    const key = `${ns}/${lang}`;
    if (!cache.has(key)) cache.set(key, readNsFile(ns, lang));
    return cache.get(key);
  };

  let dupGroups = 0;
  const drift = [];
  for (const [text, locs] of byText) {
    if (locs.length < 2) continue;
    dupGroups++;
    for (const lang of targets) {
      const vals = new Set();
      for (const loc of locs) {
        const [ns, k] = loc.split('::');
        const t = get(ns, lang);
        if (t.exists && !t.error && typeof t.data[k] === 'string') vals.add(t.data[k]);
      }
      if (vals.size > 1) {
        drift.push({ text, lang, variants: vals.size, refs: locs.length });
        break;
      }
    }
  }
  if (dupGroups) warnings.push(`[重复源文] ${base} 中有 ${dupGroups} 组相同原文对应不同 key`);
  if (drift.length) {
    warnings.push(`[同源文异译] ${drift.length} 组 —— 同一句原文在不同 ns 译法不一致：`);
    for (const d of drift.slice(0, 8)) {
      warnings.push(`    "${d.text.slice(0, 36)}" 在 ${d.lang} 有 ${d.variants} 种译法（${d.refs} 处）`);
    }
    if (drift.length > 8) warnings.push(`    …还有 ${drift.length - 8} 组`);
  }
}

// ── 输出 ───────────────────────────────────────────────────────────
if (REGEN) {
  for (const c of CATEGORIES) found[c].sort();
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(
    BASELINE_FILE,
    stringify({
      $comment: [
        '存量已知问题的豁免清单 —— 迁移时从翻译平台原样带过来的历史欠账。',
        '新增内容不受豁免：阻塞级检查照常生效，只有这里列出的条目被放过。',
        '修好一条就从这里删一条，永久防回归。四类都空时可直接删除本文件。',
        '重新生成（谨慎，会把当前所有问题都豁免）：node tools/validate.mjs --baseline',
      ],
      ...Object.fromEntries(CATEGORIES.map((c) => [c, found[c]])),
    }),
    'utf8',
  );
  console.log(`已写入 ${path.relative(process.cwd(), BASELINE_FILE)}`);
  for (const c of CATEGORIES) console.log(`  ${c}: ${found[c].length} 条`);
  process.exit(0);
}

console.log(`校验范围：${namespaces.length} 个 namespace × ${all.length} 个语种（base = ${base}）\n`);

if (warnings.length) {
  console.log('⚠️  警告（不阻塞）：');
  for (const w of warnings) console.log(`  ${w}`);
  console.log('');
}

const exempt = CATEGORIES.reduce((n, c) => n + (baseline[c]?.length ?? 0), 0);
if (exempt) {
  const detail = CATEGORIES.filter((c) => baseline[c]?.length).map((c) => `${c} ${baseline[c].length}`);
  console.log(`ℹ️  ${exempt} 条存量问题已豁免（${detail.join(' / ')}）—— 见 .ci/baseline.json，修一条删一条\n`);
}

if (errors.length) {
  console.error(`❌ ${errors.length} 个阻塞级问题：\n`);
  for (const e of errors.slice(0, 50)) console.error(`  ${e}`);
  if (errors.length > 50) console.error(`\n  …还有 ${errors.length - 50} 个`);
  process.exit(1);
}

console.log('✅ 校验通过');
