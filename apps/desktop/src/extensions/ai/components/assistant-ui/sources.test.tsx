import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantLinkProvider } from './link-context'
import { Source } from './sources'

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('assistant source links', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('has no native href and delegates mouse/keyboard activation to the safe opener', () => {
    const openLink = vi.fn()
    act(() => {
      root.render(
        <AssistantLinkProvider openLink={openLink}>
          <Source href='https://example.com/source'>Source</Source>
        </AssistantLinkProvider>,
      )
    })

    const link = container.querySelector('[role="link"]') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBeNull()
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(openLink).toHaveBeenCalledTimes(2)
    expect(openLink).toHaveBeenCalledWith('https://example.com/source')
  })
})
