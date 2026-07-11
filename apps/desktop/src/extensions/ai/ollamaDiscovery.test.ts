import { describe, expect, it, vi } from 'vitest'
import { discoverOllamaModels, getOllamaDiscoveryQueryKey } from './ollamaDiscovery'

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Ollama discovery', () => {
  it('discovers tags, filters known non-completion models and keeps unknown models', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/tags')) {
        return jsonResponse({
          models: [
            { name: 'chat:latest' },
            { model: 'embed-only' },
            { name: 'old-server-model' },
            { name: 'chat:latest' },
          ],
        })
      }

      const model = JSON.parse(String(init?.body)).model
      if (model === 'chat:latest') return jsonResponse({ capabilities: ['completion', 'vision'] })
      if (model === 'embed-only') return jsonResponse({ capabilities: ['embedding'] })
      return jsonResponse({ details: { family: 'legacy' } })
    })

    const result = await discoverOllamaModels({
      apiBaseUrl: 'http://localhost:11434',
      headers: { Authorization: 'Bearer local' },
      fetchFn: fetchFn as typeof fetch,
    })

    expect(result.apiBaseUrl).toBe('http://localhost:11434/api')
    expect(result.models).toEqual([
      { modelId: 'chat:latest', capability: 'completion' },
      { modelId: 'old-server-model', capability: 'unknown' },
    ])
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({
        headers: { Authorization: 'Bearer local' },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('treats an unavailable /api/show endpoint as capability unknown', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ models: [{ name: 'legacy' }] }))
      .mockResolvedValueOnce(jsonResponse({}, 404))

    await expect(discoverOllamaModels({ fetchFn: fetchFn as typeof fetch })).resolves.toEqual(
      expect.objectContaining({
        models: [{ modelId: 'legacy', capability: 'unknown' }],
      }),
    )
  })

  it('throws when tags cannot be reached so the query can expose offline state', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 503))
    await expect(discoverOllamaModels({ fetchFn: fetchFn as typeof fetch })).rejects.toThrow(
      'Ollama /api/tags failed with HTTP 503',
    )
  })

  it('creates a stable query key for reordered headers and host forms', () => {
    const queryKey = getOllamaDiscoveryQueryKey('http://localhost:11434/', {
      Z: 'secret-token',
      A: '1',
    })
    expect(queryKey).toEqual(
      getOllamaDiscoveryQueryKey('http://localhost:11434/api', {
        A: '1',
        Z: 'secret-token',
      }),
    )
    expect(JSON.stringify(queryKey)).not.toContain('secret-token')
  })
})
