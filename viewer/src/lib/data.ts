/*
 * 数据层 —— 加载 tools/build-viewer-data.mjs 产出的数据文件
 *
 * 加载策略（docs/viewer-spec.md §2）：首屏只取 manifest + base（约 93 KB gzip），
 * 目标语种按需 fetch，每个语种一个文件、只在被选中时加载。
 *
 * ⚠️ base.rows 是**数组**，lang/<lang>.values 按同一下标对齐。
 * 不能改成以 "ns::key" 为键的对象 —— error-code 的数字 key 会被 JS 引擎按数值重排，
 * 顺序会凭空跑掉。见 docs/decisions.md §3.1
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** 字典 ns 的公共前缀 —— 由宿主项目的 dictToNs() 从字典 code 推导 */
export const DICT_PREFIX = 'dictionaries/';

export const ERROR_CODE_NS = 'dictionaries/error-code';

/**
 * 产品配置页面文案 ns 的公共前缀。
 *
 * ⚠️ 与字典的 `dictionaries/product_config`（下划线）不是一回事：那是一张数据字典。
 *
 * 动态表单的**字段**文案已于 ANTELOPE-6127 迁到 {@link DYNAMIC_FORM_NS}，
 * 这个前缀下剩的是 admin 产品配置各页面自身的静态文案。
 */
export const PRODUCT_CONFIG_PREFIX = 'product-config/';

/**
 * 动态表单字段文案 —— 单一 ns，不按模块拆。
 *
 * 模块（battery / hardware / inverter …）是 admin 的**页面**边界，不是**字段语义**边界：
 * `maximum_grid_charging_power` 这类跨模块字段在拆分方案下会在多个 ns 各存一份，
 * 配置人员也频繁选到隔壁模块的 key。合并后这两类问题都不存在。
 *
 * antelope-web 的 `JsonSchemaEditor` / `JsonSchemaForm` 全部以此为 `i18nNs`。
 */
export const DYNAMIC_FORM_NS = 'dynamic-form';

/** 错误码里三个需要显眼标出的特殊 key（docs/viewer-spec.md §4.2） */
export const SPECIAL_ERROR_KEYS: Record<string, string> = {
  '0000': '通用兜底，用户会看到错误码本身',
  '99999': '后端直接返回文案，不查此表',
  'Username cannot be changed': '历史遗留 key',
};

export interface Manifest {
  builtAt: string;
  commit: string;
  repo: string;
  baseLang: string;
  targets: string[];
  rowCount: number;
  nsList: { ns: string; keyCount: number }[];
  langStats: Record<string, { missing: number; extra: number }>;
  baselineCount: number;
  glossaryCount: number;
}

export interface Row {
  ns: string;
  key: string;
  en: string;
}

export interface GlossaryTerm {
  text: string;
  status: 'preferred' | 'deprecated' | string;
}

export interface GlossaryEntry {
  id: string;
  domain?: string;
  definition?: string;
  dnt?: boolean;
  terms: Record<string, GlossaryTerm[]>;
}

export interface BaselineRow {
  type: string;
  label: string;
  ns: string;
  key: string;
  lang?: string;
}

/** 数据文件都在 <base>/data/ 下，用相对于 base 的路径 —— 子路径部署的前提 */
const dataUrl = (p: string) => `${import.meta.env.BASE_URL}data/${p}`;

async function loadJson<T>(p: string): Promise<T> {
  const res = await fetch(dataUrl(p));
  if (!res.ok) throw new Error(`${p} 加载失败（HTTP ${res.status}）`);
  return res.json() as Promise<T>;
}

/** 语种文件缓存 —— 同一语种只 fetch 一次，也顺带扛住 StrictMode 的双次调用 */
const langCache = new Map<string, Promise<(string | null)[]>>();

function fetchLang(lang: string): Promise<(string | null)[]> {
  let p = langCache.get(lang);
  if (!p) {
    p = loadJson<{ values: (string | null)[] }>(`lang/${lang}.json`).then((d) => d.values);
    langCache.set(lang, p);
  }
  return p;
}

export interface ViewerData {
  manifest: Manifest;
  rows: Row[];
  glossary: GlossaryEntry[];
  baseline: BaselineRow[];
}

/** 首屏数据只取一次 —— 顺带扛住 StrictMode 在 dev 下的双次 effect */
let bundlePromise: Promise<ViewerData> | null = null;

function fetchBundle(): Promise<ViewerData> {
  bundlePromise ??= (async () => {
    const [manifest, base, glossary, baseline] = await Promise.all([
      loadJson<Manifest>('manifest.json'),
      loadJson<{ ns: string[]; rows: [number, string, string][] }>('base.json'),
      loadJson<GlossaryEntry[]>('glossary.json'),
      loadJson<{ rows: BaselineRow[] }>('baseline.json'),
    ]);
    const rows = base.rows.map(([nsIndex, key, en]) => ({ ns: base.ns[nsIndex], key, en }));
    return { manifest, rows, glossary, baseline: baseline.rows };
  })();
  return bundlePromise;
}

export function useViewerData() {
  const [data, setData] = useState<ViewerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchBundle().then(
      (d) => alive && setData(d),
      (e) => {
        bundlePromise = null;
        if (alive) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return { data, error };
}

/**
 * 目标语种的按需加载。
 * @return values: 已加载语种的值数组（按 rows 下标对齐）；loading: 正在加载的语种
 */
export function useLangValues() {
  const [values, setValues] = useState<Record<string, (string | null)[]>>({});
  const [loading, setLoading] = useState<string[]>([]);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const ensure = useCallback(async (langs: string[]) => {
    const todo = langs.filter((l) => !valuesRef.current[l]);
    if (todo.length === 0) return;
    setLoading((prev) => [...new Set([...prev, ...todo])]);
    await Promise.all(
      todo.map(async (lang) => {
        try {
          const v = await fetchLang(lang);
          setValues((prev) => ({ ...prev, [lang]: v }));
        } finally {
          setLoading((prev) => prev.filter((l) => l !== lang));
        }
      }),
    );
  }, []);

  return { values, loading, ensure };
}

/** 某 ns 的 en-US 文件在 GitHub 上的直达编辑链接 */
export function editUrl(repo: string, ns: string, lang = 'en-US') {
  return `https://github.com/${repo}/blob/main/locales/${ns}/${lang}.json`;
}

/** 仓库内任意文档在 GitHub 上的直达链接（帮助 Tab 用来指向 README / docs/*.md） */
export function docUrl(repo: string, path: string) {
  return `https://github.com/${repo}/blob/main/${path}`;
}
