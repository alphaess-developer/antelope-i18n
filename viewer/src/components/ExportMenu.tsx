import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportJson, exportXlsx, stamp } from '@/lib/export';
import type { Manifest, Row } from '@/lib/data';

interface Props {
  /** 当前筛选后的行 */
  rows: Row[];
  /** rows[i] 在全量数组里的下标 */
  indices: number[];
  manifest: Manifest;
  selectedLangs: string[];
  values: Record<string, (string | null)[]>;
  ensure: (langs: string[]) => Promise<void>;
  /** 文件名后缀，用于区分主表格与错误码 */
  scope?: string;
  /** 紧凑模式：图标按钮，用于分组标题行这类空间受限的地方（单 ns 导出） */
  compact?: boolean;
}

export function ExportMenu({
  rows,
  indices,
  manifest,
  selectedLangs,
  values,
  ensure,
  scope,
  compact = false,
}: Props) {
  const [busy, setBusy] = useState(false);

  const fileName = [stamp(manifest.commit), scope].filter(Boolean).join('-');

  const run = async (format: 'xlsx' | 'json', langs: string[]) => {
    setBusy(true);
    try {
      // 全量导出前先把还没加载的语种拉齐
      await ensure(langs);
      const opts = { rows, indices, langs, values, baseLang: manifest.baseLang, fileName };
      if (format === 'xlsx') await exportXlsx(opts);
      else exportJson(opts);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={busy || rows.length === 0}
            title={`导出 ${scope ?? ''}`.trim()}
            onClick={(e) => e.stopPropagation()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy || rows.length === 0}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            导出
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          当前筛选 {rows.length.toLocaleString()} 行 · {selectedLangs.length + 1} 个语种
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void run('xlsx', selectedLangs)}>
          <FileSpreadsheet />
          Excel（当前筛选）
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('json', selectedLangs)}>
          <FileJson />
          JSON（当前筛选）
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          全部 {manifest.targets.length + 1} 个语种
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void run('xlsx', manifest.targets)}>
          <FileSpreadsheet />
          Excel（全部语种）
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('json', manifest.targets)}>
          <FileJson />
          JSON（全部语种）
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="text-muted-foreground px-2 py-1.5 text-xs">在浏览器内生成，不经过后端</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
