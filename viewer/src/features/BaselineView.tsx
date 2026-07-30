/*
 * 存量欠账 Tab —— .ci/baseline.json 的可读版本，是给 PM 的待办清单
 *
 * 这里列的是迁移时从翻译平台带过来的历史问题，CI 对清单内条目放行。
 * 修好一条就从 baseline 里删一条，这个页面会自然清空。
 */
import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { download } from '@/lib/export';
import { editUrl, type BaselineRow } from '@/lib/data';

const TYPE_LABEL: Record<string, { label: string; hint: string }> = {
  missingKeys: { label: '缺失 key', hint: '目标语种缺这条，运行时会回落成英文占位' },
  extraKeys: { label: '多余 key', hint: '目标语种有、基准语言没有' },
  doubleBrace: { label: '双花括号', hint: '{{x}} 在本项目配置下插值失效' },
  placeholderMismatch: { label: '占位符不一致', hint: '占位符名被翻译，用户会看到字面量' },
};

export function BaselineView({ baseline, repo }: { baseline: BaselineRow[]; repo: string }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string | null>(null);
  const q = search.trim().toLowerCase();

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of baseline) m[r.type] = (m[r.type] ?? 0) + 1;
    return m;
  }, [baseline]);

  const rows = useMemo(
    () =>
      baseline.filter((r) => {
        if (type && r.type !== type) return false;
        if (!q) return true;
        return `${r.ns} ${r.key} ${r.lang ?? ''}`.toLowerCase().includes(q);
      }),
    [baseline, type, q],
  );

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        从翻译平台迁移时带来的历史欠账，CI 对这些条目放行。
        <strong className="text-foreground font-medium">修好一条就从 .ci/baseline.json 删一条</strong>
        —— 绝不要为了让 CI 变绿往里加新条目。
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={type === null ? 'default' : 'outline'} size="sm" onClick={() => setType(null)}>
          全部 {baseline.length}
        </Button>
        {Object.entries(TYPE_LABEL).map(([key, meta]) => (
          <Button
            key={key}
            variant={type === key ? 'default' : 'outline'}
            size="sm"
            title={meta.hint}
            onClick={() => setType(key)}
            disabled={!counts[key]}
          >
            {meta.label} {counts[key] ?? 0}
          </Button>
        ))}
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 ns / key / 语种"
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => download('baseline.json', JSON.stringify(rows, null, 2), 'application/json')}
        >
          导出 JSON
        </Button>
      </div>

      <div className="max-h-[64vh] overflow-auto rounded-lg border">
        <table className="w-full caption-bottom text-sm" style={{ tableLayout: 'fixed' }}>
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-32">类型</TableHead>
              <TableHead className="w-64">namespace</TableHead>
              <TableHead>key</TableHead>
              <TableHead className="w-20">语种</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.type}-${r.ns}-${r.key}-${r.lang ?? ''}-${i}`}>
                <TableCell>
                  <Badge variant={r.type === 'missingKeys' ? 'outline' : 'destructive'}>
                    {TYPE_LABEL[r.type]?.label ?? r.type}
                  </Badge>
                </TableCell>
                <TableCell className="truncate font-mono text-xs" title={r.ns}>
                  {r.ns}
                </TableCell>
                <TableCell className="truncate font-mono text-xs" title={r.key}>
                  {r.key}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.lang ?? '—'}</TableCell>
                <TableCell>
                  <a
                    href={editUrl(repo, r.ns, r.lang ?? 'en-US')}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex"
                    title="在 GitHub 上打开该文件"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  {baseline.length === 0 ? '欠账已清零' : '没有匹配的条目'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
