/*
 * 主表格 —— 5,882 行虚拟滚动 + 搜索 + 筛选 + 对照语种懒加载
 *
 * 错误码 Tab 复用同一个组件（rows 传单个 ns、showGroups=false）。
 */
import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, FlipHorizontal, Languages, ListChecks, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportMenu } from '@/components/ExportMenu';
import { Highlight, PlaceholderText } from '@/components/PlaceholderText';
import { SPECIAL_ERROR_KEYS, type Manifest, type Row } from '@/lib/data';

const ROW_H = 37;
const GROUP_H = 33;

type Item =
  | { kind: 'group'; ns: string; count: number; rows: Row[]; indices: number[] }
  | { kind: 'row'; row: Row; idx: number };

/**
 * key 单元格。`dotted` 模式下把 `parent.child` 的父级前缀压暗并缩进一格，
 * 让「字典项 → 取值」的层级一眼可见。前缀与后缀分开渲染，所以跨点号的
 * 搜索词不会被高亮 —— 那种搜法本身也没有意义。
 */
function KeyLabel({
  keyName,
  query,
  keyStyle,
}: {
  keyName: string;
  query: string;
  keyStyle: 'plain' | 'dotted';
}) {
  const dot = keyStyle === 'dotted' ? keyName.indexOf('.') : -1;
  if (dot <= 0) {
    return (
      <span className="truncate">
        <Highlight text={keyName} query={query} />
      </span>
    );
  }
  return (
    <span className="flex min-w-0 pl-3">
      <span className="text-muted-foreground/60 shrink-0">
        <Highlight text={keyName.slice(0, dot)} query={query} />
      </span>
      <span className="truncate">
        <Highlight text={keyName.slice(dot)} query={query} />
      </span>
    </span>
  );
}

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
  /**
   * key 的渲染方式。
   * `dotted` 会把 `parent.child` 的父级前缀压暗并缩进 —— 字典 Tab 用它显示
   * 「字典项 → 取值」的两级结构（key 仍是一层扁平的，只是字符串里有点号）
   */
  keyStyle?: 'plain' | 'dotted';
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
  keyStyle = 'plain',
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
    let group: Extract<Item, { kind: 'group' }> | null = null;
    filtered.rows.forEach((row, i) => {
      if (row.ns !== curNs) {
        curNs = row.ns;
        group = { kind: 'group', ns: row.ns, count: 0, rows: [], indices: [] };
        out.push(group);
      }
      if (group) {
        group.count += 1;
        group.rows.push(row);
        group.indices.push(filtered.indices[i]);
      }
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

  /** 始终按 languages.json 里的声明顺序排列，避免列的位置随点击顺序乱跳 */
  const inDeclaredOrder = (langs: string[]) =>
    manifest.targets.filter((l) => langs.includes(l));

  const applyLangs = async (langs: string[]) => {
    const next = inDeclaredOrder(langs);
    onSelectedLangsChange(next);
    await ensure(next);
  };

  const toggleLang = (lang: string) =>
    applyLangs(
      selectedLangs.includes(lang)
        ? selectedLangs.filter((l) => l !== lang)
        : [...selectedLangs, lang],
    );

  const allSelected = selectedLangs.length === manifest.targets.length;

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
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void applyLangs(allSelected ? [] : manifest.targets);
              }}
            >
              <ListChecks />
              {allSelected ? '全部取消' : '全选'}
              <span className="text-muted-foreground ml-auto text-xs">
                {allSelected ? '' : `${manifest.targets.length} 个 · 约 770 KB`}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void applyLangs(manifest.targets.filter((l) => !selectedLangs.includes(l)));
              }}
            >
              <FlipHorizontal />
              反选
              <span className="text-muted-foreground ml-auto text-xs">
                {manifest.targets.length - selectedLangs.length} 个
              </span>
            </DropdownMenuItem>
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
          <TableHeader className="bg-background sticky top-0 z-20">
            <TableRow>
              {/* key 列左侧固定：横向滚动看远处语种时仍然知道自己在看哪一条 */}
              <TableHead className="bg-background sticky left-0 z-30" style={{ width: 260 }}>
                key
              </TableHead>
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
                    className="bg-muted hover:bg-muted cursor-pointer"
                    onClick={() => toggleGroup(item.ns)}
                  >
                    <TableCell colSpan={colCount} className="h-[33px] px-0 py-0">
                      {/* 分组行横跨全表，让标签本身贴左固定，横向滚动时 ns 名不会滑走 */}
                      <span className="bg-muted sticky left-0 inline-flex items-center gap-1.5 py-2 pr-3 pl-2">
                        {collapsed.has(item.ns) ? (
                          <ChevronRight className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                        <span className="font-mono text-xs">
                          <Highlight text={item.ns} query={q} />
                        </span>
                        <span className="text-muted-foreground text-xs">{item.count} key</span>
                        {/* 单独一层拦掉冒泡 —— DropdownMenuContent 走 portal，但 React 合成事件仍按组件树冒泡，
                            不拦会连带触发这一行外层的折叠/展开 */}
                        <span onClick={(e) => e.stopPropagation()}>
                          <ExportMenu
                            rows={item.rows}
                            indices={item.indices}
                            manifest={manifest}
                            selectedLangs={selectedLangs}
                            values={values}
                            ensure={ensure}
                            scope={item.ns.replace(/\//g, '-')}
                            compact
                          />
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              }
              const special = markSpecialKeys ? SPECIAL_ERROR_KEYS[item.row.key] : undefined;
              return (
                <TableRow
                  key={`${item.row.ns}::${item.row.key}`}
                  className="group/row hover:bg-muted h-[37px]"
                >
                  {/* 左侧固定列的背景必须是不透明的，否则横向滚动时下层文字会透上来。
                      hover 用不透明的 bg-muted（而非默认的 bg-muted/50）才能与整行颜色一致 */}
                  <TableCell className="bg-background group-hover/row:bg-muted sticky left-0 z-10 py-0 align-middle font-mono text-xs">
                    <span className="flex items-center gap-1.5 truncate" title={item.row.key}>
                      <KeyLabel keyName={item.row.key} query={q} keyStyle={keyStyle} />
                      {special && (
                        <Badge variant="outline" title={special} className="shrink-0">
                          特殊
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-0 align-middle">
                    <div className="truncate" title={item.row.en}>
                      <PlaceholderText value={item.row.en} query={q} />
                    </div>
                  </TableCell>
                  {selectedLangs.map((lang) => {
                    const v2 = values[lang]?.[item.idx];
                    return (
                      <TableCell key={lang} className="py-0 align-middle">
                        <div className="truncate" title={v2 ?? '缺译文'}>
                          {values[lang] ? (
                            <PlaceholderText value={v2} query={q} />
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
