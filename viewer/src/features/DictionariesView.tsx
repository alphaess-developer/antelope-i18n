/*
 * 字典 Tab —— 与 antelope 数据字典联动维护的单一入口
 *
 * `dictionaries/*` 下的 ns 名由宿主项目的 dictToNs() 从字典 code 推导，
 * key 由 dictToKey() 产生，所以这里的每一行都对着数据字典里的一条。
 * 左侧列出全部字典（错误码除外，它有自己的 Tab），选中后在右侧看内容。
 *
 * key 的两级结构（字典项 / 该项的取值）由 keyStyle="dotted" 呈现 ——
 * 文件里仍是一层扁平 JSON，只是 key 字符串带点号（CLAUDE.md 硬规则 7）。
 *
 * 布局本身在 NamespaceBrowser 里，这里只提供字典特有的文案与前缀。
 */
import { type ComponentProps } from 'react';
import { NamespaceBrowser } from '@/features/NamespaceBrowser';
import { DICT_PREFIX, ERROR_CODE_NS } from '@/lib/data';

type Props = Omit<
  ComponentProps<typeof NamespaceBrowser>,
  'prefix' | 'exclude' | 'unitLabel' | 'description' | 'footnote' | 'keyStyle'
>;

const EXCLUDE = [ERROR_CODE_NS];

export function DictionariesView(props: Props) {
  const errorCode = props.manifest.nsList.find((n) => n.ns === ERROR_CODE_NS);

  return (
    <NamespaceBrowser
      prefix={DICT_PREFIX}
      exclude={EXCLUDE}
      unitLabel="字典"
      keyStyle="dotted"
      description={
        <>
          这些字典与 antelope 数据字典一一对应：ns 名由 <code className="font-mono">dictToNs()</code>、
          key 由 <code className="font-mono">dictToKey()</code> 从字典 code 推导，
          <strong className="text-foreground font-medium">改名等于改 key</strong>，必须和数据字典同步。
        </>
      }
      footnote={
        errorCode ? (
          <>错误码（{errorCode.keyCount} 条）在独立的「错误码」Tab —— 它是后端同事的工作面。</>
        ) : undefined
      }
      {...props}
    />
  );
}
