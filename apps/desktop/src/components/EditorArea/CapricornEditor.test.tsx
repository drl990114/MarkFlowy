import { runInNewContext } from 'node:vm'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createRef, StrictMode, useEffect } from 'react'
import { ThemeProvider } from 'styled-components'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapricornEditor, type CapricornEditorHandle } from './CapricornEditor'
import type * as CapricornRuntimeModule from './capricornRuntimeAdapter'
import {
  createCapricornRuntimeAdapter,
  createCapricornRuntimeAdapterAsync,
  getLoadedCapricornRuntimeFactory,
  loadCapricornRuntimeAsyncFactory,
  loadCapricornRuntimeFactory,
  type CapricornEditorChangeEvent,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeAsyncFactory,
  type CapricornRuntimeFactory,
} from './capricornRuntimeAdapter'
import { createDeferredLatestPublisher } from './deferredLatestPublisher'
import { createCapricornKeybindingConfiguration } from './capricornKeybindings'
import textEditorSource from './TextEditor.tsx?raw'

function createHostChangeHandler(bindings: Record<string, unknown>) {
  const source = ts.createSourceFile(
    'TextEditor.tsx',
    textEditorSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let callback: ts.Expression | undefined
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === 'handleCapricornChange' &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      callback = node.initializer.arguments[0]
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  expect(callback).toBeDefined()
  const compiled = ts.transpileModule(`(${callback!.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return runInNewContext(compiled, bindings) as (event?: CapricornEditorChangeEvent) => void
}

vi.mock('./capricornRuntimeAdapter', async (importOriginal) => ({
  ...(await importOriginal<typeof CapricornRuntimeModule>()),
  createCapricornRuntimeAdapter: vi.fn(),
  createCapricornRuntimeAdapterAsync: vi.fn(),
  getLoadedCapricornRuntimeFactory: vi.fn(),
  loadCapricornRuntimeAsyncFactory: vi.fn(),
  loadCapricornRuntimeFactory: vi.fn(),
}))

afterEach(cleanup)
beforeEach(() => vi.resetAllMocks())

function createMountAdapter(markdown = '# Markdown') {
  return {
    destroy: vi.fn(),
    focus: vi.fn(),
    getMarkdown: vi.fn(() => markdown),
    updateSettings: vi.fn(),
  } as unknown as CapricornRuntimeAdapter
}

describe('CapricornEditor typography', () => {
  it.each([false, true])(
    'applies editor fonts and updates settings without remounting (preloaded=%s)',
    async (preloaded) => {
      const adapter = createMountAdapter('# Unsaved text')
      if (preloaded) vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(vi.fn())
      vi.mocked(loadCapricornRuntimeFactory).mockResolvedValue(vi.fn())
      vi.mocked(createCapricornRuntimeAdapter).mockReturnValue(adapter)
      const props = {
        active: true,
        initialMarkdown: '# Unsaved text',
        onChange: vi.fn(),
        onError: vi.fn(),
        onUnavailable: vi.fn(),
        options: { style: { fontSize: 18, lineHeight: '1.8' } },
      }
      const { rerender } = render(
        <ThemeProvider
          theme={{ fontFamily: '"LXGW WenKai"', codemirrorFontFamily: '"JetBrains Mono"' }}
        >
          <CapricornEditor {...props} />
        </ThemeProvider>,
      )
      await waitFor(() => expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce())
      expect(createCapricornRuntimeAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            style: expect.objectContaining({
              fontFamily: '"LXGW WenKai"',
              fontSize: 18,
              lineHeight: '1.8',
              '--cap-font-mono': '"JetBrains Mono"',
              '--cap-code-font-family': '"JetBrains Mono"',
            }),
          }),
        }),
      )

      // Theme changes must propagate even when the options object is unchanged.
      rerender(
        <ThemeProvider theme={{ fontFamily: 'serif', codemirrorFontFamily: 'monospace' }}>
          <CapricornEditor {...props} />
        </ThemeProvider>,
      )
      expect(adapter.updateSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          style: expect.objectContaining({
            fontFamily: 'serif',
            '--cap-code-font-family': 'monospace',
          }),
        }),
      )
      rerender(
        <ThemeProvider theme={{ fontFamily: 'serif', codemirrorFontFamily: 'monospace' }}>
          <CapricornEditor {...props} options={{ style: { fontSize: 24, lineHeight: '2' } }} />
        </ThemeProvider>,
      )
      expect(adapter.updateSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          style: expect.objectContaining({ fontFamily: 'serif', fontSize: 24, lineHeight: '2' }),
        }),
      )
      expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce()
      expect(adapter.destroy).not.toHaveBeenCalled()
      expect(adapter.getMarkdown()).toBe('# Unsaved text')
      expect(props.onChange).not.toHaveBeenCalled()
    },
  )
})

describe('CapricornEditor background preparation', () => {
  const largeMarkdown = '# Large\n\n' + 'content '.repeat(40_000)
  const baseProps = () => ({
    active: true,
    initialMarkdown: largeMarkdown,
    onChange: vi.fn(),
    onError: vi.fn(),
    onUnavailable: vi.fn(),
    options: {},
  })

  it('applies shortcut settings changed during preparation and after attachment without remounting', async () => {
    const adapter = createMountAdapter(largeMarkdown)
    let complete!: (adapter: CapricornRuntimeAdapter) => void
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const props = baseProps()
    const { rerender } = render(<CapricornEditor {...props} />)
    await waitFor(() => expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledOnce())
    const configuration = createCapricornKeybindingConfiguration(
      { toggleStrong: 'mod-Alt-b' },
      true,
    )
    rerender(<CapricornEditor {...props} options={{ keybindingConfiguration: configuration }} />)
    await act(async () => complete(adapter))
    expect(adapter.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ keybindingConfiguration: configuration }),
    )
    const cleared = createCapricornKeybindingConfiguration({}, true)
    rerender(<CapricornEditor {...props} options={{ keybindingConfiguration: cleared }} />)
    expect(adapter.updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ keybindingConfiguration: cleared }),
    )
    expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledOnce()
    expect(adapter.destroy).not.toHaveBeenCalled()
  })

  it('uses the asynchronous factory for large preloaded files and reports committed readiness', async () => {
    const adapter = createMountAdapter(largeMarkdown)
    const factory = vi.fn()
    const onRuntimeReady = vi.fn()
    const onOpenProgress = vi.fn()
    vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(vi.fn())
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(factory)
    vi.mocked(createCapricornRuntimeAdapterAsync).mockImplementation(async ({ options }) => {
      options.onProgress?.({ stage: 'parse', elapsedMs: 10 })
      return adapter
    })
    const props = baseProps()
    const { container } = render(
      <CapricornEditor
        {...props}
        onRuntimeReady={onRuntimeReady}
        onOpenProgress={onOpenProgress}
      />,
    )
    await waitFor(() => expect(onRuntimeReady).toHaveBeenCalledOnce())
    expect(createCapricornRuntimeAdapter).not.toHaveBeenCalled()
    expect(loadCapricornRuntimeFactory).not.toHaveBeenCalled()
    expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        createRuntime: factory,
        options: expect.objectContaining({ markdown: largeMarkdown, autoFocus: false }),
      }),
    )
    const requestIdentity = { contentRevision: 0, runtimeRequestSequence: 1 }
    expect(onOpenProgress).toHaveBeenCalledWith({ stage: 'parse', elapsedMs: 10 }, requestIdentity)
    expect(onOpenProgress).toHaveBeenCalledWith(
      {
        stage: 'module-ready',
        elapsedMs: expect.any(Number),
        moduleState: 'warm',
      },
      requestIdentity,
    )
    expect(onRuntimeReady).toHaveBeenCalledWith(
      container.querySelector('[data-mf-capricorn-runtime]'),
      requestIdentity,
    )
    expect(
      container.querySelector<HTMLElement>('[data-mf-capricorn-runtime]')?.dataset
        .mfCapricornRuntimeRequest,
    ).toBe('1')
    expect(adapter.focus).toHaveBeenCalledOnce()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('retains a cold-module sample when the async factory resolves after preparation begins', async () => {
    const onOpenProgress = vi.fn()
    let finishLoading!: (factory: CapricornRuntimeAsyncFactory) => void
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve
      }),
    )
    vi.mocked(createCapricornRuntimeAdapterAsync).mockResolvedValue(createMountAdapter())
    render(<CapricornEditor {...baseProps()} onOpenProgress={onOpenProgress} />)
    vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(vi.fn())
    await act(async () => finishLoading(vi.fn()))
    expect(onOpenProgress).toHaveBeenCalledWith(
      {
        stage: 'module-ready',
        elapsedMs: expect.any(Number),
        moduleState: 'cold',
      },
      { contentRevision: 0, runtimeRequestSequence: 1 },
    )
  })

  it.each([false, true])(
    'distinguishes module loading from document preparation (preloaded=%s)',
    async (preloaded) => {
      let finishLoading!: (factory: CapricornRuntimeAsyncFactory) => void
      let finishPreparing!: (adapter: CapricornRuntimeAdapter) => void
      vi.mocked(loadCapricornRuntimeAsyncFactory).mockReturnValue(
        new Promise((resolve) => {
          finishLoading = resolve
        }),
      )
      vi.mocked(createCapricornRuntimeAdapterAsync).mockReturnValue(
        new Promise((resolve) => {
          finishPreparing = resolve
        }),
      )
      if (preloaded) vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(vi.fn())
      const onRuntimeReady = vi.fn()
      const { queryByText, container } = render(
        <CapricornEditor {...baseProps()} onRuntimeReady={onRuntimeReady} />,
      )

      expect(queryByText('Loading Capricorn editor') !== null).toBe(!preloaded)
      expect(queryByText('Opening document') !== null).toBe(preloaded)
      await act(async () => finishLoading(vi.fn()))
      expect(queryByText('Loading Capricorn editor')).toBeNull()
      expect(queryByText('Opening document')).not.toBeNull()
      expect(onRuntimeReady).not.toHaveBeenCalled()
      expect(
        container.querySelector<HTMLElement>('[data-mf-capricorn-runtime]')?.style.visibility,
      ).toBe('hidden')

      await act(async () => finishPreparing(createMountAdapter(largeMarkdown)))
      expect(queryByText('Opening document')).toBeNull()
      expect(onRuntimeReady).toHaveBeenCalledOnce()
      expect(
        container.querySelector<HTMLElement>('[data-mf-capricorn-runtime]')?.style.visibility,
      ).toBe('visible')
    },
  )

  it('waits while hidden, initializes visible split panes, and preserves a ready session on switches', async () => {
    const adapter = createMountAdapter()
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync).mockResolvedValue(adapter)
    const props = baseProps()
    const onRuntimeReady = vi.fn()
    const { rerender } = render(
      <CapricornEditor {...props} active={false} visible={false} onRuntimeReady={onRuntimeReady} />,
    )
    expect(loadCapricornRuntimeAsyncFactory).not.toHaveBeenCalled()
    rerender(<CapricornEditor {...props} active={false} visible onRuntimeReady={onRuntimeReady} />)
    await waitFor(() => expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledOnce())
    await waitFor(() => expect(onRuntimeReady).toHaveBeenCalledOnce())
    expect(adapter.focus).not.toHaveBeenCalled()
    rerender(
      <CapricornEditor {...props} active={false} visible={false} onRuntimeReady={onRuntimeReady} />,
    )
    rerender(<CapricornEditor {...props} onRuntimeReady={onRuntimeReady} />)
    expect(onRuntimeReady).toHaveBeenCalledTimes(2)
    rerender(<CapricornEditor {...props} active={false} visible onRuntimeReady={onRuntimeReady} />)
    expect(onRuntimeReady).toHaveBeenCalledTimes(2)
    rerender(<CapricornEditor {...props} active visible onRuntimeReady={onRuntimeReady} />)
    expect(onRuntimeReady).toHaveBeenCalledTimes(3)
    expect(adapter.destroy).not.toHaveBeenCalled()
    expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledOnce()
  })

  it('aborts hidden preparation, destroys a late result, and resumes from the latest seed', async () => {
    const pending: { resolve: (adapter: CapricornRuntimeAdapter) => void; signal?: AbortSignal }[] =
      []
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync).mockImplementation(
      ({ options }) =>
        new Promise((resolve) => {
          pending.push({ resolve, signal: options.signal })
        }),
    )
    const props = baseProps()
    const onEditorChange = vi.fn()
    const { rerender, unmount } = render(
      <CapricornEditor {...props} onEditorChange={onEditorChange} />,
    )
    await waitFor(() => expect(pending).toHaveLength(1))
    rerender(<CapricornEditor {...props} active={false} onEditorChange={onEditorChange} />)
    expect(pending[0].signal?.aborted).toBe(true)
    const lateAdapter = createMountAdapter()
    await act(async () => pending[0].resolve(lateAdapter))
    expect(lateAdapter.destroy).toHaveBeenCalledOnce()
    expect(onEditorChange).not.toHaveBeenCalled()

    const latest = largeMarkdown + 'latest'
    rerender(
      <CapricornEditor {...props} initialMarkdown={latest} onEditorChange={onEditorChange} />,
    )
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(createCapricornRuntimeAdapterAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ markdown: latest }),
      }),
    )
    unmount()
    expect(pending[1].signal?.aborted).toBe(true)
    const unmountedAdapter = createMountAdapter()
    await act(async () => pending[1].resolve(unmountedAdapter))
    expect(unmountedAdapter.destroy).toHaveBeenCalledOnce()
    expect(props.onUnavailable).not.toHaveBeenCalled()
  })

  it('invalidates in-flight preparation on an imperative external replacement', async () => {
    const pending: { resolve: (adapter: CapricornRuntimeAdapter) => void; signal?: AbortSignal }[] =
      []
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync).mockImplementation(
      ({ options }) =>
        new Promise((resolve) => {
          pending.push({ resolve, signal: options.signal })
        }),
    )
    const ref = createRef<CapricornEditorHandle>()
    const props = baseProps()
    render(<CapricornEditor {...props} ref={ref} />)
    await waitFor(() => expect(pending).toHaveLength(1))
    const replacement = largeMarkdown + 'replacement'
    act(() => ref.current?.setMarkdown(replacement))
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[0].signal?.aborted).toBe(true)
    expect(createCapricornRuntimeAdapterAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ markdown: replacement }),
      }),
    )
    const adapter = createMountAdapter(replacement)
    await act(async () => pending[1].resolve(adapter))
    expect(ref.current?.getMarkdown()).toBe(replacement)
    const stale = createMountAdapter()
    await act(async () => pending[0].resolve(stale))
    expect(stale.destroy).toHaveBeenCalledOnce()
    expect(adapter.destroy).not.toHaveBeenCalled()
  })

  it('rejects an obsolete prepared result when the host revision changes with identical text', async () => {
    const pending: { resolve: (adapter: CapricornRuntimeAdapter) => void; signal?: AbortSignal }[] =
      []
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync).mockImplementation(
      ({ options }) =>
        new Promise((resolve) => {
          pending.push({ resolve, signal: options.signal })
        }),
    )
    const props = baseProps()
    const onEditorChange = vi.fn()
    const { rerender } = render(
      <CapricornEditor {...props} contentRevision={1} onEditorChange={onEditorChange} />,
    )
    await waitFor(() => expect(pending).toHaveLength(1))

    rerender(<CapricornEditor {...props} contentRevision={2} onEditorChange={onEditorChange} />)
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[0].signal?.aborted).toBe(true)
    expect(createCapricornRuntimeAdapterAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ markdown: largeMarkdown }),
      }),
    )

    const obsolete = createMountAdapter(largeMarkdown)
    await act(async () => pending[0].resolve(obsolete))
    expect(obsolete.destroy).toHaveBeenCalledOnce()
    expect(onEditorChange).not.toHaveBeenCalled()

    const current = createMountAdapter(largeMarkdown)
    await act(async () => pending[1].resolve(current))
    expect(onEditorChange).toHaveBeenCalledExactlyOnceWith(current)
    expect(current.destroy).not.toHaveBeenCalled()
  })

  it('shows actionable async capability errors without switching modes and permits retry', async () => {
    const props = baseProps()
    const onRetry = vi.fn()
    const message = 'Upgrade the private runtime to open large Markdown files in WYSIWYG mode.'
    vi.mocked(loadCapricornRuntimeAsyncFactory)
      .mockRejectedValueOnce(new Error(message))
      .mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync).mockResolvedValue(createMountAdapter())
    const { findByText, getByRole, queryByText } = render(
      <CapricornEditor {...props} onRetry={onRetry} />,
    )
    await findByText(message)
    expect(props.onUnavailable).not.toHaveBeenCalled()
    expect(createCapricornRuntimeAdapter).not.toHaveBeenCalled()
    fireEvent.click(getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
    await waitFor(() => expect(queryByText(message)).toBeNull())
    await waitFor(() => expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledOnce())
    expect(props.onUnavailable).not.toHaveBeenCalled()
  })

  it('surfaces a Worker preparation failure and retries with a fresh async request', async () => {
    const error = new Error('Preparation Worker crashed')
    const adapter = createMountAdapter(largeMarkdown)
    const props = baseProps()
    const onEditorChange = vi.fn()
    const onRetry = vi.fn()
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(adapter)

    const { findByText, getByRole, queryByText } = render(
      <CapricornEditor {...props} onEditorChange={onEditorChange} onRetry={onRetry} />,
    )
    await findByText(error.message)
    expect(props.onError).toHaveBeenCalledExactlyOnceWith(error)
    expect(props.onUnavailable).not.toHaveBeenCalled()
    expect(onEditorChange).not.toHaveBeenCalled()

    fireEvent.click(getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(queryByText(error.message)).toBeNull())
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onEditorChange).toHaveBeenCalledExactlyOnceWith(adapter)
    expect(adapter.destroy).not.toHaveBeenCalled()
  })

  it('survives StrictMode replay without attaching or leaking an obsolete async request', async () => {
    const adapter = createMountAdapter()
    vi.mocked(loadCapricornRuntimeAsyncFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapterAsync).mockResolvedValue(adapter)
    const { unmount } = render(
      <StrictMode>
        <CapricornEditor {...baseProps()} />
      </StrictMode>,
    )
    await waitFor(() => expect(createCapricornRuntimeAdapterAsync).toHaveBeenCalledOnce())
    expect(adapter.destroy).not.toHaveBeenCalled()
    unmount()
    expect(adapter.destroy).toHaveBeenCalledOnce()
  })
})

describe('CapricornEditor preloading', () => {
  it('mounts a preloaded factory after the host commit without another import', async () => {
    const factory = vi.fn()
    const adapter = createMountAdapter()
    vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(factory)
    vi.mocked(createCapricornRuntimeAdapter).mockReturnValue(adapter)
    const onEditorChange = vi.fn()

    const { container, queryByText, unmount } = render(
      <CapricornEditor
        active
        initialMarkdown='# Markdown'
        onChange={vi.fn()}
        onError={vi.fn()}
        onEditorChange={onEditorChange}
        onUnavailable={vi.fn()}
        options={{}}
      />,
    )

    expect(loadCapricornRuntimeFactory).not.toHaveBeenCalled()
    expect(createCapricornRuntimeAdapter).not.toHaveBeenCalled()
    expect(queryByText('Loading Capricorn editor')).toBeNull()
    await waitFor(() => expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce())
    expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce()
    expect(onEditorChange).toHaveBeenCalledExactlyOnceWith(adapter)
    expect(queryByText('Loading Capricorn editor')).toBeNull()
    expect(
      container.querySelector<HTMLElement>('[data-mf-capricorn-runtime]')?.style.visibility,
    ).toBe('visible')

    unmount()
    expect(adapter.destroy).toHaveBeenCalledOnce()
    expect(onEditorChange).toHaveBeenLastCalledWith(null)
  })

  it('discards the obsolete warm request during StrictMode replay', async () => {
    const firstAdapter = createMountAdapter()
    const onEditorChange = vi.fn()
    vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapter).mockReturnValueOnce(firstAdapter)

    const { queryByText, unmount } = render(
      <StrictMode>
        <CapricornEditor
          active
          initialMarkdown='# Markdown'
          onChange={vi.fn()}
          onError={vi.fn()}
          onEditorChange={onEditorChange}
          onUnavailable={vi.fn()}
          options={{}}
        />
      </StrictMode>,
    )

    await waitFor(() => expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce())
    expect(firstAdapter.destroy).not.toHaveBeenCalled()
    expect(onEditorChange.mock.calls.map(([adapter]) => adapter)).toEqual([firstAdapter])
    expect(queryByText('Loading Capricorn editor')).toBeNull()

    unmount()
    expect(firstAdapter.destroy).toHaveBeenCalledOnce()
    expect(onEditorChange).toHaveBeenLastCalledWith(null)
  })

  it('keeps the loading surface for an unfinished preload and mounts with the latest props', async () => {
    let finishLoading!: (factory: CapricornRuntimeFactory) => void
    vi.mocked(loadCapricornRuntimeFactory).mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve
      }),
    )
    vi.mocked(createCapricornRuntimeAdapter).mockReturnValue(createMountAdapter())
    const props = {
      active: true,
      initialMarkdown: '# Initial',
      onChange: vi.fn(),
      onError: vi.fn(),
      onUnavailable: vi.fn(),
      options: {},
    }
    const { queryByText, rerender } = render(<CapricornEditor {...props} />)

    expect(queryByText('Loading Capricorn editor')).not.toBeNull()
    expect(createCapricornRuntimeAdapter).not.toHaveBeenCalled()
    rerender(
      <CapricornEditor
        {...props}
        active={false}
        initialMarkdown='# Latest'
        options={{ readOnly: true }}
      />,
    )

    await act(async () => finishLoading(vi.fn()))
    expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce()
    expect(createCapricornRuntimeAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          autoFocus: false,
          markdown: '# Latest',
          readOnly: true,
        }),
      }),
    )
    expect(queryByText('Loading Capricorn editor')).toBeNull()
  })

  it('does not create an editor if its pending import finishes after unmount', async () => {
    let finishLoading!: (factory: CapricornRuntimeFactory) => void
    vi.mocked(loadCapricornRuntimeFactory).mockReturnValue(
      new Promise((resolve) => {
        finishLoading = resolve
      }),
    )
    const onEditorChange = vi.fn()
    const onUnavailable = vi.fn()
    const { unmount } = render(
      <CapricornEditor
        active
        initialMarkdown='# Markdown'
        onChange={vi.fn()}
        onError={vi.fn()}
        onEditorChange={onEditorChange}
        onUnavailable={onUnavailable}
        options={{}}
      />,
    )

    unmount()
    await act(async () => finishLoading(vi.fn()))
    expect(createCapricornRuntimeAdapter).not.toHaveBeenCalled()
    expect(onEditorChange).not.toHaveBeenCalled()
    expect(onUnavailable).not.toHaveBeenCalled()
  })
})

describe('CapricornEditor fallback', () => {
  it('defers an inactive editor failure until activation and reports it only once', async () => {
    const error = new Error('Runtime unavailable')
    const onUnavailable = vi.fn()
    vi.mocked(loadCapricornRuntimeFactory).mockRejectedValue(error)
    const props = {
      active: false,
      initialMarkdown: '# Markdown',
      onChange: vi.fn(),
      onError: vi.fn(),
      onUnavailable,
      options: {},
    }
    const { findByText, rerender } = render(<CapricornEditor {...props} />)

    await findByText('Unable to load the Capricorn editor')
    expect(onUnavailable).not.toHaveBeenCalled()
    expect(createCapricornRuntimeAdapter).not.toHaveBeenCalled()
    rerender(<CapricornEditor {...props} active />)
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledExactlyOnceWith(error))

    rerender(<CapricornEditor {...props} />)
    rerender(<CapricornEditor {...props} active />)
    await act(async () => undefined)
    expect(onUnavailable).toHaveBeenCalledOnce()
    expect(props.onError).not.toHaveBeenCalled()
  })

  it('reports an unavailable runtime so the host can fall back to Source Code', async () => {
    const onError = vi.fn()
    const onUnavailable = vi.fn()
    vi.mocked(loadCapricornRuntimeFactory).mockRejectedValue(new Error('Runtime unavailable'))

    render(
      <CapricornEditor
        active
        initialMarkdown='# Markdown'
        onChange={vi.fn()}
        onError={onError}
        onUnavailable={onUnavailable}
        options={{}}
      />,
    )

    await waitFor(() => expect(onUnavailable).toHaveBeenCalledOnce())
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a warm initialization failure after host listeners mount and can retry', async () => {
    const error = new Error('Initialization failed')
    const adapter = createMountAdapter()
    const onFallback = vi.fn()
    const onEditorChange = vi.fn()
    let listener: ((error: unknown) => void) | undefined
    vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapter)
      .mockImplementationOnce(() => {
        throw error
      })
      .mockReturnValue(adapter)

    function Parent() {
      useEffect(() => {
        listener = onFallback
        return () => {
          listener = undefined
        }
      }, [])
      return (
        <CapricornEditor
          active
          initialMarkdown='# Markdown'
          onChange={vi.fn()}
          onError={vi.fn()}
          onEditorChange={onEditorChange}
          onUnavailable={(reason) => listener?.(reason)}
          options={{}}
        />
      )
    }
    const { getByRole, queryByText, unmount } = render(<Parent />)

    await waitFor(() => expect(onFallback).toHaveBeenCalledExactlyOnceWith(error))
    expect(queryByText('Unable to load the Capricorn editor')).not.toBeNull()
    fireEvent.click(getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(createCapricornRuntimeAdapter).toHaveBeenCalledTimes(2))
    expect(onEditorChange).toHaveBeenCalledExactlyOnceWith(adapter)
    expect(adapter.destroy).not.toHaveBeenCalled()
    expect(queryByText('Loading Capricorn editor')).toBeNull()
    expect(queryByText('Unable to load the Capricorn editor')).toBeNull()
    unmount()
    expect(adapter.destroy).toHaveBeenCalledOnce()
  })
})

describe('CapricornEditor snapshot ownership', () => {
  it('does not finish an input timing sample at the pre-commit pending notification', () => {
    const record = vi.fn()
    const started = { current: 12 as number | undefined }
    const onChange = createHostChangeHandler({
      id: 'file',
      groupId: 'group',
      instanceIdRef: { current: 'source' },
      editorSnapshotRegistry: { changed: vi.fn() },
      hasVisibleSiblingRef: { current: false },
      compositionDirtyRef: { current: null },
      isUnmountingRef: { current: false },
      autosave: false,
      capricornEditorRef: { current: { isComposing: () => false } },
      capricornRuntimeAdapterRef: { current: {} },
      capricornStatisticsScheduler: { cancel: vi.fn(), schedule: vi.fn() },
      activeRef: { current: true },
      isApplyingRemoteContentRef: { current: false },
      savePathReserved: false,
      externalChangeResolving: false,
      latestContentRef: { current: 'text' },
      useEditorStateStore: { getState: () => ({ setIdStateMap: vi.fn() }) },
      snapshotPublisher: { stage: vi.fn() },
      recordEditorInteractionMeasurement: record,
      interactionStartedAtRef: started,
      interactionOpenRequestIdRef: { current: undefined },
    })
    onChange({ documentChanged: true, pending: true })
    expect(record).not.toHaveBeenCalled()
    expect(started.current).toBe(12)
    onChange({ documentChanged: true, pending: false })
    expect(record).toHaveBeenCalledExactlyOnceWith('file', 12, 'group', 'commit', undefined)
    expect(started.current).toBeUndefined()
  })

  it.each([false, true])(
    'publishes pending text before destruction (preloaded=%s)',
    async (preloaded) => {
      let liveMarkdown = 'A'
      let notifyChange: ((event?: CapricornEditorChangeEvent) => void) | undefined
      const trace: string[] = []
      const adapter = {
        destroy: vi.fn(() => trace.push('adapter-destroy')),
        getMarkdown: vi.fn(() => {
          trace.push(`read:${liveMarkdown}`)
          return liveMarkdown
        }),
        isComposing: () => false,
        updateSettings: vi.fn(),
      } as unknown as CapricornRuntimeAdapter
      if (preloaded) vi.mocked(getLoadedCapricornRuntimeFactory).mockReturnValue(vi.fn())
      vi.mocked(loadCapricornRuntimeFactory).mockResolvedValue(vi.fn())
      vi.mocked(createCapricornRuntimeAdapter).mockImplementation(({ onChange }) => {
        notifyChange = onChange
        return adapter
      })
      const ref = createRef<CapricornEditorHandle>()
      const published: string[] = []
      const publisher = createDeferredLatestPublisher<{ getMarkdown: () => string }>(
        (snapshot) => {
          published.push(snapshot.getMarkdown())
        },
        { wait: 50, maxWait: 250 },
      )
      const onChange = createHostChangeHandler({
        id: 'file',
        instanceIdRef: { current: 'source' },
        editorSnapshotRegistry: { changed: vi.fn() },
        hasVisibleSiblingRef: { current: false },
        compositionDirtyRef: { current: null },
        isUnmountingRef: { current: false },
        autosave: false,
        capricornEditorRef: ref,
        capricornRuntimeAdapterRef: { current: adapter },
        capricornStatisticsScheduler: { cancel: vi.fn(), schedule: vi.fn() },
        activeRef: { current: true },
        isApplyingRemoteContentRef: { current: false },
        savePathReserved: false,
        externalChangeResolving: false,
        latestContentRef: { current: 'A' },
        useEditorStateStore: { getState: () => ({ setIdStateMap: vi.fn() }) },
        snapshotPublisher: publisher,
        recordEditorInteractionMeasurement: vi.fn(),
        groupId: 'group',
        interactionStartedAtRef: { current: undefined },
        interactionOpenRequestIdRef: { current: undefined },
      })
      function Parent() {
        useEffect(() => {
          return () => {
            trace.push(`parent-ref:${Boolean(ref.current)}`)
            publisher.flush()
            publisher.cancel()
          }
        }, [])
        return (
          <CapricornEditor
            active
            initialMarkdown='A'
            ref={ref}
            options={{}}
            onChange={onChange}
            onError={vi.fn()}
            onUnavailable={vi.fn()}
          />
        )
      }
      const { unmount } = render(<Parent />)
      await waitFor(() => expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce())
      liveMarkdown = 'B'
      act(() => notifyChange!({ documentChanged: true, pending: true }))
      expect(publisher.hasPending()).toBe(true)
      expect(adapter.getMarkdown).not.toHaveBeenCalled()
      unmount()

      expect(published).toEqual(['B'])
      expect(trace).toEqual(['parent-ref:false', 'read:B', 'adapter-destroy'])
      expect(publisher.hasPending()).toBe(false)
    },
  )

  it('keeps newer edits when flushed host snapshots render and still applies external replacements', async () => {
    let liveMarkdown = '# Initial'
    const adapter = {
      commands: {},
      find: {},
      headings: {},
      destroy: vi.fn(),
      export: vi.fn(async () => liveMarkdown),
      focus: vi.fn(),
      getMarkdown: vi.fn(() => liveMarkdown),
      getUiState: vi.fn(),
      requestImageInsert: vi.fn(),
      setMarkdown: vi.fn((markdown: string) => {
        liveMarkdown = markdown
      }),
      subscribeUiState: vi.fn(),
      updateSettings: vi.fn(),
      waitForResources: vi.fn(async () => undefined),
    } as unknown as CapricornRuntimeAdapter
    vi.mocked(loadCapricornRuntimeFactory).mockResolvedValue(vi.fn())
    vi.mocked(createCapricornRuntimeAdapter).mockImplementation(({ options }) => {
      liveMarkdown = options.markdown ?? ''
      return adapter
    })

    const ref = createRef<CapricornEditorHandle>()
    const props = {
      active: true,
      onChange: vi.fn(),
      onError: vi.fn(),
      onUnavailable: vi.fn(),
      options: {},
      ref,
    }
    const { rerender, unmount } = render(<CapricornEditor {...props} initialMarkdown='# Initial' />)
    await waitFor(() => expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce())
    const published: string[] = []
    const publisher = createDeferredLatestPublisher<() => string>(
      (readMarkdown) => {
        published.push(readMarkdown())
      },
      { wait: 50, maxWait: 250 },
    )

    // Flush two host snapshots, then continue editing before either React
    // render arrives. Neither acknowledgement may replace the live document.
    for (const markdown of ['# Snapshot A', '# Snapshot B']) {
      liveMarkdown = markdown
      publisher.schedule(() => ref.current!.getMarkdown())
      expect(publisher.flush()).toBe(true)
    }
    expect(published).toEqual(['# Snapshot A', '# Snapshot B'])
    liveMarkdown = '# Newer edit'
    for (const markdown of published) {
      rerender(<CapricornEditor {...props} initialMarkdown={markdown} />)
      expect(ref.current?.getMarkdown()).toBe('# Newer edit')
    }
    expect(adapter.setMarkdown).not.toHaveBeenCalled()
    expect(createCapricornRuntimeAdapter).toHaveBeenCalledOnce()

    // A real external reload can intentionally restore an earlier snapshot.
    act(() => ref.current?.setMarkdown('# Snapshot A'))
    expect(adapter.setMarkdown).toHaveBeenCalledExactlyOnceWith('# Snapshot A')
    expect(ref.current?.getMarkdown()).toBe('# Snapshot A')
    publisher.cancel()

    // Leaving WYSIWYG destroys its Controller; returning uses the current
    // host snapshot as the new seed, including a same-file replacement.
    unmount()
    expect(adapter.destroy).toHaveBeenCalledOnce()
    render(<CapricornEditor {...props} initialMarkdown='# Replacement on remount' />)
    await waitFor(() => expect(createCapricornRuntimeAdapter).toHaveBeenCalledTimes(2))
    expect(ref.current?.getMarkdown()).toBe('# Replacement on remount')
  })
})
