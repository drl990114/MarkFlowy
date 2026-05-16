import { isBrowser } from './common'

export type ClipboardReadFunction = typeof clipboardRead

export function clipboardRead(): Promise<{ html: string; text: string; }> {
  if (!isBrowser() || !navigator.clipboard) {
    return Promise.resolve({ html: '', text: '' })
  }
  return navigator.clipboard.read().then(async (data) => {
    let html = ''
    let text = ''

    const htmlData = data.find((item) => item.types.includes('text/html'))
    const textData = data.find((item) => item.types.includes('text/plain'))

    const getHtml = async () => {
      if (htmlData) {
        const blob = await htmlData.getType('text/html')
        html = await blob.text()
      }
    }
    const getText = async () => {
      if (textData) {
        const blob = await textData.getType('text/plain')
        text = await blob.text()
      }
    }

    await Promise.all([getHtml(), getText()])

    return {
      html,
      text,
    }
  })
}
