/*
 * 纯前端导出 —— Excel 与 JSON 都在浏览器里生成，不经过任何后端。
 *
 * xlsx 用动态 import：SheetJS 约 400 KB，只有点了导出才加载，不进首屏。
 * 依赖装的是 SheetJS 官方 CDN 的 0.20.3 tarball 而不是 npm 上的 0.18.5 —— 后者
 * 2022 年就停更且带 parse 路径的安全告警，会让 npm audit 长期发红。
 */
import type { Row } from './data';

export interface ExportOptions {
  rows: Row[];
  /** 要导出的语种列（不含基准语言，基准语言总是第三列） */
  langs: string[];
  /** 各语种的值数组，按 rows 下标对齐 */
  values: Record<string, (string | null)[]>;
  /** rows 在全量数组里的原始下标 —— 筛选后 rows 与 values 不再同序，靠它对回去 */
  indices: number[];
  baseLang: string;
  fileName: string;
}

/** 生成表格数据（第一行是表头） */
function toAoa({ rows, langs, values, indices, baseLang }: ExportOptions): string[][] {
  const header = ['namespace', 'key', baseLang, ...langs];
  const body = rows.map((row, i) => {
    const idx = indices[i];
    return [row.ns, row.key, row.en, ...langs.map((l) => values[l]?.[idx] ?? '')];
  });
  return [header, ...body];
}

export async function exportXlsx(opts: ExportOptions) {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet(toAoa(opts));
  // 列宽：ns 与 key 窄一些，文案列给宽一点，否则打开后全是 ####
  // 冻结首行是 SheetJS Pro 的功能，社区版写不出来，别加 '!freeze' —— 那是个无声的空操作
  sheet['!cols'] = [{ wch: 26 }, { wch: 30 }, { wch: 44 }, ...opts.langs.map(() => ({ wch: 44 }))];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'translations');
  XLSX.writeFile(book, `${opts.fileName}.xlsx`);
}

export function exportJson(opts: ExportOptions) {
  const { rows, langs, values, indices, baseLang } = opts;
  const payload = rows.map((row, i) => {
    const idx = indices[i];
    const entry: Record<string, string | null> = { ns: row.ns, key: row.key, [baseLang]: row.en };
    for (const l of langs) entry[l] = values[l]?.[idx] ?? null;
    return entry;
  });
  download(`${opts.fileName}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

/** 通用下载 —— 造一个 blob URL 点一下再撤销 */
export function download(fileName: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** 文件名里的构建戳，便于区分不同时间导出的文件 */
export function stamp(commit: string) {
  return `antelope-i18n-${new Date().toISOString().slice(0, 10)}-${commit}`;
}
