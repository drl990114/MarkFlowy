import {
  finishEditorOpenMeasurement,
  getEditorOpenMeasurement,
  recordEditorOpenStage,
} from './editorPerformanceDiagnostics'
import { preloadCapricornRuntimeFactory } from './capricornRuntimeAdapter'
import { EditorViewType, isCapricornView } from '@/constants/editorViewType'
import { markStartupInteractive } from '@/startup/interactive'
import { AsyncSurface } from '@/components/AsyncSurface'
import { t } from '@/i18n'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { getFileTypeConfig, isSupportedMode, isTextfileType } from '@/helper/fileTypeHandler'
import { logger } from '@/helper/logger'
import { isEmptyEditor } from '@/services/editor-file'
import { isDraftRecoveryPending, waitForDraftRecovery } from '@/services/draftRecoveryState'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { memo, useEffect, useState, type MouseEventHandler } from 'react'
import { EmptyState } from './EmptyState'
import { isEditorPanelBlankTarget, scheduleActiveEditorFocus } from './focusActiveEditor'
import { PreviewContent } from './preview/PreviewContent'
import { EditorScrollContainer } from './styles'
import { editorScrollOptions } from './editorScrollOptions'
import TextEditor from './TextEditor'
import { EditorLoadingBoundary } from './EditorLoadingBoundary'
import { UnsupportedFileType } from './UnsupportedFileType'
import { completeDeferredEditorSave, registerDeferredEditorSave } from './deferredEditorSave'

const handleEditorPanelClick: MouseEventHandler<HTMLDivElement> = (event) => {
  if (!isEditorPanelBlankTarget(event.target, event.currentTarget)) return

  scheduleActiveEditorFocus()
}

function Editor(props: EditorProps) {
  const { id, active, visible = active, groupId } = props
  const [pending, setPending] = useState(true)
  const [draftReady, setDraftReady] = useState(() => !isDraftRecoveryPending(id))
  const [draftError, setDraftError] = useState(false)
  const [draftAttempt, setDraftAttempt] = useState(0)
  const [shouldMountContent, setShouldMountContent] = useState(visible)
  const hasBeenVisible = visible || shouldMountContent
  const fileName = useFileCacheStore((state) => state.entries[id]?.name)
  const filePath = useFileCacheStore((state) => state.entries[id]?.path)
  const curFileTypeConfig = useFileTypeConfigStore(
    (state) => state.fileTypeConfigMap.get(id) ?? null,
  )
  const setFileTypeConfig = useFileTypeConfigStore((state) => state.setFileTypeConfig)

  useEffect(() => registerDeferredEditorSave(id, () => setShouldMountContent(true)), [id])

  useEffect(() => {
    if (visible && isDraftRecoveryPending(id))
      void waitForDraftRecovery(id, active ? 'foreground' : 'visible')
        .catch(() => undefined) // The initialization effect owns the retry surface.
  }, [active, id, visible])

  useEffect(() => {
    // Restored, unvisited tabs only need their label. Avoid type lookup,
    // runtime preparation and scroll containers until they are first shown.
    if (!hasBeenVisible) return
    let disposed = false

    const initialize = async () => {
      if (isDraftRecoveryPending(id)) {
        try { await waitForDraftRecovery(id, 'visible') } catch {
          if (!disposed) setDraftError(true)
          return
        }
      }
      if (disposed) return
      setDraftReady(true)
      const curFile = getFileObject(id)
      if (!curFile) return

      const mountStart = Date.now()
      logger.info('[Editor] initialize start', {
        id,
        fileName: curFile.name,
        path: curFile.path,
        mountStart,
      })
      let fileTypeConfig = await getFileTypeConfig(curFile).catch((err) => {
        if (!disposed) {
          logger.error('[Editor] getFileTypeConfig rejected', {
            id,
            fileName: curFile.name,
            error: String(err),
          })
        }
        return null
      })
      if (disposed) return
      if (!fileTypeConfig) {
        logger.warn('[Editor] getFileTypeConfig returned null, using unsupported fallback', {
          id,
          fileName: curFile.name,
        })
        fileTypeConfig = {
          type: 'unsupported' as const,
          supportedModes: [],
          defaultMode: EditorViewType.PREVIEW,
        }
      }
      logger.info(
        `[Editor] fileTypeConfig resolved at ${Date.now()}, elapsed=${Date.now() - mountStart}ms`,
        {
          id,
          fileName: curFile.name,
          type: fileTypeConfig.type,
          defaultMode: fileTypeConfig.defaultMode,
        },
      )
      const existingMode = useEditorViewTypeStore.getState().editorViewTypeMap.get(curFile.id)
      const openingMode =
        existingMode &&
        isSupportedMode(fileTypeConfig, existingMode)
          ? existingMode
          : fileTypeConfig.defaultMode
      useEditorViewTypeStore.getState().setEditorViewType(curFile.id, openingMode)
      recordEditorOpenStage(getEditorOpenMeasurement(id, groupId), 'type-ready', {
        mode: openingMode,
      })
      if (fileTypeConfig.type === 'markdown' && isCapricornView(openingMode)) {
        // Start the existing module and Worker warm-up before publishing the
        // config that mounts TextEditor and begins its independent disk read.
        // Do not await: both operations deliberately overlap.
        void preloadCapricornRuntimeFactory()
      }
      setFileTypeConfig(curFile.id, fileTypeConfig)
      if (!isTextfileType(fileTypeConfig)) completeDeferredEditorSave(id)
    }

    void initialize()
    return () => {
      disposed = true
    }
  }, [draftAttempt, groupId, hasBeenVisible, id, setFileTypeConfig])

  useEffect(() => {
    if (active && visible && draftError) markStartupInteractive('error')
  }, [active, draftError, visible])

  useEffect(() => {
    if (visible) {
      setShouldMountContent(true)
    }
  }, [visible])

  useEffect(() => {
    if (active && visible) {
      if (isEmptyEditor(id)) markStartupInteractive('empty')
      else if (curFileTypeConfig && !isTextfileType(curFileTypeConfig)) markStartupInteractive('preview')
    }
    if (
      visible &&
      (isEmptyEditor(id) || (curFileTypeConfig && !isTextfileType(curFileTypeConfig)))
    ) {
      finishEditorOpenMeasurement(getEditorOpenMeasurement(id, groupId), 'unverified')
    }
  }, [active, curFileTypeConfig, groupId, id, visible])

  if (!hasBeenVisible) return null

  if (draftError) return (
    <div className='absolute inset-0 flex bg-background' style={visible ? undefined : { display: 'none' }}>
      <AsyncSurface retryLabel={t('common.retry')} state={{
        status: 'error', title: t('drafts.restore_failed'),
        retry: () => { setDraftError(false); setDraftAttempt((attempt) => attempt + 1) },
      }}>{() => null}</AsyncSurface>
    </div>
  )

  if (isEmptyEditor(id)) {
    if (visible) {
      return <EmptyState />
    } else {
      return null
    }
  }

  const loading = !draftReady || !curFileTypeConfig || (isTextfileType(curFileTypeConfig) && pending)

  return (
    <EditorLoadingBoundary
      className='absolute inset-0 bg-background'
      style={visible ? undefined : { display: 'none' }}
      pending={loading}
      visible={visible}
    >
      <EditorScrollContainer
        data-editor-id={id}
        data-editor-active={active ? 'true' : 'false'}
        style={visible ? undefined : { display: 'none' }}
        tabIndex={-1}
        onClick={handleEditorPanelClick}
      >
        <OverlayScrollbarsComponent
          options={editorScrollOptions}
          style={{ height: '100%', minWidth: 0 }}
        >
          <div className={'code-contents'}>
            {!shouldMountContent || !draftReady || !curFileTypeConfig ? null : curFileTypeConfig.type ===
              'unsupported' ? (
              <UnsupportedFileType fileName={fileName || ''} />
            ) : isTextfileType(curFileTypeConfig) ? (
              <TextEditor
                onLoadingChange={setPending}
                fileTypeConfig={curFileTypeConfig}
                active={active}
                id={id}
                groupId={groupId}
                visible={visible}
              />
            ) : (
              <PreviewContent
                fileId={id}
                groupId={groupId}
                type={curFileTypeConfig.type}
                filePath={filePath}
                active={active}
                visible={visible}
              />
            )}
          </div>
        </OverlayScrollbarsComponent>
      </EditorScrollContainer>
    </EditorLoadingBoundary>
  )
}

export interface EditorProps {
  id: string
  groupId?: string
  active: boolean
  visible?: boolean
  onSave?: () => void
}

const MemoEditor = memo(Editor)

export default function EditorInstance(props: EditorProps) {
  return <MemoEditor key={`${props.groupId ?? ''}:${props.id}`} {...props} />
}
