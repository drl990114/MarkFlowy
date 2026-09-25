import { z } from 'zod'

const formatSchema = z.object({
  encoding: z.enum(['utf-8', 'utf-16le', 'utf-16be', 'gbk', 'gb18030']),
  bom: z.enum(['none', 'utf8', 'utf16le', 'utf16be']),
})
export const draftDescriptorSchema = z.object({
  document: z.object({
    id: z.string(), workspace: z.string(), name: z.string(),
    path: z.string().nullish(), generation: z.number().int(),
  }),
  writer: z.string(), sequence: z.number().int(), hash: z.string(),
  diskRevision: z.string().nullish(), paused: z.boolean(), format: formatSchema.nullish(),
})
export type DraftDescriptor = z.infer<typeof draftDescriptorSchema>

const metadataSchema = z.object({
  id: z.string(), name: z.string(), path: z.string().optional(), ext: z.string().optional(),
  diskRevision: z.string().optional(), format: formatSchema.optional(),
})
export const draftDocumentSchema = metadataSchema.extend({ content: z.string() })
export type DraftDocument = z.infer<typeof draftDocumentSchema>

export const SESSION_KEY_PREFIX = 'draft-session:'
// Keep the old head key so a second reload during migration can still find it.
export const RELOAD_SESSION_KEY = 'mf-draft-reload-v1'
export const RELOAD_DOCUMENT_PREFIX = 'mf-draft-reload-document:'

const referenceSchema = metadataSchema.extend({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('native'), draft: draftDescriptorSchema, claimId: z.string().optional() }),
    z.object({ kind: z.literal('reload'), key: z.string().startsWith(RELOAD_DOCUMENT_PREFIX) }),
  ]),
})
export type DraftReference = z.infer<typeof referenceSchema>
export type RecoveryDocument = Omit<DraftDocument, 'content'> & {
  source: DraftReference['source'] | { kind: 'inline'; content: string }
}
const sessionMetadata = z.object({ rootPath: z.string().optional(), activeId: z.string().optional() })
export const draftSessionSchema = sessionMetadata.extend({
  version: z.literal(1), documents: z.array(draftDocumentSchema),
})
export type DraftSession = z.infer<typeof draftSessionSchema>
export const draftManifestSchema = sessionMetadata.extend({
  version: z.literal(2), documents: z.array(referenceSchema),
})
export type DraftManifest = z.infer<typeof draftManifestSchema>
export const recoverySessionSchema = z.discriminatedUnion('version', [draftSessionSchema, draftManifestSchema])
export type RecoverySession = z.infer<typeof recoverySessionSchema>

export function recoveryDocuments(session: RecoverySession): RecoveryDocument[] {
  return session.version === 2 ? session.documents : session.documents.map(({ content, ...doc }) => ({
    ...doc, source: { kind: 'inline', content },
  }))
}

export function nativeRecoveryDocument(draft: DraftDescriptor): RecoveryDocument {
  return {
    id: draft.document.id, name: draft.document.name, path: draft.document.path ?? undefined,
    ext: draft.document.name.match(/\.([^./\\]+)$/)?.[1].toLowerCase() ?? 'md',
    diskRevision: draft.diskRevision ?? undefined, format: draft.format ?? undefined,
    source: { kind: 'native', draft },
  }
}
