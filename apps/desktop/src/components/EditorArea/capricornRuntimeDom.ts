function getRuntimeDocumentKey(container: HTMLElement): string | null {
  if (!container.isConnected) return null
  const content = container.querySelector<HTMLElement>('[data-cap-content]')
  const documentNode = content?.querySelector<HTMLElement>('[data-cap-editable][data-cap-key]')
  // The content wrapper has no document key. Capricorn puts it on the editable
  // document node and pairs the body-portal textarea using data-cap-dockey.
  if (!documentNode || documentNode.closest('[data-cap-content]') !== content) return null
  return documentNode.getAttribute('data-cap-key') || null
}

export function getCapricornRuntimeInput(container: HTMLElement): HTMLTextAreaElement | null {
  const documentKey = getRuntimeDocumentKey(container)
  if (documentKey === null) return null
  const inputs = container.ownerDocument.querySelectorAll<HTMLTextAreaElement>(
    'textarea[data-cap-input]',
  )
  for (const input of inputs) {
    if (input.getAttribute('data-cap-dockey') === documentKey) return input
  }
  return null
}

/** Observe this runtime's portal input and its actual embedded CodeMirror editor. */
export function subscribeCapricornBeforeInput(
  container: HTMLElement,
  listener: (event: InputEvent) => void,
): () => void {
  const ownerDocument = container.ownerDocument
  const onBeforeInput = (event: InputEvent) => {
    const element = event.target as Element | null
    const codeMirrorInput = element?.closest?.('.cm-content[contenteditable="true"]')
    if (codeMirrorInput && container.contains(codeMirrorInput)) {
      const content = container.querySelector('[data-cap-content]')
      // Nested/split editors must never attribute their typing to this document.
      if (
        codeMirrorInput.closest('[data-cap-content]') === content &&
        getRuntimeDocumentKey(container) !== null
      ) {
        listener(event)
      }
      return
    }
    const target = event.target as HTMLTextAreaElement | null
    if (
      target?.tagName !== 'TEXTAREA' ||
      target.ownerDocument !== ownerDocument ||
      !target.hasAttribute('data-cap-input') ||
      target.disabled ||
      target.readOnly
    )
      return
    const documentKey = getRuntimeDocumentKey(container)
    if (documentKey !== null && target.getAttribute('data-cap-dockey') === documentKey) {
      listener(event)
    }
  }
  // Capture runs before the runtime's input handler commits a document change.
  // Read the document key per event: no observer, cache, or stale session key.
  ownerDocument.addEventListener('beforeinput', onBeforeInput, true)
  return () => ownerDocument.removeEventListener('beforeinput', onBeforeInput, true)
}
