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
          admin「产品配置」各模块动态表单的文案。左侧每个 namespace 对应编辑器里的一个
          <code className="font-mono"> i18nNs</code> —— 给字段配国际化时能选到的 key，就是这里的 key。
          <strong className="text-foreground font-medium">要新增 key，见「帮助」Tab 的「新增文案」</strong>
          ；合并后还需宿主项目重新构建部署，编辑器里才选得到。
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
