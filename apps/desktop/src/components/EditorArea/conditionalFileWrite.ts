import { invoke } from '@tauri-apps/api/core'

export interface ConditionalWriteResult {
  revision: string
  status: 'conflict' | 'success'
}

export type GuardedConditionalWriteResult =
  | ConditionalWriteResult
  | { status: 'blocked' }

type InvokeCommand = <T>(command: string, args: Record<string, unknown>) => Promise<T>

/** Captures an expected revision before asking Rust to conditionally replace the target. */
export async function getFileWriteRevision(
  filePath: string,
  invokeCommand: InvokeCommand = invoke,
): Promise<string> {
  return invokeCommand<string>('get_file_write_revision', {
    filePath,
  })
}

export async function conditionalWriteExpected(
  filePath: string,
  content: string,
  expectedRevision: string,
  invokeCommand: InvokeCommand = invoke,
): Promise<ConditionalWriteResult> {
  return invokeCommand<ConditionalWriteResult>('conditional_write_file', {
    content,
    expectedRevision,
    filePath,
  })
}

export async function conditionalWriteExpectedIfAllowed(
  filePath: string,
  content: string,
  expectedRevision: string,
  canWrite: () => boolean,
  invokeCommand: InvokeCommand = invoke,
): Promise<GuardedConditionalWriteResult> {
  if (!canWrite()) return { status: 'blocked' }
  return conditionalWriteExpected(
    filePath,
    content,
    expectedRevision,
    invokeCommand,
  )
}

export async function conditionalWriteWithRevision(
  filePath: string,
  content: string,
  invokeCommand: InvokeCommand = invoke,
): Promise<ConditionalWriteResult> {
  const expectedRevision = await getFileWriteRevision(filePath, invokeCommand)
  return conditionalWriteExpected(filePath, content, expectedRevision, invokeCommand)
}
