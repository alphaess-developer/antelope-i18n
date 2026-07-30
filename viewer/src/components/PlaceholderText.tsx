/*
 * 占位符高亮 —— 占位符写错是本仓库最容易出的问题（CLAUDE.md 硬规则 1、2）
 *
 * 单花括号 {name} 是正确写法，高亮成蓝色；
 * 双花括号 {{name}} 在本项目配置下插值会**失效**，标红。
 */
const TOKEN = /(\{\{[^{}]*\}\}|\{[^{}]*\})/g;

export function PlaceholderText({ value }: { value: string | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  const parts = value.split(TOKEN);
  return (
    <>
      {parts.map((part, i) =>
        !part.startsWith('{') ? (
          part
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
