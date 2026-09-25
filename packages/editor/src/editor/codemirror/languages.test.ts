import { describe, expect, it } from 'vitest'
import { getLanguageMap, loadLanguage } from './codemirror'

describe('MATLAB code-block language', () => {
  it.each(['matlab', 'MATLAB', 'Matlab'])('loads %s through the editor language map', async (name) => {
    expect(getLanguageMap()[name.toLowerCase()]?.name).toBe('MATLAB')
    const matlab = await loadLanguage(name)
    expect(matlab).toBeDefined()
    expect(matlab).toBe(await loadLanguage('octave'))
    expect(getLanguageMap().octave.name).toBe('Octave')
  })
})
