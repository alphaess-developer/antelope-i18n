/*
 * 深链 —— 从别处直接跳到某个 namespace / 某条 key
 *
 * 参数只有两个：`ns` 与 `q`。**落在哪个 Tab 由 ns 前缀推导，不写进 URL** ——
 * 这样查看页将来增减 Tab 时存量链接不会失效，生成链接的一方也不需要知道这里有哪些 Tab。
 * 反过来，参数没被识别时（比如这个版本还没上线深链）页面会正常退化成首页，不会报错。
 *
 * ⚠️ `ns` 与 `q` 是**对外接口**：antelope-web 的 admin 在 JSON Schema 编辑器里按这个格式
 * 拼链接（见其 `json-schema-editor/utils.ts` 的 `i18nViewerUrl`）。改名要两边一起改。
 */
import { DICT_PREFIX, ERROR_CODE_NS, PRODUCT_CONFIG_PREFIX } from './data';

export type TabValue =
  | 'all'
  | 'dictionaries'
  | 'error-code'
  | 'product-config'
  | 'glossary'
  | 'baseline'
  | 'help';

export interface DeepLink {
  /** 要定位的 namespace */
  ns?: string;
  /** 要预填进搜索框的词，通常是 key */
  q?: string;
}

/** 读取地址栏里的深链参数。只在首屏读一次，之后由页面自己维护 */
export function readDeepLink(): DeepLink {
  const params = new URLSearchParams(window.location.search);
  return {
    ns: params.get('ns') ?? undefined,
    q: params.get('q') ?? undefined,
  };
}

/**
 * ns 归属哪个 Tab —— 判定顺序必须与 App.tsx 的 Tab 划分一致。
 * 错误码要在字典之前判，它的 ns 名本身就以 `dictionaries/` 开头
 */
export function tabForNs(ns: string): TabValue {
  if (ns === ERROR_CODE_NS) return 'error-code';
  if (ns.startsWith(DICT_PREFIX)) return 'dictionaries';
  if (ns.startsWith(PRODUCT_CONFIG_PREFIX)) return 'product-config';
  return 'all';
}

/**
 * 把当前定位写回地址栏。
 * 用 replaceState 而不是 pushState —— 切 Tab、点左侧列表都是浏览行为，
 * 逐个塞进历史记录会让「返回」变成逐步倒放，而不是回到进入本页之前
 */
export function writeDeepLink(link: DeepLink): void {
  const params = new URLSearchParams(window.location.search);
  // ns / q 完全由这里接管：给了就设、没给就删，避免切走之后地址栏留着一个失效的定位
  if (link.ns) params.set('ns', link.ns);
  else params.delete('ns');
  if (link.q) params.set('q', link.q);
  else params.delete('q');
  const search = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
}
