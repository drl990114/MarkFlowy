import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import { z } from 'zod'
import { jsonStateStorage } from './persistStorage'
import { workspaceStorageKey } from './workspacePersistence'

const pointSchema = z.object({
  path: z.array(z.number().int().nonnegative()).max(100),
  offset: z.number().int().nonnegative().optional(),
  edge: z.enum(['before', 'after']).optional(),
})
const selectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('capricorn'), anchor: pointSchema, focus: pointSchema }),
  z.object({
    kind: z.literal('source'),
    anchor: z.number().int().nonnegative(),
    head: z.number().int().nonnegative(),
  }),
])
const resumeSchema = z.object({
  scrollTop: z.number().finite().nonnegative(),
  scrollLeft: z.number().finite().nonnegative(),
  selection: selectionSchema.optional(),
})

export type ResumePoint = z.infer<typeof pointSchema>
export type ResumeSelection = z.infer<typeof selectionSchema>
export type EditorResume = z.infer<typeof resumeSchema>

export function createEditorResumeStore(path: string, group: string, mode: string) {
  return createStore<{ resume?: EditorResume; save: (resume: EditorResume) => void }>()(
    persist(
      (set) => ({
        save: (resume) => set({ resume }),
      }),
      {
        name: `${workspaceStorageKey('editor-view', path)}:${encodeURIComponent(group)}:${mode}`,
        version: 1,
        storage: jsonStateStorage(),
        partialize: ({ resume }) => ({ resume }),
        merge: (saved, current) => {
          const parsed = z.object({ resume: resumeSchema.optional() }).safeParse(saved)
          return { ...current, resume: parsed.success ? parsed.data.resume : undefined }
        },
      },
    ),
  )
}

const activeSaves = new Set<() => void>()
export function registerEditorResumeSave(save: () => void) {
  activeSaves.add(save)
  return () => {
    activeSaves.delete(save)
  }
}
export function flushEditorResumeStates() {
  activeSaves.forEach((save) => save())
}
