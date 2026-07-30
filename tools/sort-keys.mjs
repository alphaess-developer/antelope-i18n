/*
 * @Description: 把全部翻译文件的 key 按字母序排列并统一格式。
 * @Author: Claude
 *
 * 为什么必须排序：两人同时新增 key 时，若都追加到文件末尾就必然冲突；
 * 按字母序插入则落在不同行，git 能自动合并。见 plan-b.md §9 防线二。
 *
 * 用法：
 *   node tools/sort-keys.mjs          只检查，报告哪些文件需要排序
 *   node tools/sort-keys.mjs --write  实际写入
 */
import fs from 'node:fs';
import { listNamespaces, nsFile, readLanguages, stringify } from './lib/core.mjs';

const WRITE = process.argv.includes('--write');
const { all } = readLanguages();

let changed = 0;
let scanned = 0;

for (const ns of listNamespaces()) {
  for (const lang of all) {
    const file = nsFile(ns, lang);
    if (!fs.existsSync(file)) continue;
    scanned++;
    const raw = fs.readFileSync(file, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error(`跳过（JSON 语法错）：${ns}/${lang}.json`);
      continue;
    }
    const sorted = stringify(data); // stringify 内部按 canonicalKeyOrder 排序
    if (sorted === raw) continue;
    changed++;
    if (WRITE) fs.writeFileSync(file, sorted, 'utf8');
    else console.log(`需要规范化：${ns}/${lang}.json`);
  }
}

console.log(`\n扫描 ${scanned} 个文件，${changed} 个需要规范化`);
if (changed && !WRITE) {
  console.log('跑 `node tools/sort-keys.mjs --write` 写入');
  process.exit(1);
}
if (WRITE) console.log('已写入');
