/*
 * 按前缀浏览一组 namespace —— 左侧 ns 列表 + 右侧主表格
 *
 * 字典 Tab 与产品配置 Tab 的结构完全一样，只有前缀、称呼和说明文案不同，
 * 所以抽在这里由两边各自实例化。再来一组（比如 device-form/*）也只是多一个薄封装，
 * 不需要再复制一份布局。
 *
 * 布局上有两处讲究，见 docs/viewer-spec.md §4.2：
 * 1. 计数放在左侧卡片**内部**当表头 —— 放外面当标题会把左卡片整体推低，与右卡片错开一行
 * 2. 整个 Tab 的说明放在两列**之上** —— 放右卡片里会被读成「选中这一项的描述」，但它其实不变
 */
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranslationsView } from '@/features/TranslationsView';
import { editUrl, type Manifest, type Row } from '@/lib/data';
import type { DeepLink } from '@/lib/deep-link';

interface Props {
  /** 要浏览的 ns 公共前缀，如 `dictionaries/` */
  prefix: string;
  /** 从列表里排掉的 ns（错误码有自己的 Tab） */
  exclude?: string[];
  /** 左侧计数里对这组 ns 的称呼，如「字典」「模块」 */
  unitLabel: string;
  /** 整个 Tab 的说明，不随选中项变化 */
  description: ReactNode;
  /** 左侧列表下方的补充说明 */
  footnote?: ReactNode;
  /** 初始选中的 ns（深链带来），不在列表里时忽略 */
  defaultNs?: string;
  /** 初始搜索词（深链带来） */
  defaultQuery?: string;
  /**
   * 当前定位变化时通知外部写回地址栏。
   * 挂载时也会调一次 —— 从别的 Tab 切过来时，地址栏得跟上这里实际选中的 ns，
   * 否则会留着上一个 Tab 的定位，与所见不符
   */
  onLocate?: (link: DeepLink) => void;
  rows: Row[];
  manifest: Manifest;
  selectedLangs: string[];
  onSelectedLangsChange: (langs: string[]) => void;
  values: Record<string, (string | null)[]>;
  loadingLangs: string[];
  ensure: (langs: string[]) => Promise<void>;
  keyStyle?: 'plain' | 'dotted';
}

export function NamespaceBrowser({
  prefix,
  exclude,
  unitLabel,
  description,
  footnote,
  defaultNs,
  defaultQuery,
  onLocate,
  rows,
  manifest,
  keyStyle,
  ...rest
}: Props) {
  const list = useMemo(
    () => manifest.nsList.filter((n) => n.ns.startsWith(prefix) && !exclude?.includes(n.ns)),
    [manifest, prefix, exclude],
  );

  const [activeNs, setActiveNs] = useState(
    () => (defaultNs && list.some((n) => n.ns === defaultNs) ? defaultNs : (list[0]?.ns ?? '')),
  );
  /** 深链带来的搜索词只在首次落地的那个 ns 上生效 —— 切走之后不该再回填 */
  const [pendingQuery, setPendingQuery] = useState(defaultQuery);

  const handleNsChange = (ns: string) => {
    setActiveNs(ns);
    // 换了 ns，深链带来的搜索词就过期了，同时从地址栏里去掉
    setPendingQuery(undefined);
  };

  // 首次落地时把深链原样写回（含 q），之后每次换 ns 只写 ns
  useEffect(() => {
    if (activeNs) onLocate?.({ ns: activeNs, q: pendingQuery });
  }, [activeNs, pendingQuery, onLocate]);

  // 选中项的行，并记下每行在全量数组里的下标（语种值按该下标对齐）
  const selected = useMemo(() => {
    const outRows: Row[] = [];
    const indices: number[] = [];
    rows.forEach((row, i) => {
      if (row.ns === activeNs) {
        outRows.push(row);
        indices.push(i);
      }
    });
    return { rows: outRows, indices };
  }, [rows, activeNs]);

  if (list.length === 0) {
    return <p className="text-muted-foreground text-sm">没有找到 {prefix} 下的 namespace。</p>;
  }

  const totalKeys = list.reduce((s, n) => s + n.keyCount, 0);
  /** 去掉公共前缀，剩下的就是这组 ns 里的短名 */
  const shortName = (ns: string) => ns.slice(prefix.length);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="overflow-hidden rounded-lg border">
            {/* min-h-11 与右侧卡片一致 —— 并排的两条 muted 色带高度不同会很明显 */}
            <div className="bg-muted/50 text-muted-foreground flex min-h-11 items-center border-b px-3 text-xs">
              {list.length} 个{unitLabel} · 共 {totalKeys} 条
            </div>
            <nav className="max-h-[26vh] overflow-auto p-1 lg:max-h-[calc(62vh-2.75rem)]">
              {list.map((n) => (
                <button
                  key={n.ns}
                  type="button"
                  onClick={() => handleNsChange(n.ns)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                    n.ns === activeNs ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <span className="truncate font-mono">{shortName(n.ns)}</span>
                  <span className={n.ns === activeNs ? 'opacity-70' : 'text-muted-foreground'}>
                    {n.keyCount}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          {footnote && (
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{footnote}</p>
          )}
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="bg-muted/50 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <p className="truncate font-mono text-sm">{activeNs}</p>
            <Button variant="outline" size="sm" asChild>
              <a href={editUrl(manifest.repo, activeNs)} target="_blank" rel="noreferrer">
                <ExternalLink />
                编辑 en-US.json
              </a>
            </Button>
          </div>

          <TranslationsView
            key={activeNs}
            rows={selected.rows}
            indices={selected.indices}
            manifest={manifest}
            showGroups={false}
            keyStyle={keyStyle}
            defaultQuery={pendingQuery}
            scope={shortName(activeNs)}
            {...rest}
          />
        </div>
      </div>
    </div>
  );
}
