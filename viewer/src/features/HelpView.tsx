/*
 * 帮助 Tab —— 按「你是谁 + 你要做哪种事」分流，而不是按文档目录罗列
 *
 * 两个角色各有两个场景，共四张卡。分界线都是同一条：
 * 要动的文件超过一两个，就交给 AI —— 一条 key 落在 11 个语种文件里，手工做既慢又容易错。
 *
 * 产品的批量场景之所以也指向 AI：Excel **导入**回写尚未实现（README「后续待建」），
 * 导出 → 人工处理 → AI 回写提 PR 是当前唯一的批量路径。导入做出来后这张卡要改。
 *
 * 文字内容与 docs/backend-guide.md、docs/ai-agent-brief.md 是同一套说法的不同载体 ——
 * 改一处记得同步。
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ERROR_CODE_NS, editUrl } from '@/lib/data';

const BRIEF_PATH = 'docs/ai-agent-brief.md';

type Role = 'pm' | 'backend';

/** 委托话术 —— 与 docs/ai-agent-brief.md「怎么用」的两段保持一致 */
const PROMPTS: Record<Role, (briefUrl: string) => string> = {
  backend: (u) => `请按 ${u}
的「任务 A」规则，往 antelope-i18n 仓库提一个 PR。

新增/修改的错误码（英文基准）：
  6199 = Device {sn} is offline
  6200 = {0} has been locked, please try again in {1} minutes

需求背景：[一句话说明这批码的来源]
Jira：[ANTELOPE-xxxx，没有就写「无」]`,
  pm: (u) => `请按 ${u}
的「任务 B」规则，把附件里改好的译文回写进 antelope-i18n 仓库并提 PR。

附件：[从「导出」菜单下载的 xlsx / json 文件]
改动范围：[比如「device-form/battery 的 de-DE 和 fr-FR」]
说明：[比如「按新术语表统一了 Inverter 的译法」]`,
};

function docUrl(repo: string, path: string) {
  return `https://github.com/${repo}/blob/main/${path}`;
}

function Card({
  tag,
  title,
  when,
  children,
}: {
  tag: string;
  title: string;
  when: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="text-muted-foreground font-mono text-xs">{tag}</p>
        <h3 className="mt-0.5 font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{when}</p>
      </div>
      {children}
    </section>
  );
}

/** 可一键复制的委托话术块 */
function PromptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="bg-muted/50 overflow-x-auto rounded-md border p-3 pr-12 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {text}
      </pre>
      <Button
        variant="outline"
        size="icon-sm"
        className="bg-background absolute top-2 right-2"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        aria-label="复制话术"
        title="复制"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

/** 「你要做的只有三件事」—— 两个角色共用，首尾相同，中间的审核要点不同 */
function ReviewSteps({ first, middle }: { first: string; middle: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium">你要做的只有三件事</p>
      <ol className="text-muted-foreground mt-1.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
        <li>{first}</li>
        <li>{middle}</li>
        <li>CI 绿了找前端负责人合并</li>
      </ol>
    </div>
  );
}

function BriefLink({ repo }: { repo: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={docUrl(repo, BRIEF_PATH)} target="_blank" rel="noreferrer">
        <FileText />
        委托单全文 ai-agent-brief.md
      </a>
    </Button>
  );
}

/** 手工改一两条 —— 两个角色的「小改」路径完全一样，只有直达链接不同 */
function EditByHandCard({
  tag,
  title,
  when,
  children,
}: {
  tag: string;
  title: string;
  when: string;
  children: React.ReactNode;
}) {
  return (
    <Card tag={tag} title={title} when={when}>
      <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
        <li>
          在仓库文件页面按一下 <kbd className="text-foreground font-mono">.</kbd> 键 ——
          浏览器里直接打开完整 VS Code，零安装
        </li>
        <li>改完从左侧「源代码管理」提交，会自动开 PR</li>
        <li>CI 绿了就能合并</li>
      </ol>
      {children}
    </Card>
  );
}

export function HelpView({ repo }: { repo: string }) {
  const [role, setRole] = useState<Role>('pm');
  const briefUrl = docUrl(repo, BRIEF_PATH);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">你是：</span>
        <Button
          variant={role === 'pm' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRole('pm')}
        >
          产品同事
        </Button>
        <Button
          variant={role === 'backend' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRole('backend')}
        >
          后端同事
        </Button>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        两个角色的分界线是同一条：
        <strong className="text-foreground font-medium">要动的文件超过一两个，就交给 AI。</strong>
        一条 key 落在 11 个语种文件里，手工塞既慢又容易错。
      </p>

      {role === 'pm' ? (
        <>
          <EditByHandCard
            tag="场景 1"
            title="改一条 / 几条译文 —— 自己动手"
            when="措辞调整、错别字，涉及一两个语种。约 2 分钟。"
          >
            <p className="text-muted-foreground text-xs leading-relaxed">
              定位办法：在「主表格」Tab 搜 key 或译文，记下那一行的
              <strong className="text-foreground font-medium"> namespace</strong>，要改的就是{' '}
              <code className="font-mono">locales/&lt;namespace&gt;/&lt;语种&gt;.json</code>{' '}
              这个文件。字典和错误码两个 Tab 有直达编辑链接，不用自己拼路径。
            </p>
          </EditByHandCard>

          <Card
            tag="场景 2"
            title="批量处理 —— 导出 → 改表 → 交给 AI 回写"
            when="全量或某个 ns 的批量校订，比如按新术语统一译法、集中补某个语种。"
          >
            <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
              <li>
                在「主表格」筛出范围（搜 ns 名、勾选语种、或用「仅看缺失」），点
                <strong className="text-foreground font-medium">「导出」</strong>
                —— 可导当前筛选，也可导全部语种，Excel 或 JSON 都行
              </li>
              <li>
                在 Excel 里改译文。
                <strong className="text-foreground font-medium">
                  只改语种列，namespace / key 两列千万别动
                </strong>
                （那是主键）；没改的行留原样即可
              </li>
              <li>把改好的文件连同下面这段话发给 AI 助手，它会算出差异、回写、提 PR</li>
            </ol>
            <PromptBlock text={PROMPTS.pm(briefUrl)} />
            <ReviewSteps
              first="把上面那段话（换成你的范围说明）连同改好的文件发给 AI"
              middle={
                <>
                  AI 会先把
                  <strong className="text-foreground font-medium">差异清单</strong>
                  列给你确认，再落盘。PR 出来后核对
                  <strong className="text-foreground font-medium">改动行数对不对得上</strong>
                  —— 多出来的行说明它写宽了
                </>
              }
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              ⚠️ 表格<strong className="text-foreground font-medium">不能用来增删 key</strong>。
              新增 key 要 11 个语种一起加，是另一件事；表里少掉的行只是你筛过，不代表要删。
              AI 遇到这两种情况会报告给你而不是执行。
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              直接把 Excel 传回仓库的「导入」功能还没做（见 README 后续待建）。在那之前，
              AI 回写就是批量路径。
            </p>
            <BriefLink repo={repo} />
          </Card>
        </>
      ) : (
        <>
          <EditByHandCard
            tag="路径 A"
            title="改一条已有错误码文案 —— 自己动手"
            when="错别字、措辞不准，只涉及一两个语种。约 2 分钟。"
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={editUrl(repo, ERROR_CODE_NS)} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  错误码 en-US.json
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  仓库首页
                </a>
              </Button>
            </div>
          </EditByHandCard>

          <Card
            tag="路径 B"
            title="新增错误码 / 全语种修改 —— 交给 AI 提 PR"
            when="一条 key 要在 11 个语种文件里都存在。你只给英文，AI 补齐其余 10 个语种并提 PR。"
          >
            <p className="text-muted-foreground text-sm leading-relaxed">
              把下面这段话（换成你的 code 和英文原文）发给你的 AI 助手 —— Claude Code / Cursor /
              任何能访问 GitHub 的 AI 编码工具。规则全在那份委托单里，包括占位符铁律、排序脚本、
              校验命令，以及它<strong className="text-foreground font-medium">不许</strong>做的事。
            </p>
            <PromptBlock text={PROMPTS.backend(briefUrl)} />
            <ReviewSteps
              first="把上面那段话（换成你的 code 和英文原文）发给 AI"
              middle={
                <>
                  PR 出来后扫一眼：
                  <strong className="text-foreground font-medium">英文原文对不对</strong>、
                  <strong className="text-foreground font-medium">
                    占位符名字和接口 data 字段对得上
                  </strong>
                  。译文质量不用你负责，后续由产品同事复核优化
                </>
              }
            />
            <BriefLink repo={repo} />
          </Card>
        </>
      )}

      <section className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">占位符 —— 唯一需要格外小心的东西</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          占位符是运行时会被替换成真实值的变量，且必须是
          <strong className="text-foreground font-medium">单花括号</strong>。写错的话用户会看到{' '}
          <code className="font-mono">{'{Nummer} already exists'}</code> 这种字面量。
        </p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            是 <code className="font-mono">{'{0}'}</code>，
            <strong className="text-foreground font-medium">不是</strong>{' '}
            <code className="font-mono">{'{{0}}'}</code> —— 双花括号插值会失效
          </li>
          <li>
            名字不能改、不能翻译：<code className="font-mono">{'{sn}'}</code> 在德语里也是{' '}
            <code className="font-mono">{'{sn}'}</code>
          </li>
          <li>
            错误码里的 <code className="font-mono">{'{0}'}</code>{' '}
            <code className="font-mono">{'{1}'}</code> 是后端传的位置参数，序号不能调换
          </li>
        </ul>
        <p className="text-muted-foreground text-xs">这三条都是 CI 的阻塞级检查，写错合不进去。</p>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">改不坏东西</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <code className="font-mono">main</code> 有分支保护，所有改动必须走 PR 且 CI 通过才能合并。
          JSON 语法错、漏了某个语种、占位符丢失，都会在 CI 被挡住 —— 合不进去就影响不到生产。
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          ⚠️ 如果 AI 为了让 CI 变绿想往{' '}
          <code className="font-mono">.ci/baseline.json</code> 加条目，
          <strong className="text-foreground font-medium">拒绝它</strong> ——
          那是绕过检查，不是修复。把报错贴回去让它改内容。
        </p>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">更多文档</h3>
        <ul className="space-y-1.5 text-sm">
          {[
            [BRIEF_PATH, '发给 AI 的委托单全文（任务 A 错误码 / 任务 B 批量回写）'],
            ['docs/backend-guide.md', '后端同事完整指南（生效时效、99999 逃生舱、特殊 key）'],
            ['docs/translating.md', '翻译产出规则、_meta 状态标记'],
            ['docs/glossary-guide.md', '术语库怎么维护'],
            ['CLAUDE.md', '仓库全量硬规则'],
          ].map(([path, desc]) => (
            <li key={path}>
              <a
                href={docUrl(repo, path)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs underline underline-offset-4"
              >
                {path}
              </a>
              <span className="text-muted-foreground ml-2 text-xs">{desc}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
