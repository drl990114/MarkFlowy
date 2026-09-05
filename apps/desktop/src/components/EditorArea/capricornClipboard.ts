import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { toast } from 'zens'
import { i18n } from '@/i18n'
import type { CapricornRuntimeOptions } from './capricornRuntimeAdapter'

export const capricornClipboard = { writeText }

export const handleCapricornClipboardResult: NonNullable<
  CapricornRuntimeOptions['onClipboardResult']
> = (result) => {
  if (result.status === 'failed') {
    toast.error(i18n.t('capricorn.clipboard.failed'))
  } else if (result.status === 'retained') {
    toast(i18n.t('capricorn.clipboard.retained'))
  } else {
    toast.success(
      i18n.t(
        result.action === 'cut'
          ? 'capricorn.clipboard.cut_markdown'
          : 'capricorn.clipboard.copied_markdown',
      ),
    )
  }
}
