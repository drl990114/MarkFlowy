import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const currentWindow = getCurrentWindow()
export const currentWebview = getCurrentWebview()

export const createNewWindow = async (params: { path: string }) => {
  await invoke('create_new_window', { path: params.path })
}
