import { htmlToProsemirrorNode } from '@rme-sdk/core'
import { describe, expect, it } from 'vitest'

import { setupTestingEditor } from '../../../../test/setup-editor'

describe('createParseDomRules', () => {
  const t = setupTestingEditor()
  const schema = t.schema

  it('can parse bullet list HTML', () => {
    const content = /*html*/ `
      <ul>
        <li>A1</li>
        <li>A2</li>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })

    expect(node).toEqualRemirrorDocument(
      t.doc(t.bulletList(t.p('A1')), t.bulletList(t.p('A2'))),
    )
  })

  it('can parse nested list HTML', () => {
    const content = /*html*/ `
      <ul>
        <li>
          <span>A1</span>
        </li>
        <li>
          <span>A2</span>
          <ol>
            <li><span>B1</span></li>
            <li><span>B2</span></li>
          </ol>
        </li>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })

    expect(node).toEqualRemirrorDocument(
      t.doc(
        t.bulletList(t.p('A1')),
        t.bulletList(
          t.p('A2'),
          t.orderedList(t.p('B1')),
          t.orderedList(t.p('B2')),
        ),
      ),
    )
  })

  it('can parse invalid nested list HTML copied from Dropbox Paper', () => {
    // The HTML is copied from Dropbox Paper. It's technically invalid because
    // <ul> should not be nested directly inside another <ul>, but we should
    // still handle it.
    const content = /*html*/ `
      <meta charset='utf-8'>
      <ul class="listtype-bullet listindent1 list-bullet1">
          <li>
            <span>A1</span>
          </li>
          <li>
            <span>A2</span>
          </li>
          <ol start="1" class="listtype-number listindent2 list-number2" style="list-style-type: lower-latin;">
              <li><span>B1</span></li>
              <li><span>B2</span></li>
          </ol>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })

    expect(node).toEqualRemirrorDocument(
      t.doc(
        t.bulletList(t.p('A1')),
        t.bulletList(t.p('A2')),
        t.bulletList(
          //
          t.orderedList(t.p('B1')),
          t.orderedList(t.p('B2')),
        ),
      ),
    )
  })

  it('can parse checkbox', () => {
    const content = /*html*/ `
      <ul>
        <li><input type="checkbox" checked><span>A1</span></li>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })
    expect(node).toEqualRemirrorDocument(t.doc(t.checkedTaskList(t.p('A1'))))
  })

  it('can parse checkbox in label', () => {
    const content = /*html*/ `
      <ul>
        <li><label><input type="checkbox" checked>A1</label></li>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })
    expect(node).toEqualRemirrorDocument(t.doc(t.checkedTaskList(t.p('A1'))))
  })

  it('can parse checkbox in span', () => {
    const content = /*html*/ `
      <ul>
        <li><span><input type="checkbox" checked>A1</span></li>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })
    expect(node).toEqualRemirrorDocument(t.doc(t.checkedTaskList(t.p('A1'))))
  })

  it('can parse checkbox in span and label', () => {
    const content = /*html*/ `
      <ul>
        <li><span><label><input type="checkbox" checked>A1</label></span></li>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })
    expect(node).toEqualRemirrorDocument(t.doc(t.checkedTaskList(t.p('A1'))))
  })

  it('can parse TODO copied from Notion', () => {
    const content = /*html*/ `
      <meta charset='utf-8'>
      <ul>
      <li>[ ]  Unchecked</li>
      <li>[x]  Checked</li>
      </ul>
    `
    const node = htmlToProsemirrorNode({ schema, content })
    expect(node).toEqualRemirrorDocument(
      t.doc(
        t.uncheckedTaskList(t.p('Unchecked')),
        t.checkedTaskList(t.p('Checked')),
      ),
    )
  })
})
