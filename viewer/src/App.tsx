import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslationsView } from '@/features/TranslationsView';
import { GlossaryView } from '@/features/GlossaryView';
import { BaselineView } from '@/features/BaselineView';
import { ERROR_CODE_NS, editUrl, useLangValues, useViewerData } from '@/lib/data';

/** 默认对照语种 —— 首屏只额外加载这一个语种的数据 */
const DEFAULT_LANGS = ['zh-CN'];

function useDarkMode() {
  const [dark, setDark] = useState(
    () =>
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches),
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark] as const;
}

export default function App() {
  const { data, error } = useViewerData();
  const { values, loading, ensure } = useLangValues();
  const [selectedLangs, setSelectedLangs] = useState<string[]>(DEFAULT_LANGS);
  const [dark, setDark] = useDarkMode();

  useEffect(() => {
    void ensure(DEFAULT_LANGS);
  }, [ensure]);

  // 全量行的下标就是它自己；错误码 Tab 需要把筛选后的行映射回原下标
  const allRows = useMemo(
    () => ({ rows: data?.rows ?? [], indices: (data?.rows ?? []).map((_, i) => i) }),
    [data],
  );
  const errorRows = useMemo(() => {
    const rows: typeof allRows.rows = [];
    const indices: number[] = [];
    (data?.rows ?? []).forEach((row, i) => {
      if (row.ns === ERROR_CODE_NS) {
        rows.push(row);
        indices.push(i);
      }
    });
    return { rows, indices };
  }, [data]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-2 text-lg font-medium">数据加载失败</h1>
        <p className="text-muted-foreground text-sm">{error}</p>
        <p className="text-muted-foreground mt-4 text-sm">
          本地开发请先跑一次 <code className="font-mono">npm run data</code> 生成 data/ 目录。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Antelope 翻译总览</h1>
          {data ? (
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              {data.manifest.nsList.length} ns · {data.manifest.targets.length + 1} 语种 ·{' '}
              {data.manifest.rowCount.toLocaleString()} 行 · 构建于{' '}
              {new Date(data.manifest.builtAt).toLocaleString('zh-CN')} · {data.manifest.commit}
            </p>
          ) : (
            <Skeleton className="mt-2 h-4 w-80" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => setDark(!dark)} aria-label="切换深浅色">
            {dark ? <Sun /> : <Moon />}
          </Button>
          {data && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://github.com/${data.manifest.repo}`} target="_blank" rel="noreferrer">
                <ExternalLink />
                仓库
              </a>
            </Button>
          )}
        </div>
      </header>

      <p className="text-muted-foreground text-xs">
        只读页面。要改文案请在仓库页面按 <kbd className="font-mono">.</kbd> 键进入 github.dev 编辑，
        合并后本页会自动重新构建。
      </p>

      {!data ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-[60vh] w-full" />
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              主表格
              <Badge variant="secondary">{data.manifest.rowCount.toLocaleString()}</Badge>
            </TabsTrigger>
            <TabsTrigger value="error-code">
              错误码
              <Badge variant="secondary">{errorRows.rows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="glossary">
              术语库
              <Badge variant="secondary">{data.manifest.glossaryCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="baseline">
              存量欠账
              <Badge variant={data.manifest.baselineCount > 0 ? 'destructive' : 'secondary'}>
                {data.manifest.baselineCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <TranslationsView
              rows={allRows.rows}
              indices={allRows.indices}
              manifest={data.manifest}
              selectedLangs={selectedLangs}
              onSelectedLangsChange={setSelectedLangs}
              values={values}
              loadingLangs={loading}
              ensure={ensure}
            />
          </TabsContent>

          <TabsContent value="error-code" className="mt-4 space-y-3">
            <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs leading-relaxed">
                后端同事的主要工作面。key 按<strong className="text-foreground font-medium">数值</strong>
                排序（不是字典序）；占位符 <code className="font-mono">{'{0}'}</code>{' '}
                <code className="font-mono">{'{sn}'}</code> 是后端传的参数，
                <strong className="text-foreground font-medium">序号和变量名都不能改</strong>。
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={editUrl(data.manifest.repo, ERROR_CODE_NS)} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  编辑 en-US.json
                </a>
              </Button>
            </div>
            <TranslationsView
              rows={errorRows.rows}
              indices={errorRows.indices}
              manifest={data.manifest}
              selectedLangs={selectedLangs}
              onSelectedLangsChange={setSelectedLangs}
              values={values}
              loadingLangs={loading}
              ensure={ensure}
              showGroups={false}
              markSpecialKeys
              scope="error-code"
            />
          </TabsContent>

          <TabsContent value="glossary" className="mt-4">
            <GlossaryView glossary={data.glossary} />
          </TabsContent>

          <TabsContent value="baseline" className="mt-4">
            <BaselineView baseline={data.baseline} repo={data.manifest.repo} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
