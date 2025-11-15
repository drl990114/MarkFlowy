import { invoke } from "@tauri-apps/api/core"

export const clipboardRead = async () => {
  let html = '',
    text = ''

  try {
    html = await invoke<string>('get_clipboard_html')
  } catch (error) {
    console.error('get_clipboard_html error: ', error)
  }
  try {
    text = await invoke<string>('get_clipboard_text')
  } catch (error) {
    console.error('get_clipboard_text error: ', error)
  }

  return {
    html,
    text,
  }
}
