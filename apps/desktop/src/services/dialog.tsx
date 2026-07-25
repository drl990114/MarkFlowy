import NiceModal from '@ebay/nice-modal-react'
import { emit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type React from 'react'
import type {
  DialogAction,
  DialogRememberOptions,
  ConfirmModalProps,
  ImageInsertSelection,
  InfoModalProps,
  InputConfirmModalProps,
} from '@/components/Modal'
import {
  MODAL_CONFIRM_ID,
  MODAL_IMAGE_INSERT_ID,
  MODAL_INFO_ID,
  MODAL_INPUT_ID,
} from '@/components/Modal'
import useAppSettingStore from '@/stores/useAppSettingStore'

type DialogPreferences = Record<string, string>

let modalQueueTail = Promise.resolve()

// Radix restores focus in a timer after Content unmounts. Give React one more
// task to commit NiceModal removal before reusing a static modal id.
const waitForModalCleanup = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

const enqueueModal = <T,>(show: () => Promise<T>) => {
  const result = modalQueueTail.then(show, show)
  modalQueueTail = result.then(
    () => waitForModalCleanup(),
    () => waitForModalCleanup(),
  )
  return result
}

export interface ConfirmOptions {
  title?: string
  content?: React.ReactNode
  actions?: DialogAction[]
  remember?: DialogRememberOptions
  size?: ConfirmModalProps['size']
}

export interface InfoOptions {
  title?: string
  content?: React.ReactNode
  width?: string
}

export interface InputConfirmOptions {
  title?: string
  inputProps?: InputConfirmModalProps['inputProps']
}

const getDialogPreferences = () => {
  const preferences = useAppSettingStore.getState().settingData.dialog_preferences
  return preferences && typeof preferences === 'object' ? (preferences as DialogPreferences) : {}
}

const saveDialogPreference = async (key: string, actionId: string) => {
  const { settingData, setSettingData } = useAppSettingStore.getState()
  const nextSettingData = {
    ...settingData,
    dialog_preferences: {
      ...getDialogPreferences(),
      [key]: actionId,
    },
  }

  setSettingData(nextSettingData)
  await invoke('save_app_conf', { data: nextSettingData, label: 'markflowy' })
  emit('app_conf_change')
}

export const clearDialogPreference = async (key: string) => {
  const { settingData, setSettingData } = useAppSettingStore.getState()
  const { [key]: _removed, ...nextPreferences } = getDialogPreferences()
  const nextSettingData = {
    ...settingData,
    dialog_preferences: nextPreferences,
  }

  setSettingData(nextSettingData)
  await invoke('save_app_conf', { data: nextSettingData, label: 'markflowy' })
  emit('app_conf_change')
}

const confirm = async (options: ConfirmOptions) => {
  const rememberedAction = options.remember?.enabled === false
    ? undefined
    : options.remember?.key
      ? getDialogPreferences()[options.remember.key]
      : undefined

  if (rememberedAction) {
    return rememberedAction
  }

  const props: ConfirmModalProps = {
    ...options,
    onRemember: async (actionId) => {
      if (options.remember?.key) {
        await saveDialogPreference(options.remember.key, actionId)
      }
    },
  }

  return enqueueModal(() =>
    NiceModal.show<string | null, ConfirmModalProps>(MODAL_CONFIRM_ID, props),
  )
}

const info = async (options: InfoOptions) => {
  const props: InfoModalProps = { ...options }
  return enqueueModal(() =>
    NiceModal.show<void, InfoModalProps>(MODAL_INFO_ID, props),
  )
}

const inputConfirm = async (options: InputConfirmOptions) => {
  const props: InputConfirmModalProps = { ...options }
  return enqueueModal(() =>
    NiceModal.show<string | null, InputConfirmModalProps>(MODAL_INPUT_ID, props),
  )
}

const imageInsert = async () =>
  enqueueModal(() =>
    NiceModal.show<ImageInsertSelection | null>(MODAL_IMAGE_INSERT_ID),
  )

export const dialog = {
  confirm,
  imageInsert,
  info,
  inputConfirm,
}

export default dialog
