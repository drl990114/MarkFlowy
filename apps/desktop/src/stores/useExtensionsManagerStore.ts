import { create } from 'zustand'

const useExtensionsManagerStore = create<ExtensionsManagerStore>(() => {
  return {
    loadExtension: (extension: Record<string, any>) => {
      const sandbox = (document.getElementById(extension.id) ||
        document.createElement('iframe')) as HTMLIFrameElement
      sandbox.id = extension.id
      sandbox.style.display = 'none'
      document.body.appendChild(sandbox)

      const iframeDocument = sandbox.contentDocument!

      /**
       * Reduce the accessibility of extensions to the main program
       */
      const initScript = iframeDocument.createElement('script')
      initScript.type = 'text/javascript'
      initScript.text = `
        window.top = {
          postMessage: window.top.postMessage,
        }
      `

      const script = iframeDocument.createElement('script')
      script.type = 'text/javascript'
      script.text = extension.script_text

      iframeDocument.head.appendChild(initScript)
      iframeDocument.head.appendChild(script)
    },
  }
})

type ExtensionsManagerStore = {
  loadExtension: (extension: Record<string, any>) => void
}

export default useExtensionsManagerStore
