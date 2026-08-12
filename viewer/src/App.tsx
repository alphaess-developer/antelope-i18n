import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, ExternalLink, Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslationsView } from '@/features/TranslationsView';
import { DictionariesView } from '@/features/DictionariesView';
import { ProductConfigView } from '@/features/ProductConfigView';
import { GlossaryView } from '@/features/GlossaryView';
import { BaselineView } from '@/features/BaselineView';
import { HelpView } from '@/features/HelpView';
import {
  DICT_PREFIX,
  ERROR_CODE_NS,
  PRODUCT_CONFIG_PREFIX,
  editUrl,
  useLangValues,
  useViewerData,
} from '@/lib/data';
import { readDeepLink, type TabValue, tabForNs, writeDeepLink } from '@/lib/deep-link';

/** 默认对照语种 —— 首屏只额外加载这一个语种的数据 */
const DEFAULT_LANGS = ['zh-CN'];

/** 自带 ns 列表、能消费深链 ns 的 Tab */
const NS_BROWSER_TABS: TabValue[] = ['dictionaries', 'product-config'];

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
  /** 深链只在首屏读一次，之后地址栏由本页反过来维护 */
  const [deepLink, setDeepLink] = useState(readDeepLink);
  const [tab, setTab] = useState<TabValue>(() => (deepLink.ns ? tabForNs(deepLink.ns) : 'all'));

  const handleTabChange = (value: string) => {
    const next = value as TabValue;
    setTab(next);
    // 深链是一次性的落地指令，人一旦自己切了 Tab 就不该再回填
    setDeepLink({});
    // 带 ns 列表的 Tab 会自己把选中项写回地址栏，其余 Tab 没有定位可言，直接清掉
    if (!NS_BROWSER_TABS.includes(next)) writeDeepLink({});
  };

  useEffect(() => {
    void ensure(DEFAULT_LANGS);
  }, [ensure]);

  // 全量行的下标就是它自己；错误码 Tab 需要把筛选后的行映射回原下标
  const allRows = useMemo(
    () => ({ rows: data?.rows ?? [], indices: (data?.rows ?? []).map((_, i) => i) }),
    [data],
  );
  const dictStats = useMemo(() => {
    const list = (data?.manifest.nsList ?? []).filter(
      (n) => n.ns.startsWith(DICT_PREFIX) && n.ns !== ERROR_CODE_NS,
    );
    return { count: list.length, keys: list.reduce((s, n) => s + n.keyCount, 0) };
  }, [data]);
  const productConfigStats = useMemo(() => {
    const list = (data?.manifest.nsList ?? []).filter((n) => n.ns.startsWith(PRODUCT_CONFIG_PREFIX));
    return { count: list.length, keys: list.reduce((s, n) => s + n.keyCount, 0) };
  }, [data]);

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
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">
              主表格
              <Badge variant="secondary">{data.manifest.rowCount.toLocaleString()}</Badge>
            </TabsTrigger>
            <TabsTrigger value="dictionaries" title={`${dictStats.count} 个字典 · ${dictStats.keys} 条`}>
              字典
              <Badge variant="secondary">{dictStats.count}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="product-config"
              title={`${productConfigStats.count} 个模块 · ${productConfigStats.keys} 条`}
            >
              产品配置
              <Badge variant="secondary">{productConfigStats.count}</Badge>
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
            <TabsTrigger value="help">
              <CircleHelp />
              帮助
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {/* 主表格没有 ns 列表，深链的 ns 只能当搜索词用 —— 搜索本来就同时匹配 ns */}
            <TranslationsView
              rows={allRows.rows}
              indices={allRows.indices}
              manifest={data.manifest}
              selectedLangs={selectedLangs}
              onSelectedLangsChange={setSelectedLangs}
              values={values}
              loadingLangs={loading}
              ensure={ensure}
              defaultQuery={deepLink.q ?? deepLink.ns}
            />
          </TabsContent>

          <TabsContent value="dictionaries" className="mt-4">
            <DictionariesView
              rows={allRows.rows}
              manifest={data.manifest}
              selectedLangs={selectedLangs}
              onSelectedLangsChange={setSelectedLangs}
              values={values}
              loadingLangs={loading}
              ensure={ensure}
              defaultNs={deepLink.ns}
              defaultQuery={deepLink.q}
              onLocate={writeDeepLink}
            />
          </TabsContent>

          <TabsContent value="product-config" className="mt-4">
            <ProductConfigView
              rows={allRows.rows}
              manifest={data.manifest}
              selectedLangs={selectedLangs}
              onSelectedLangsChange={setSelectedLangs}
              values={values}
              loadingLangs={loading}
              ensure={ensure}
              defaultNs={deepLink.ns}
              defaultQuery={deepLink.q}
              onLocate={writeDeepLink}
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

          <TabsContent value="help" className="mt-4">
            <HelpView repo={data.manifest.repo} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
