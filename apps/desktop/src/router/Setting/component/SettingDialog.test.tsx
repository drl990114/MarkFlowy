import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import { SettingDialog } from './SettingDialog'

const command = vi.hoisted(() => ({
  handler: undefined as ((target?: OpenSettingTarget) => void) | undefined,
}))

vi.mock('@/commands', () => ({
  commandRegistry: {
    registerCommand: ({ handler }: { handler: (target?: OpenSettingTarget) => void }) => {
      command.handler = handler
      return { dispose: vi.fn() }
    },
  },
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/router', () => ({
  Setting: ({
    navigationRequest,
  }: {
    navigationRequest: { id: number; target?: OpenSettingTarget }
  }) => (
    <div
      data-category={navigationRequest.target?.category}
      data-provider={navigationRequest.target?.providerId}
      data-request-id={navigationRequest.id}
    />
  ),
}))
vi.mock('zens', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}))

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('SettingDialog navigation command', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    command.handler = undefined
    container = document.createElement('div')
    root = createRoot(container)
    act(() => root.render(<SettingDialog />))
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('navigates to a requested AI provider when closed and while already open', () => {
    expect(command.handler).toBeTypeOf('function')

    act(() => command.handler?.({ category: 'ai', providerId: 'google' }))
    expect(container.querySelector('[data-provider="google"]')).not.toBeNull()
    const firstRequestId = container
      .querySelector('[data-request-id]')
      ?.getAttribute('data-request-id')

    act(() => command.handler?.({ category: 'ai', providerId: 'ollama' }))
    expect(container.querySelector('[data-provider="ollama"]')).not.toBeNull()
    expect(container.querySelector('[data-request-id]')?.getAttribute('data-request-id')).not.toBe(
      firstRequestId,
    )
  })
})
