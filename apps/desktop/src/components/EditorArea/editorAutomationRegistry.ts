export type CliExportFormat = 'html' | 'markdown' | 'text' | 'json' | 'jpg'

export interface EditorAutomationState {
  active: boolean
  visible: boolean
  ready: boolean
  mode: string
  error?: string
}

export interface EditorAutomationHandle {
  inspect: () => EditorAutomationState
  readContent: () => string
  preview: () => void
  save?: (expectedContent: string) => Promise<boolean>
  render: (format: CliExportFormat) => Promise<Uint8Array>
}

/** Instance-scoped live readers. Registration never publishes cached document content. */
export class EditorAutomationRegistry {
  private entries = new Map<string, Map<string, EditorAutomationHandle>>()

  register(fileId: string, instanceId: string, handle: EditorAutomationHandle): () => void {
    const instances = this.entries.get(fileId) ?? new Map<string, EditorAutomationHandle>()
    instances.set(instanceId, handle)
    this.entries.set(fileId, instances)
    return () => {
      if (instances.get(instanceId) !== handle) return
      instances.delete(instanceId)
      if (instances.size === 0) this.entries.delete(fileId)
    }
  }

  get(fileId: string): EditorAutomationHandle | undefined {
    const handles = [...(this.entries.get(fileId)?.values() ?? [])]
    return (
      handles.find((handle) => handle.inspect().active) ??
      handles.find((handle) => handle.inspect().visible) ??
      handles[0]
    )
  }
}

export const editorAutomationRegistry = new EditorAutomationRegistry()
