/*
 * 文本渲染 —— 占位符高亮 + 搜索命中高亮
 *
 * 占位符写错是本仓库最容易出的问题（CLAUDE.md 硬规则 1、2）：
 * 单花括号 {name} 是正确写法，标蓝；
 * 双花括号 {{name}} 在本项目配置下插值会**失效**，标红。
 */
import type { ReactNode } from 'react';

const TOKEN = /(\{\{[^{}]*\}\}|\{[^{}]*\})/g;

/** 把搜索词的命中片段包成 <mark>。query 为空时原样返回 */
export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const out: ReactNode[] = [];
  let cursor = 0;
  let n = 0;

  for (;;) {
    const at = lower.indexOf(needle, cursor);
    if (at === -1) {
      out.push(text.slice(cursor));
      break;
    }
    if (at > cursor) out.push(text.slice(cursor, at));
    out.push(
      <mark
        key={(n += 1)}
        className="rounded-sm bg-yellow-200 px-px text-yellow-950 dark:bg-yellow-400/30 dark:text-yellow-50"
      >
        {text.slice(at, at + query.length)}
      </mark>,
    );
    cursor = at + query.length;
  }

  return <>{out}</>;
}

interface Props {
  value: string | null | undefined;
  /** 搜索词，非占位符片段里的命中会被高亮 */
  query?: string;
}

export function PlaceholderText({ value, query = '' }: Props) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/60">—</span>;
  }

  return (
    <>
      {value.split(TOKEN).map((part, i) =>
        !part.startsWith('{') ? (
          // 占位符之外的普通文本才做搜索高亮 —— 占位符本身不该被割开
          <Highlight key={i} text={part} query={query} />
        ) : part.startsWith('{{') ? (
          <span
            key={i}
            className="rounded bg-destructive/10 px-0.5 font-mono text-[0.9em] text-destructive"
            title="双花括号在本项目配置下插值会失效"
          >
            {part}
          </span>
        ) : (
          <span key={i} className="rounded bg-primary/10 px-0.5 font-mono text-[0.9em]">
            {part}
          </span>
        ),
      )}
    </>
  );
}
