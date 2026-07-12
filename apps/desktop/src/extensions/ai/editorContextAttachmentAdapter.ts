import type {
  Attachment,
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/react'
import {
  freezeEditorContexts,
  getEditorContextIdentity,
  MAX_EDITOR_CONTEXT_FILES,
  serializeEditorContexts,
  type EditorContextFailure,
  type EditorContextReference,
  type FreezeEditorContextsResult,
  type FrozenEditorContext,
} from './editorContext'

const EDITOR_CONTEXT_MIME_TYPE = 'application/x-markflowy-editor-context'

type FreezeEditorContexts = (
  references: EditorContextReference[],
) => Promise<FreezeEditorContextsResult>

/**
 * An attachment adapter that intentionally accepts only synthetic Files created
 * by `createFile`. It cannot be used for drag/drop or arbitrary OS uploads.
 */
export class EditorContextAttachmentAdapter implements AttachmentAdapter {
  readonly accept = EDITOR_CONTEXT_MIME_TYPE

  private readonly fileReferences = new WeakMap<File, EditorContextReference>()
  private readonly attachmentReferences = new Map<string, EditorContextReference>()
  private readonly preparedContexts = new Map<string, FrozenEditorContext>()

  constructor(private readonly freeze: FreezeEditorContexts = freezeEditorContexts) {}

  createFile(reference: EditorContextReference): File {
    const file = new File([], reference.name, { type: EDITOR_CONTEXT_MIME_TYPE })
    this.fileReferences.set(file, reference)
    return file
  }

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    const reference = this.fileReferences.get(file)
    if (!reference) throw new Error('Only editor context references are supported')

    const identity = getEditorContextIdentity(reference)
    if (
      [...this.attachmentReferences.values()].some(
        (current) => getEditorContextIdentity(current) === identity,
      )
    ) {
      throw new Error(`Editor context ${reference.name} is already attached`)
    }
    if (this.attachmentReferences.size >= MAX_EDITOR_CONTEXT_FILES) {
      throw new Error(`No more than ${MAX_EDITOR_CONTEXT_FILES} editor contexts are supported`)
    }

    const id = `editor-context:${identity}`
    this.attachmentReferences.set(id, reference)
    return {
      id,
      type: 'document',
      name: reference.name,
      contentType: EDITOR_CONTEXT_MIME_TYPE,
      file,
      status: { type: 'requires-action', reason: 'composer-send' },
    }
  }

  async remove(attachment: Attachment): Promise<void> {
    this.attachmentReferences.delete(attachment.id)
    this.preparedContexts.delete(attachment.id)
  }

  reset(): void {
    this.attachmentReferences.clear()
    this.preparedContexts.clear()
  }

  async prepare(attachments: readonly Attachment[]): Promise<
    | { ok: true }
    | { ok: false; failures: Array<EditorContextFailure & { attachmentId?: string }> }
  > {
    this.preparedContexts.clear()
    const pending = attachments.filter(
      (attachment): attachment is PendingAttachment => attachment.status.type !== 'complete',
    )
    const entries = pending.flatMap((attachment) => {
      const reference = this.attachmentReferences.get(attachment.id)
      return reference ? [{ attachment, reference }] : []
    })
    const result = await this.freeze(entries.map(({ reference }) => reference))
    if (!result.ok) {
      return {
        ok: false,
        failures: result.failures.map((failure) => ({
          ...failure,
          attachmentId: entries.find(
            ({ reference }) => getEditorContextIdentity(reference) === getEditorContextIdentity(failure),
          )?.attachment.id,
        })),
      }
    }

    result.contexts.forEach((context, index) => {
      const entry = entries[index]
      if (entry) this.preparedContexts.set(entry.attachment.id, context)
    })
    return { ok: true }
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const context = this.preparedContexts.get(attachment.id)
    if (!context) throw new Error(`Editor context ${attachment.name} was not prepared`)

    this.preparedContexts.delete(attachment.id)
    this.attachmentReferences.delete(attachment.id)
    return {
      id: attachment.id,
      type: 'document',
      name: context.truncated ? `${context.name} (truncated)` : context.name,
      contentType: 'text/markdown',
      status: { type: 'complete' },
      content: [{ type: 'text', text: serializeEditorContexts('', [context]).trim() }],
    }
  }

  getReference(attachmentId: string): EditorContextReference | undefined {
    return this.attachmentReferences.get(attachmentId)
  }
}
