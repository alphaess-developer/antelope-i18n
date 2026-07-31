/*
 * 字典 Tab —— 与 antelope 数据字典联动维护的单一入口
 *
 * `dictionaries/*` 下的 ns 名由宿主项目的 dictToNs() 从字典 code 推导，
 * key 由 dictToKey() 产生，所以这里的每一行都对着数据字典里的一条。
 * 左侧列出全部字典（错误码除外，它有自己的 Tab），选中后在右侧看内容。
 *
 * key 的两级结构（字典项 / 该项的取值）由 keyStyle="dotted" 呈现 ——
 * 文件里仍是一层扁平 JSON，只是 key 字符串带点号（CLAUDE.md 硬规则 7）。
 */
import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranslationsView } from '@/features/TranslationsView';
import { DICT_PREFIX, ERROR_CODE_NS, editUrl, type Manifest, type Row } from '@/lib/data';

interface Props {
  rows: Row[];
  manifest: Manifest;
  selectedLangs: string[];
  onSelectedLangsChange: (langs: string[]) => void;
  values: Record<string, (string | null)[]>;
  loadingLangs: string[];
  ensure: (langs: string[]) => Promise<void>;
}

/** 去掉 `dictionaries/` 前缀，剩下的就是字典 code */
const shortName = (ns: string) => ns.slice(DICT_PREFIX.length);

export function DictionariesView({ rows, manifest, ...rest }: Props) {
  const dicts = useMemo(
    () =>
      manifest.nsList.filter((n) => n.ns.startsWith(DICT_PREFIX) && n.ns !== ERROR_CODE_NS),
    [manifest],
  );

  const [activeNs, setActiveNs] = useState(dicts[0]?.ns ?? '');

  // 选中字典的行，并记下每行在全量数组里的下标（语种值按该下标对齐）
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

  const errorCode = manifest.nsList.find((n) => n.ns === ERROR_CODE_NS);

  if (dicts.length === 0) {
    return <p className="text-muted-foreground text-sm">没有找到 {DICT_PREFIX} 下的字典。</p>;
  }

  const totalKeys = dicts.reduce((s, d) => s + d.keyCount, 0);

  return (
    <div className="space-y-3">
      {/* 整个 Tab 的说明，不随选中的字典变化 —— 放在选中项标题下面会被误读成那一项的描述 */}
      <p className="text-muted-foreground text-xs leading-relaxed">
        这些字典与 antelope 数据字典一一对应：ns 名由 <code className="font-mono">dictToNs()</code>、
        key 由 <code className="font-mono">dictToKey()</code> 从字典 code 推导，
        <strong className="text-foreground font-medium">改名等于改 key</strong>，必须和数据字典同步。
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          {/* 统计信息放进卡片内当表头，两列的卡片上边缘才能对齐 */}
          <div className="overflow-hidden rounded-lg border">
            {/* min-h-11 与右侧卡片一致 —— 并排的两条 muted 色带高度不同会很明显 */}
            <div className="bg-muted/50 text-muted-foreground flex min-h-11 items-center border-b px-3 text-xs">
              {dicts.length} 个字典 · 共 {totalKeys} 条
            </div>
            <nav className="max-h-[26vh] overflow-auto p-1 lg:max-h-[calc(62vh-2.75rem)]">
              {dicts.map((d) => (
                <button
                  key={d.ns}
                  type="button"
                  onClick={() => setActiveNs(d.ns)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                    d.ns === activeNs ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <span className="truncate font-mono">{shortName(d.ns)}</span>
                  <span className={d.ns === activeNs ? 'opacity-70' : 'text-muted-foreground'}>
                    {d.keyCount}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          {errorCode && (
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              错误码（{errorCode.keyCount} 条）在独立的「错误码」Tab —— 它是后端同事的工作面。
            </p>
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
            keyStyle="dotted"
            scope={shortName(activeNs)}
            {...rest}
          />
        </div>
      </div>
    </div>
  );
}
