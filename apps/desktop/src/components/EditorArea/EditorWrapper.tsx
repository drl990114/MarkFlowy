import styled, { css } from 'styled-components'
import { EditorViewType } from 'rme'
import type { FileType } from '@/helper/fileTypeHandler'

interface EditorWrapperProps {
  $editorViewType?: EditorViewType
  $fileType?: FileType
  $fullWidth: boolean
  $rootLineHeight: string
  $visible: boolean
}

export const EditorWrapper = styled.div<EditorWrapperProps>`
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  --rme-editor-content-width: 760px;
  --rme-editor-inline-padding: clamp(20px, 5vw, 48px);
  --rme-editor-line-height: ${(props) => props.$rootLineHeight};
  /* .code-contents keeps an 8px-compatible top inset for source and non-Markdown views. */
  --rme-editor-block-padding-start: calc(36px - ${(props) => props.theme.spaceSm});
  --rme-editor-block-padding-end: 64px;
  --rme-editor-heading-margin-block-start: 1.6em;
  --rme-editor-heading-margin-block-end: 0.6em;
  --rme-editor-heading-1-size: 1.75em;
  --rme-editor-heading-2-size: 1.5em;
  --rme-editor-heading-3-size: 1.3em;
  --rme-editor-heading-4-size: 1.15em;
  --rme-editor-heading-5-size: 1.05em;
  --rme-editor-heading-6-size: 1em;
  --rme-editor-blockquote-border-width: 2px;
  --rme-editor-blockquote-border-color: var(--mf-border);
  --rme-editor-blockquote-color: var(--mf-foreground-secondary);
  --rme-editor-inline-code-bg: var(--mf-muted);
  --rme-editor-code-block-bg: var(--mf-muted);
  --rme-editor-code-block-border-width: 1px;
  --rme-editor-code-block-border-color: var(--mf-border);
  --rme-editor-code-block-radius: 8px;
  --rme-editor-code-block-padding: 16px;
  --rme-editor-table-header-bg: var(--mf-muted);
  --rme-editor-table-cell-padding-block: 8px;
  --rme-editor-table-cell-padding-inline: 12px;
  --rme-editor-selection-bg: var(--mf-primary-soft);
  --rme-editor-cell-selection-bg: var(--mf-primary-soft);
  --rme-editor-cell-selection-border: var(--mf-ring);

  > * {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
  }

  ${(props) => {
    const shouldFullWidth =
      props.$fullWidth ||
      props.$editorViewType === EditorViewType.SOURCECODE ||
      (props.$fileType != null && props.$fileType !== 'markdown')
    const shouldKeepLegacyBottomPadding =
      props.$editorViewType === EditorViewType.SOURCECODE ||
      (props.$fileType != null && props.$fileType !== 'markdown')

    return props.$visible
      ? css({
          maxWidth: shouldFullWidth
            ? 'none'
            : 'calc(var(--rme-editor-content-width) + var(--rme-editor-inline-padding) + var(--rme-editor-inline-padding))',
          margin: '0 auto',
          paddingBottom: shouldKeepLegacyBottomPadding ? '3rem' : 0,
          marginInlineStart: 'auto',
          marginInlineEnd: 'auto',
        })
      : css({
          display: 'none',
        })
  }}
`

export const EditorToc = styled.div`
  position: sticky;
  right: 0;
  top: 0;
  height: 100%;
  overflow: hidden;
  z-index: 5;
  justify-self: end;
  align-self: start;
  margin: 12px 12px 0 0;
  pointer-events: auto;
`
