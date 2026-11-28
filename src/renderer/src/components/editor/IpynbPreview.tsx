import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { parseIpynb } from './notebook/document/ipynb-parse'
import { IpynbCodePreview, IpynbMarkdownCell } from './notebook/cells/IpynbCellEditor'
import { IpynbCellOutputs } from './notebook/outputs/IpynbCellOutputs'
import { getIpynbCellKey } from './notebook/document/ipynb-source-drafts'

/** Saved cells and outputs, without mounting editing or kernel hooks. */
export default function IpynbPreview({ content }: { content: string }): React.JSX.Element {
  const parsed = useMemo(() => {
    try {
      return { notebook: parseIpynb(content), error: null }
    } catch (error) {
      return { notebook: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [content])
  if (!parsed.notebook) {
    return (
      <div role="alert" className="p-6 text-sm text-muted-foreground">
        {translate('auto.components.editor.IpynbViewer.c1601b23b2', 'Unable to render notebook')}
        <pre className="mt-2 whitespace-pre-wrap">{parsed.error}</pre>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 overflow-auto bg-editor-surface p-4 scrollbar-editor">
      <div className="mb-4 text-xs text-muted-foreground">
        {parsed.notebook.cells.length}{' '}
        {translate('auto.components.editor.IpynbViewer.07e7d96612', 'cells')}
        {' · '}
        {parsed.notebook.language}
      </div>
      {parsed.notebook.cells.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate('auto.components.editor.IpynbViewer.d6f37a640b', 'Empty notebook')}
        </p>
      ) : (
        parsed.notebook.cells.map((cell, index) => (
          <section key={getIpynbCellKey(cell, index)} className="mb-4 min-w-0">
            {cell.kind === 'markdown' ? (
              <IpynbMarkdownCell source={cell.source} />
            ) : (
              <div className="overflow-hidden rounded-md border border-border bg-muted/60">
                <IpynbCodePreview source={cell.source} language={cell.language} />
              </div>
            )}
            <IpynbCellOutputs cell={cell} />
          </section>
        ))
      )}
    </div>
  )
}
