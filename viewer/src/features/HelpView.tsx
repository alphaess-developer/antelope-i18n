/*
 * 帮助 Tab —— 按「要做什么」组织的操作说明
 *
 * 结构是「三类任务 → 共同的写回流程 → 共同的约束」，**共同部分只有一份**：
 * 同一个人可能既走查业务文案、又顺手加一条错误码，若按身份把共同部分（怎么写回仓库、
 * 要守哪些约束）在每节里各写一遍，改一处就会漏一处。
 *
 * 「三类任务」那一节**另有一个身份筛选**（全部 / 产品 / 后端）—— 它只隐藏不相关的任务卡，
 * 不复制任何内容，所以与上面那条不冲突。上面反对的是共同部分被复制，不是反对帮人
 * 快速找到自己那一类。见 viewer-spec.md §4.7。
 *
 * 配色沿用 PlaceholderText 的视觉词汇：中性底 = 正确写法，destructive = 在本项目会失效的写法。
 * 用户在主表格里看到的占位符高亮和这里的示例是同一套语言，不用二次学习。
 */
import { useState, type ComponentType, type ReactNode } from 'react';
import {
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FilePlus2,
  FileSearch,
  GitPullRequest,
  Hash,
  ShieldCheck,
  SquarePen,
  TriangleAlert,
  X,
} from 'lucide-react';
import { docUrl } from '@/lib/data';

type Icon = ComponentType<{ className?: string }>;

/** 行内代码。tone="bad" 用于「会失效的写法」，与主表格里双花括号的标红一致 */
function Code({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'bad' }) {
  return (
    <code
      className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${
        tone === 'bad' ? 'bg-destructive/10 text-destructive' : 'bg-muted'
      }`}
    >
      {children}
    </code>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: Icon;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="text-muted-foreground size-4" />
          {title}
        </h3>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** 卡片表头 —— min-h-11 与 viewer 其它并排卡片保持同高（viewer-spec.md §4.2） */
function CardHead({ icon: Icon, title }: { icon: Icon; title: string }) {
  return (
    <div className="bg-muted/50 flex min-h-11 items-center gap-2 border-b px-3 py-2">
      <Icon className="size-4 shrink-0" />
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="text-muted-foreground flex gap-2 text-xs leading-relaxed">
          <span className="bg-muted text-foreground/70 mt-px flex size-4 shrink-0 items-center justify-center rounded font-mono text-[10px]">
            {i + 1}
          </span>
          <span className="min-w-0">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** 正确 / 错误写法对照 —— 图标 + 底色双重区分，不只靠颜色（深浅色模式下都成立） */
function GoodBad({ good, bad }: { good?: string; bad?: string }) {
  return (
    <div className="flex flex-col gap-1 font-mono text-[11px]">
      {good && (
        <span className="flex items-start gap-1.5">
          <Check className="mt-0.5 size-3 shrink-0" />
          <span className="bg-muted rounded px-1 py-0.5">{good}</span>
        </span>
      )}
      {bad && (
        <span className="text-destructive flex items-start gap-1.5">
          <X className="mt-0.5 size-3 shrink-0" />
          <span className="bg-destructive/10 rounded px-1 py-0.5">{bad}</span>
        </span>
      )}
    </div>
  );
}

function DocLink({ repo, path, children }: { repo: string; path: string; children: ReactNode }) {
  return (
    <a
      href={docUrl(repo, path)}
      target="_blank"
      rel="noreferrer"
      className="hover:text-foreground underline underline-offset-2"
    >
      {children}
    </a>
  );
}

/** 任务卡：一类任务一张，卡片内是「何时/在哪 → 步骤 →（可选分支）→ 提醒」 */
function TaskCard({
  icon,
  title,
  lead,
  steps,
  extra,
  note,
}: {
  icon: Icon;
  title: string;
  lead: ReactNode;
  steps: ReactNode[];
  /** 步骤之后的补充块。用于「二选一」这种不该编号的分支 —— 编号会读成先后顺序 */
  extra?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <CardHead icon={icon} title={title} />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <p className="text-muted-foreground text-xs leading-relaxed">{lead}</p>
        <Steps items={steps} />
        {extra}
        {note && <div className="mt-auto border-t pt-2.5 text-xs leading-relaxed">{note}</div>}
      </div>
    </div>
  );
}

/** 「二选一」里的一个选项 */
function Option({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-md p-2">
      <p className="text-xs font-medium">{label}</p>
      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{children}</p>
    </div>
  );
}

const PIPELINE = ['提 PR', 'CI 自动校验', '绿了才能合并', '宿主项目重新构建', '线上生效'];

const RULES: { title: string; body?: ReactNode; good?: string; bad?: string }[] = [
  {
    title: '占位符是单花括号',
    body: (
      <>
        宿主项目配置为 <Code>{"prefix: '{'"}</Code> / <Code>{"suffix: '}'"}</Code>，
        双花括号插值会<strong className="text-foreground font-medium">失效</strong>。 i18next
        默认写法就是双花括号，凭习惯写就会错。
      </>
    ),
    good: '{name}',
    bad: '{{name}}',
  },
  {
    title: '占位符名绝不能翻译',
    body: (
      <>
        各语种的占位符集合必须与 <Code>en-US</Code> 完全一致。翻了变量名，用户就会看到{' '}
        <Code tone="bad">{'{Land} / X'}</Code> 这种字面量。
      </>
    ),
    good: 'de-DE: {country}',
    bad: 'de-DE: {Land}',
  },
  {
    title: '一层扁平，值必须是字符串',
    body: (
      <>
        字典的 key 天生带点号（如 <Code>status.online</Code>），那仍是
        <strong className="text-foreground font-medium">一层扁平 JSON</strong>，
        只是 key 字符串里有点号 —— 不是嵌套对象。
      </>
    ),
    good: '{ "status.online": "Online" }',
    bad: '{ "status": { "online": "…" } }',
  },
  {
    title: 'key 顺序不是字典序',
    body: (
      <>
        由 <Code>canonicalKeyOrder</Code> 决定：整数键按<strong className="text-foreground font-medium">数值</strong>
        升序，其余按字典序。别手工按字母排，跑 <Code>node tools/sort-keys.mjs --write</Code> 修。
      </>
    ),
  },
];

/**
 * 身份筛选 —— 只作用于「三类任务」这一节。
 *
 * ⚠️ 共同部分（写回仓库、必须遵守、相关文档）**不跟着切换**，永远是共享的一份。
 * 这是 viewer-spec.md §4.7 那条「按功能不按身份」的实际约束所在：它反对的是把共同部分
 * 在每个身份下各复制一遍（改一处漏一处），不是反对帮人快速找到自己那一类。
 * 筛选只隐藏不相关的任务卡，一份内容仍然只有一份。
 */
type Role = 'all' | 'pm' | 'backend';

const ROLES: { key: Role; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pm', label: '产品同事' },
  { key: 'backend', label: '后端同事' },
];

const DOCS: { path: string; name: string; desc: string }[] = [
  { path: 'README.md', name: 'README', desc: '仓库入口与目录结构' },
  { path: 'CLAUDE.md', name: 'CLAUDE.md', desc: '完整硬规则清单，拿不准就查这个' },
  { path: 'docs/translating.md', name: 'docs/translating.md', desc: '译文产出流程、用 AI 生成的规则' },
  { path: 'docs/backend-guide.md', name: 'docs/backend-guide.md', desc: '错误码三步走，可直接转发' },
  { path: 'docs/glossary-guide.md', name: 'docs/glossary-guide.md', desc: '术语库模型与维护方式' },
];

export function HelpView({ repo }: { repo: string }) {
  const [role, setRole] = useState<Role>('all');
  /** 该任务卡在当前筛选下要不要显示 */
  const show = (owner: Role) => role === 'all' || role === owner;

  return (
    <div className="max-w-5xl space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-base font-medium">怎么改文案</h2>
        <p className="text-muted-foreground text-xs leading-relaxed">
          改文案只需要浏览器，不用装任何东西。
          <strong className="text-foreground font-medium">本页只读</strong> —— 查看、搜索、导出在这里做；
          「改」走 GitHub，登录与仓库权限由 GitHub 自己管。
        </p>
      </div>

      <Section
        icon={FileSearch}
        title="三类任务"
        hint={
          <span className="flex flex-wrap items-center gap-1.5">
            <span>按你要做什么选一类</span>
            <span className="text-muted-foreground/50">·</span>
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                aria-pressed={role === r.key}
                className={`rounded border px-1.5 py-0.5 text-xs transition-colors ${
                  role === r.key
                    ? 'bg-foreground text-background border-transparent'
                    : 'hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </span>
        }
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {show('pm') && (
          <TaskCard
            icon={FileSearch}
            title="走查并修正已有译文"
            lead="某个功能模块开发完成，要对它涉及的文案做一次检查。"
            steps={[
              <>
                在「主表格」搜模块相关的 namespace / key，或在「字典」Tab 左侧列表里找对应字典。
              </>,
              <>
                点该 namespace 分组标题行上的{' '}
                <Download className="inline size-3 align-[-0.1em]" /> 图标，
                <strong className="text-foreground font-medium">只导出这一个 namespace</strong>
                （Excel 或 JSON，语种范围可选）。
              </>,
              <>
                在 Excel 里走查。只改译文列 —— <Code>namespace</Code> 与 <Code>key</Code> 两列别动，
                写回时要靠它们定位到原文件的哪一行。
              </>,
              <>
                照着 Excel 改 <Code>{'locales/<ns>/<lang>.json'}</Code>，见下方「写回仓库」。
              </>,
            ]}
            note={
              <p className="text-muted-foreground">
                ⚠️ Excel <strong className="text-foreground font-medium">还不能自动导回</strong>，
                第 4 步是手工改 JSON。批量导入见 README 的「后续待建」。
              </p>
            }
          />
          )}

          {show('pm') && (
          <TaskCard
            icon={FilePlus2}
            title="新增文案"
            lead={
              <>
                新功能需要新的 key。<Code>en-US</Code> 必须有（它是源），
                其余 10 个语种<strong className="text-foreground font-medium">你填或自动化填都行</strong>。
              </>
            }
            steps={[
              <>
                先在 <Code>{'locales/<ns>/en-US.json'}</Code> 加 key。
                <span className="text-muted-foreground">
                  {' '}
                  缺了它这条 key 就没有源文，CI 会按「多余 key」报错。
                </span>
              </>,
            ]}
            extra={
              <div className="space-y-1.5">
                <p className="text-xs font-medium">其余 10 个语种，二选一：</p>
                <Option label="手上没有真译文">
                  直接提 PR，<Code>fill-missing</Code> 自动用英文占位补齐（CI 才能转绿），之后再替换。
                </Option>
                <Option label="手上已有真译文（供应商 / AI 产出）">
                  11 个语种一起填，比英文占位好。先跑{' '}
                  <Code>node tools/fill-missing.mjs --write</Code> 打好格式正确的占位，再逐个替换值。
                </Option>
              </div>
            }
            note={
              <div className="space-y-1.5">
                <GoodBad bad="自己编不熟的语种 —— 占位符错位、术语跑偏比英文占位更难查" />
                <p className="text-muted-foreground">
                  用占位补齐的，目前<strong className="text-foreground font-medium">没有</strong>
                  汇总清单可查「哪些还是占位」，只能看 fill-missing 那次自动提交的 diff。
                </p>
              </div>
            }
          />
          )}

          {show('backend') && (
          <TaskCard
            icon={Hash}
            title="新增 / 修正错误码"
            lead={
              <>
                都在 <Code>locales/dictionaries/error-code/</Code>，key 就是后端返回的错误码数字。
              </>
            }
            steps={[
              <>
                新增只改 <Code>en-US.json</Code>，插在哪一行不用纠结 —— CI 会按
                <strong className="text-foreground font-medium">数值</strong>重排。
              </>,
              <>
                占位符 <Code>{'{0}'}</Code> <Code>{'{sn}'}</Code> 是后端传的参数，
                <strong className="text-foreground font-medium">序号和变量名都不能改</strong>。
              </>,
              <>修正已有的：直接改对应语种文件即可。</>,
            ]}
            note={
              <p className="text-muted-foreground">
                完整三步走见{' '}
                <DocLink repo={repo} path="docs/backend-guide.md">
                  docs/backend-guide.md
                </DocLink>
                ，可直接转发给后端同事。
              </p>
            }
          />
          )}
        </div>
      </Section>

      <Section icon={GitPullRequest} title="写回仓库" hint="三类任务都走这一步">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="overflow-hidden rounded-lg border">
              <CardHead icon={SquarePen} title="改几条 —— 网页直接编辑" />
              <div className="text-muted-foreground p-3 text-xs leading-relaxed">
                在 GitHub 上打开文件 → 点 ✏️ → 改 → Commit。适合改一两个错别字。
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <CardHead icon={SquarePen} title="改得多 —— github.dev" />
              <div className="text-muted-foreground p-3 text-xs leading-relaxed">
                在仓库页面按 <kbd className="bg-muted rounded px-1 py-0.5 font-mono">.</kbd> 键，
                浏览器里直接打开完整的 VS Code，零安装。可多语种文件并排对照、全局搜索。
                改完从左侧「源代码管理」提交，会自动开 PR。
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <CardHead icon={Bot} title="不想碰 git —— 让 AI 提 PR" />
              <div className="text-muted-foreground space-y-1.5 p-3 text-xs leading-relaxed">
                <p>
                  把 <DocLink repo={repo} path="prompts/README.md">prompts/</DocLink>{' '}
                  里对应任务的提示词整份粘给 AI 助手，填最后的「参数」一节。它改完会自跑校验，
                  <strong className="text-foreground font-medium">自己建分支、提 PR</strong>。
                </p>
                <p>
                  你只需在 GitHub 上审 PR。
                  <strong className="text-foreground font-medium">合并这一步永远是人点</strong>
                  —— AI 不执行合并。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 rounded-lg border p-3 text-xs">
            {PIPELINE.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="bg-muted rounded px-1.5 py-0.5">{s}</span>
                {i < PIPELINE.length - 1 && (
                  <ChevronRight className="text-muted-foreground/50 size-3 shrink-0" />
                )}
              </span>
            ))}
          </div>

          <div className="text-muted-foreground flex gap-2.5 text-xs leading-relaxed">
            <ShieldCheck className="mt-px size-4 shrink-0" />
            <p>
              <strong className="text-foreground font-medium">改不坏东西。</strong>
              <Code>main</Code> 有分支保护，所有改动必须走 PR 且 CI 通过才能合并 ——
              JSON 语法错、漏了某个语种、占位符丢失，都会在合并之前被挡住。合并后本页数据会自动重新生成，
              一两分钟后刷新就是最新的。
            </p>
          </div>
        </div>
      </Section>

      <Section icon={TriangleAlert} title="必须遵守" hint="以下都是 CI 阻塞级检查 —— 写错 PR 合不进去">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {RULES.map((r) => (
              <div key={r.title} className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">{r.title}</p>
                {r.body && (
                  <p className="text-muted-foreground text-xs leading-relaxed">{r.body}</p>
                )}
                {(r.good || r.bad) && <GoodBad good={r.good} bad={r.bad} />}
              </div>
            ))}
          </div>

          {/* D10 的硬性约束：Pages 是公开的，所以这条必须出现在使用规范里 */}
          <div className="border-destructive/30 bg-destructive/5 flex gap-2.5 rounded-lg border p-3">
            <TriangleAlert className="text-destructive mt-px size-4 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">严禁把非 UI 文案放进翻译库</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                密钥、内部标识、未公开产品名、客户信息 —— 都不行。译文最终会进公开的前端 bundle，
                <strong className="text-foreground font-medium">本查看页也是公开的</strong>
                ，放进来等于对外发布。
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section icon={BookOpen} title="相关文档">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DOCS.map((d) => (
            <a
              key={d.path}
              href={docUrl(repo, d.path)}
              target="_blank"
              rel="noreferrer"
              className="hover:bg-muted/50 group rounded-lg border p-2.5 transition-colors"
            >
              <p className="flex items-center gap-1 font-mono text-xs font-medium">
                <span className="truncate">{d.name}</span>
                <ExternalLink className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{d.desc}</p>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}
