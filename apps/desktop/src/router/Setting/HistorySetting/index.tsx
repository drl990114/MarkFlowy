import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog } from '@/components/ui/dialog'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import {
  historyCall,
  historyChanged,
  historyWorkspace,
  useHistoryProtection,
  type HistoryStats,
} from '@/services/local-history'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { openLocalHistory } from '@/components/LocalHistory/historyDialogStore'

export function HistorySetting() {
  const { t } = useTranslation()
  const enabled = useAppSettingStore((s) => s.settingData.local_history_enabled !== false)
  const revision = useHistoryProtection((s) => s.revision)
  const [stats, setStats] = useState<HistoryStats>()
  const [scope, setScope] = useState<'workspace' | 'all'>()
  const [confirmedWorkspace, setConfirmedWorkspace] = useState<string>()
  const [deleted, setDeleted] = useState<number>()
  const [preview, setPreview] = useState<HistoryStats>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const workspace = historyWorkspace()
  useEffect(() => {
    let disposed = false
    historyCall<HistoryStats>('stats', {})
      .then((value) => {
        if (!disposed) setStats(value)
      })
      .catch((e) => {
        if (!disposed) setError(String(e))
      })
    return () => {
      disposed = true
    }
  }, [revision])
  const toggle = async (next: boolean) => {
    setBusy(true)
    setError('')
    try {
      await appSettingService.writeSettingData({ key: 'local_history_enabled' }, next)
      historyChanged()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  const confirm = async (target: 'workspace' | 'all') => {
    setBusy(true)
    setError('')
    try {
      setPreview(
        await historyCall<HistoryStats>('stats', {
          workspace: target === 'workspace' ? workspace : undefined,
        }),
      )
      setConfirmedWorkspace(target === 'workspace' ? workspace : undefined)
      setScope(target)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  const clear = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await historyCall<HistoryStats>('clear', { workspace: confirmedWorkspace })
      setDeleted(result.count)
      historyChanged()
      setScope(undefined)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className='flex min-w-0 flex-col gap-4 text-ui-control' data-slot='history-settings'>
      <div
        className='flex items-start justify-between gap-4 py-2'
        data-setting-key='local_history_enabled'
      >
        <div>
          <h3 className='m-0 text-ui-control font-medium'>{t('history.enabled')}</h3>
          <p className='mt-1 text-ui-caption text-muted-foreground'>{t('history.enabled_description')}</p>
        </div>
        <Switch
          checked={enabled}
          disabled={busy}
          onCheckedChange={(next) => void toggle(next)}
          aria-label={t('history.enabled')}
        />
      </div>
      <p className='text-ui-caption text-muted-foreground'>{t('history.retention')}</p>
      {stats?.budgetLimited ? (
        <p role='alert' className='text-ui-control text-destructive'>
          {t('history.budget_limited')}
        </p>
      ) : null}
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' variant='outline' onClick={() => openLocalHistory()}>
          {t('history.title')}
        </Button>
        <span className='text-ui-caption text-muted-foreground'>
          {t('history.count', { count: stats?.count ?? 0 })}
        </span>
      </div>
      <div className='border-t border-border pt-4'>
        <h3 className='m-0 mb-1 font-medium'>{t('history.clear_title')}</h3>
        <p className='mt-0 mb-3 text-ui-caption text-muted-foreground'>{t('history.clear_description')}</p>
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' variant='destructive' disabled={busy} onClick={() => void confirm('workspace')}>
            {workspace ? t('history.clear_workspace') : t('history.clear_loose')}
          </Button>
          <Button size='sm' variant='destructive' disabled={busy} onClick={() => void confirm('all')}>
            {t('history.clear_all')}
          </Button>
        </div>
      </div>
      {deleted !== undefined ? (
        <p role='status' className='text-ui-caption text-muted-foreground'>
          {t('history.deleted', { count: deleted })}
        </p>
      ) : null}
      {error ? (
        <p role='alert' className='text-destructive'>
          {error}
        </p>
      ) : null}
      <Dialog
        open={!!scope}
        onOpenChange={(open) => {
          if (!open && !busy) setScope(undefined)
        }}
      >
        <Dialog.Content closeLabel={t('common.close')}>
          <Dialog.Header>
            <Dialog.Title>
              {scope === 'all' ? t('history.clear_all') : t('history.clear_workspace')}
            </Dialog.Title>
            <Dialog.Description>
              {t('history.clear_confirm', {
                count: preview?.count ?? 0,
                size: ((preview?.reclaimableBytes ?? 0) / 1024 / 1024).toFixed(1),
              })}
            </Dialog.Description>
          </Dialog.Header>
          <p className='break-all text-ui-control'>
            {scope === 'all' ? t('history.all_workspaces') : workspace || t('history.loose')}
          </p>
          {error ? (
            <p role='alert' className='text-destructive'>
              {error}
            </p>
          ) : null}
          <Dialog.Footer>
            <Button size='sm' variant='outline' disabled={busy} onClick={() => setScope(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button size='sm' variant='destructive' disabled={busy} onClick={() => void clear()}>
              {t('history.delete')}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </div>
  )
}
