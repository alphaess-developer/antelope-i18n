/*
 * 产品配置 Tab —— admin 动态表单文案的单一入口
 *
 * `product-config/*` 下每个 ns 对应 admin「产品配置」下的一个模块，
 * 与该页 JsonSchemaEditor 的 `previewFormProps.i18nNs` **一一对应**：
 * 编辑器里给字段挑国际化 key 时，候选就是这里的 key。
 *
 * 产品同事从编辑器点「在 i18n 查看」跳过来时，带的就是 `?ns=product-config/xxx&q=<key>`。
 *
 * 布局本身在 NamespaceBrowser 里，这里只提供产品配置特有的文案与前缀。
 */
import { type ComponentProps } from 'react';
import { NamespaceBrowser } from '@/features/NamespaceBrowser';
import { PRODUCT_CONFIG_PREFIX } from '@/lib/data';

type Props = Omit<
  ComponentProps<typeof NamespaceBrowser>,
  'prefix' | 'exclude' | 'unitLabel' | 'description' | 'footnote' | 'keyStyle'
>;

export function ProductConfigView(props: Props) {
  return (
    <NamespaceBrowser
      prefix={PRODUCT_CONFIG_PREFIX}
      unitLabel="模块"
      description={
        <>
          admin「产品配置」各页面自身的静态文案（列表、弹窗、校验提示等）。
          <strong className="text-foreground font-medium">动态表单的字段文案不在这里</strong>
          —— 它们已统一到「动态表单」Tab 的单一 namespace，那才是编辑器里配 key 时的候选来源。
        </>
      }
      footnote={
        <>
          与 <code className="font-mono">dictionaries/product_config</code>（下划线）不是一回事 ——
          那是一张数据字典，在「字典」Tab。
        </>
      }
      {...props}
    />
  );
}
