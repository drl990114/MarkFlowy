import { describe, expect, it } from 'vitest'

import {
  hasFileExcludePatternsChanged,
  parseFileExcludePatternLines,
  resolveFileExcludePatterns,
  stringifyFileExcludePatternLines,
} from '../file-exclude'

describe('file exclusion patterns', () => {
  it('does not own the default exclusion list on the frontend', () => {
    expect(resolveFileExcludePatterns({})).toBe('')
  })

  it('normalizes pattern text for list editing', () => {
    expect(parseFileExcludePatternLines('\n .git \n\n.svn\r\n')).toEqual([
      '.git',
      '.svn',
    ])

    expect(stringifyFileExcludePatternLines([' .git ', '', '.svn'])).toBe(
      '.git\n.svn',
    )
  })

  it('detects file exclusion setting changes only', () => {
    expect(hasFileExcludePatternsChanged(
      { file_exclude_patterns: '.git' },
      { file_exclude_patterns: '.git\n.svn' },
    )).toBe(true)

    expect(hasFileExcludePatternsChanged(
      { file_exclude_patterns: '.git', theme: 'light' },
      { file_exclude_patterns: '.git', theme: 'dark' },
    )).toBe(false)
  })
})
