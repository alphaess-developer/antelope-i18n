/*
 * 术语库 Tab —— 概念导向的术语表（glossary/terms.json）
 * preferred = 推荐译法，deprecated = 不要再用，dnt = 任何语种都不翻译
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { GlossaryEntry } from '@/lib/data';

export function GlossaryView({ glossary }: { glossary: GlossaryEntry[] }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!q) return glossary;
    return glossary.filter((e) => {
      const haystack = [e.id, e.domain ?? '', e.definition ?? '']
        .concat(Object.values(e.terms).flatMap((ts) => ts.map((t) => t.text)))
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [glossary, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索概念 / 定义 / 术语"
            className="pl-8"
          />
        </div>
        <span className="text-muted-foreground text-xs">
          {rows.length} / {glossary.length} 个概念
        </span>
      </div>

      <div className="max-h-[68vh] overflow-auto rounded-lg border">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-56">概念</TableHead>
              <TableHead className="w-64">定义</TableHead>
              <TableHead>各语种译法</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="align-top">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs">{entry.id}</span>
                    {entry.dnt && (
                      <Badge variant="destructive" title="任何语种均不翻译">
                        DNT
                      </Badge>
                    )}
                  </div>
                  {entry.domain && (
                    <div className="text-muted-foreground mt-1 text-xs">{entry.domain}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground align-top text-xs">
                  {entry.definition}
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-1">
                    {Object.entries(entry.terms).map(([lang, terms]) => (
                      <div key={lang} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground w-14 shrink-0 font-mono text-xs">
                          {lang}
                        </span>
                        {terms.map((t) => (
                          <Badge
                            key={t.text}
                            variant={t.status === 'preferred' ? 'secondary' : 'outline'}
                            className={t.status === 'deprecated' ? 'text-muted-foreground line-through' : ''}
                            title={t.status}
                          >
                            {t.text}
                          </Badge>
                        ))}
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground h-24 text-center">
                  没有匹配的概念
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
