/*
 * 主表格 —— 5,882 行虚拟滚动 + 搜索 + 筛选 + 对照语种懒加载
 *
 * 错误码 Tab 复用同一个组件（rows 传单个 ns、showGroups=false）。
 */
import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, Languages, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportMenu } from '@/components/ExportMenu';
import { PlaceholderText } from '@/components/PlaceholderText';
import { SPECIAL_ERROR_KEYS, type Manifest, type Row } from '@/lib/data';

const ROW_H = 37;
const GROUP_H = 33;

type Item =
  | { kind: 'group'; ns: string; count: number }
  | { kind: 'row'; row: Row; idx: number };

interface Props {
  rows: Row[];
  /** rows[i] 在全量数组里的下标 —— 语种值数组按这个下标对齐 */
  indices: number[];
  manifest: Manifest;
  selectedLangs: string[];
  onSelectedLangsChange: (langs: string[]) => void;
  values: Record<string, (string | null)[]>;
  loadingLangs: string[];
  ensure: (langs: string[]) => Promise<void>;
  /** 是否按 namespace 分组（错误码 Tab 只有一个 ns，不需要） */
  showGroups?: boolean;
  /** 标出特殊 key（错误码 Tab 用） */
  markSpecialKeys?: boolean;
  scope?: string;
}

export function TranslationsView({
  rows,
  indices,
  manifest,
  selectedLangs,
  onSelectedLangsChange,
  values,
  loadingLangs,
  ensure,
  showGroups = true,
  markSpecialKeys = false,
  scope,
}: Props) {
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const outRows: Row[] = [];
    const outIdx: number[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const idx = indices[i];
      if (onlyMissing && !selectedLangs.some((l) => values[l] && values[l][idx] === null)) continue;
      if (q) {
        const hit =
          row.ns.toLowerCase().includes(q) ||
          row.key.toLowerCase().includes(q) ||
          row.en.toLowerCase().includes(q) ||
          selectedLangs.some((l) => values[l]?.[idx]?.toLowerCase().includes(q));
        if (!hit) continue;
      }
      outRows.push(row);
      outIdx.push(idx);
    }
    return { rows: outRows, indices: outIdx };
  }, [rows, indices, q, onlyMissing, selectedLangs, values]);

  const items = useMemo<Item[]>(() => {
    if (!showGroups) {
      return filtered.rows.map((row, i) => ({ kind: 'row', row, idx: filtered.indices[i] }));
    }
    const out: Item[] = [];
    let curNs: string | null = null;
    let group: { kind: 'group'; ns: string; count: number } | null = null;
    filtered.rows.forEach((row, i) => {
      if (row.ns !== curNs) {
        curNs = row.ns;
        group = { kind: 'group', ns: row.ns, count: 0 };
        out.push(group);
      }
      if (group) group.count += 1;
      if (!collapsed.has(row.ns)) out.push({ kind: 'row', row, idx: filtered.indices[i] });
    });
    return out;
  }, [filtered, collapsed, showGroups]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (items[i].kind === 'group' ? GROUP_H : ROW_H),
    overscan: 16,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;
  const colCount = 2 + selectedLangs.length;

  const toggleLang = async (lang: string) => {
    const next = selectedLangs.includes(lang)
      ? selectedLangs.filter((l) => l !== lang)
      : [...selectedLangs, lang].sort((a, b) => manifest.targets.indexOf(a) - manifest.targets.indexOf(b));
    onSelectedLangsChange(next);
    await ensure(next);
  };

  const toggleGroup = (ns: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 namespace / key / 任意语种译文"
            className="pl-8"
          />
        </div>

        <Button
          variant={onlyMissing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyMissing((v) => !v)}
          title="只看已选语种里缺译文的行"
        >
          仅看缺失
          {onlyMissing && <X />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {loadingLangs.length > 0 ? <Loader2 className="animate-spin" /> : <Languages />}
              对照语种 {selectedLangs.length}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              选中后按需加载该语种数据
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {manifest.targets.map((lang) => (
              <DropdownMenuCheckboxItem
                key={lang}
                checked={selectedLangs.includes(lang)}
                onCheckedChange={() => void toggleLang(lang)}
                onSelect={(e) => e.preventDefault()}
              >
                <span className="font-mono text-xs">{lang}</span>
                {manifest.langStats[lang]?.missing > 0 && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    缺 {manifest.langStats[lang].missing}
                  </span>
                )}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ExportMenu
          rows={filtered.rows}
          indices={filtered.indices}
          manifest={manifest}
          selectedLangs={selectedLangs}
          values={values}
          ensure={ensure}
          scope={scope}
        />
      </div>

      <div className="text-muted-foreground text-xs">
        {filtered.rows.length.toLocaleString()} / {rows.length.toLocaleString()} 行
        {q && ` · 匹配「${search.trim()}」`}
      </div>

      <div ref={scrollRef} className="h-[68vh] overflow-auto rounded-lg border">
        <table
          className="w-full caption-bottom text-sm"
          style={{ minWidth: 260 + (1 + selectedLangs.length) * 260, tableLayout: 'fixed' }}
        >
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead style={{ width: 260 }}>key</TableHead>
              <TableHead>
                <span className="font-mono text-xs">{manifest.baseLang}</span>
                <span className="text-muted-foreground ml-1">基准</span>
              </TableHead>
              {selectedLangs.map((lang) => (
                <TableHead key={lang}>
                  <span className="font-mono text-xs">{lang}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && <tr style={{ height: paddingTop }} />}
            {virtualRows.map((v) => {
              const item = items[v.index];
              if (item.kind === 'group') {
                return (
                  <TableRow
                    key={`g-${item.ns}`}
                    className="bg-muted/50 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleGroup(item.ns)}
                  >
                    <TableCell colSpan={colCount} className="h-[33px] py-0">
                      <span className="inline-flex items-center gap-1.5">
                        {collapsed.has(item.ns) ? (
                          <ChevronRight className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                        <span className="font-mono text-xs">{item.ns}</span>
                        <span className="text-muted-foreground text-xs">{item.count} key</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              }
              const special = markSpecialKeys ? SPECIAL_ERROR_KEYS[item.row.key] : undefined;
              return (
                <TableRow key={`${item.row.ns}::${item.row.key}`} className="h-[37px]">
                  <TableCell className="py-0 align-middle font-mono text-xs">
                    <span className="flex items-center gap-1.5 truncate" title={item.row.key}>
                      <span className="truncate">{item.row.key}</span>
                      {special && (
                        <Badge variant="outline" title={special} className="shrink-0">
                          特殊
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-0 align-middle">
                    <div className="truncate" title={item.row.en}>
                      <PlaceholderText value={item.row.en} />
                    </div>
                  </TableCell>
                  {selectedLangs.map((lang) => {
                    const v2 = values[lang]?.[item.idx];
                    return (
                      <TableCell key={lang} className="py-0 align-middle">
                        <div className="truncate" title={v2 ?? '缺译文'}>
                          {values[lang] ? (
                            <PlaceholderText value={v2} />
                          ) : (
                            <span className="text-muted-foreground/60">…</span>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            {paddingBottom > 0 && <tr style={{ height: paddingBottom }} />}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-muted-foreground h-24 text-center">
                  没有匹配的行
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
