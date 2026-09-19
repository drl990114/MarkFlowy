import { describe, expect, it } from 'vitest'
import { rankPaletteCommands } from './commandPaletteSearch'

const commands = [
  { id: 'save', label: '保存', categoryLabel: '文件', keywords: ['Save', 'File'] },
  { id: 'saveAll', label: '保存全部', categoryLabel: '文件', keywords: ['Save All'] },
  { id: 'bold', label: '粗体', categoryLabel: '编辑', keywords: ['Bold', 'Strong'] },
]

describe('command palette search', () => {
  it('matches local names, English names, aliases, categories and IDs', () => {
    for (const query of ['粗体', 'bold', 'STRONG', '编辑'])
      expect(rankPaletteCommands(commands, query, [])[0].id).toBe('bold')
    expect(rankPaletteCommands(commands, '文件', [])).toHaveLength(2)
    expect(rankPaletteCommands(commands, 'saveAll', [])[0].id).toBe('saveAll')
    expect(rankPaletteCommands(commands, 'zzzzzzzz', [])).toEqual([])
  })

  it('ranks relevance before history and preserves deterministic ties', () => {
    expect(rankPaletteCommands(commands, 'Save', ['saveAll']).map(({ id }) => id)).toEqual([
      'save',
      'saveAll',
    ])
    const tied = commands.map((command) => ({ ...command, label: 'Same', keywords: [] }))
    expect(rankPaletteCommands(tied, 'Same', ['bold']).map(({ id }) => id)).toEqual([
      'bold',
      'save',
      'saveAll',
    ])
    expect(rankPaletteCommands(commands, '  ', ['bold'])).toEqual(commands)
  })
})
