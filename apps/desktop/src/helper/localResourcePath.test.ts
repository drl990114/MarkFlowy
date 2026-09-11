import { expect, test } from 'vitest'
import { localResourcePath, resourceFragment } from './localResourcePath'

test.each([
  ['./my notes/a b.md', './my notes/a b.md'],
  ['./中文%20a.md#标题', './中文 a.md'],
  ['./100%.md', './100%.md'],
  ['./100%/a%20b.md', './100%/a b.md'],
  ['./100%25/a%2520b.md', './100%/a%20b.md'],
  ['./a%2520.md', './a%20.md'],
  ['./a%23b.md#heading', './a#b.md'],
  ['file://server/share/a%20b.md', '//server/share/a b.md'],
  ['file:///C:/my%20notes/a.md', 'C:/my notes/a.md'],
])('resolves %s without rewriting the source', (source, path) => {
  expect(localResourcePath(source)).toBe(path)
})
test('fragments are separated before decoding', () => {
  expect(resourceFragment('./a%23b.md#中文')).toBe('中文')
  expect(resourceFragment('./a%23b.md')).toBeUndefined()
})
