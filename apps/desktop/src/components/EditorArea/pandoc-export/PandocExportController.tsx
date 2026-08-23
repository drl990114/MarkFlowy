import bus from '@/helper/eventBus'
import { getFolderPathFromPath } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import { dialog } from '@/services/dialog'
import { getWorkspace } from '@/services/workspace'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { open, save } from '@tauri-apps/plugin-dialog'
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'
import { useEffect, useRef } from 'react'
import { toast } from 'zens'
import {
  exportMarkdownWithPandoc,
  getPandocExportFileName,
  PANDOC_EXECUTABLE_PATH_SETTING,
  PANDOC_INSTALL_URL,
  probePandoc,
  supportsPandocFormat,
  type PandocError,
  type PandocInfo,
  type PandocOutputFormat,
} from './pandocExport'
import {
  formatPandocErrorDetails,
  normalizePandocError,
  PandocExportErrorDetails,
} from './PandocExportErrorDetails'
import { PANDOC_EXPORT_EVENT } from './pandocExportMenuItem'

function getConfiguredExecutablePath(): string | undefined {
  const value = useAppSettingStore.getState().settingData[PANDOC_EXECUTABLE_PATH_SETTING]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getLocalizedError(error: PandocError, t: (key: string) => string): string {
  const key = `contextmenu.editor_tab.export_pandoc_error_${error.code}`
  return t(key)
}

async function selectPandocExecutable(): Promise<string | undefined> {
  const selected = await open({
    directory: false,
    multiple: false,
    fileAccessMode: 'scoped',
  })
  if (typeof selected !== 'string') return undefined

  await appSettingService.writeSettingData(
    { key: PANDOC_EXECUTABLE_PATH_SETTING },
    selected,
  )
  return selected
}

export interface PandocExportControllerProps {
  active: boolean
  enabled: boolean
  fileName: string
  filePath?: string
  getContent: () => string
}

export function PandocExportController({
  active,
  enabled,
  fileName,
  filePath,
  getContent,
}: PandocExportControllerProps) {
  const { t } = useTranslation()
  const exportingRef = useRef(false)

  useEffect(() => {
    const createPandocErrorContent = (error: unknown) => {
      const fallbackMessage = t(
        'contextmenu.editor_tab.export_pandoc_error_conversion_failed',
      )
      const normalizedError = normalizePandocError(error, fallbackMessage)
      const summary = getLocalizedError(normalizedError, t)
      const details = formatPandocErrorDetails(normalizedError, summary, {
        code: t('contextmenu.editor_tab.export_pandoc_error_code'),
        exitCode: t('contextmenu.editor_tab.export_pandoc_exit_code'),
        message: t('contextmenu.editor_tab.export_pandoc_error_message'),
        details: t('contextmenu.editor_tab.export_pandoc_error_details'),
      })

      return (
        <PandocExportErrorDetails
          copiedLabel={t('contextmenu.editor_tab.export_pandoc_copied')}
          copyFailedLabel={t('contextmenu.editor_tab.export_pandoc_copy_failed')}
          copyLabel={t('contextmenu.editor_tab.export_pandoc_copy_error')}
          details={details}
        />
      )
    }

    const showPandocError = (error: unknown) => {
      return dialog.confirm({
        title: t('contextmenu.editor_tab.export_pandoc_failed_title'),
        content: createPandocErrorContent(error),
        size: 'lg',
        actions: [
          {
            id: 'close',
            label: t('common.close'),
            primary: true,
          },
        ],
      })
    }

    const resolvePandoc = async (format: PandocOutputFormat): Promise<PandocInfo | null> => {
      const configuredExecutablePath = getConfiguredExecutablePath()
      let info = await probePandoc(configuredExecutablePath)
      if (supportsPandocFormat(info, format)) return info

      if (info.error?.code === 'unsupported_format' || (info.available && info.compatible)) {
        await showPandocError(
          info.error ?? {
            code: 'unsupported_format',
            message: 'Unsupported Pandoc output format.',
          },
        )
        return null
      }

      const action = await dialog.confirm({
        title: t('contextmenu.editor_tab.export_pandoc_setup_title'),
        content:
          configuredExecutablePath && info.error?.code === 'invalid_executable'
            ? createPandocErrorContent(info.error)
            : t('contextmenu.editor_tab.export_pandoc_setup_desc'),
        actions: [
          { id: 'cancel', label: t('common.cancel') },
          { id: 'install', label: t('contextmenu.editor_tab.export_pandoc_install') },
          {
            id: 'select',
            label: t('contextmenu.editor_tab.export_pandoc_select'),
            primary: true,
          },
        ],
      })

      if (action === 'install') {
        await openUrl(PANDOC_INSTALL_URL)
        return null
      }
      if (action !== 'select') return null

      const selectedPath = await selectPandocExecutable()
      if (!selectedPath) return null
      info = await probePandoc(selectedPath)
      if (supportsPandocFormat(info, format)) return info

      await showPandocError(
        info.error ?? {
          code: 'invalid_executable',
          message: 'Invalid Pandoc executable.',
        },
      )
      return null
    }

    const handleExportRequest = async (format: PandocOutputFormat) => {
      if (!active || !enabled || exportingRef.current) return

      exportingRef.current = true
      try {
        const info = await resolvePandoc(format)
        if (!info) return

        const outputPath = await save({
          title: t('contextmenu.editor_tab.export_pandoc_format', {
            format: format.toUpperCase(),
          }),
          defaultPath: getPandocExportFileName(fileName, format),
          filters: [
            {
              name: format.toUpperCase(),
              extensions: [format],
            },
          ],
        })
        if (!outputPath) return

        const resourcePaths: string[] = []
        const fileFolderPath = getFolderPathFromPath(filePath)
        if (fileFolderPath) resourcePaths.push(fileFolderPath)
        const workspace = await getWorkspace()
        if (workspace.rootPath && !resourcePaths.includes(workspace.rootPath)) {
          resourcePaths.push(workspace.rootPath)
        }

        const loadingToast = toast.loading(
          t('contextmenu.editor_tab.export_pandoc_exporting', {
            format: format.toUpperCase(),
          }),
        )
        try {
          const result = await exportMarkdownWithPandoc({
            source: getContent(),
            format,
            outputPath,
            executablePath: info.executablePath,
            resourcePaths,
          })
          if (result.warnings.length > 0) {
            logger.warn('Pandoc export completed with warnings:', {
              outputPath: result.outputPath,
              warnings: result.warnings,
            })
            toast.warning(
              t('contextmenu.editor_tab.export_pandoc_warning', {
                count: result.warnings.length,
                path: result.outputPath,
              }),
              {
                action: {
                  label: t('contextmenu.explorer.show_in_folder'),
                  onClick: () => {
                    void revealItemInDir(result.outputPath).catch((error) => {
                      logger.error('Failed to reveal Pandoc export:', error)
                    })
                  },
                },
                duration: 10_000,
              },
            )
          } else {
            toast.success(
              t('contextmenu.editor_tab.export_pandoc_success', {
                path: result.outputPath,
              }),
            )
          }
        } finally {
          toast.dismiss(loadingToast)
        }
      } catch (error) {
        logger.error('Pandoc export failed:', error)
        await showPandocError(error)
      } finally {
        exportingRef.current = false
      }
    }

    bus.on(PANDOC_EXPORT_EVENT, handleExportRequest)
    return () => {
      bus.detach(PANDOC_EXPORT_EVENT, handleExportRequest)
    }
  }, [active, enabled, fileName, filePath, getContent, t])

  return null
}
