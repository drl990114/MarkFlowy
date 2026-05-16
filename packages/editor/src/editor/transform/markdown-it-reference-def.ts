import MarkdownIt from 'markdown-it'
import { Core, StateCore } from 'markdown-it/index.js'
import { isSpace, normalizeReference } from 'markdown-it/lib/common/utils.mjs'
import Token from 'markdown-it/lib/token.mjs'

export function reference(state, startLine, _endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]
  let nextLine = startLine + 1

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false
  }

  if (state.src.charCodeAt(pos) !== 0x5b /* [ */) {
    return false
  }

  function getNextLine(nextLine) {
    const endLine = state.lineMax

    if (nextLine >= endLine || state.isEmpty(nextLine)) {
      // empty line or end of input
      return null
    }

    let isContinuation = false

    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) {
      isContinuation = true
    }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) {
      isContinuation = true
    }

    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules('reference_def')
      const oldParentType = state.parentType
      state.parentType = 'reference_def'

      // Some tags can terminate paragraph without empty line.
      let terminate = false
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true
          break
        }
      }

      state.parentType = oldParentType
      if (terminate) {
        // terminated by another block
        return null
      }
    }

    const pos = state.bMarks[nextLine] + state.tShift[nextLine]
    const max = state.eMarks[nextLine]

    // max + 1 explicitly includes the newline
    return state.src.slice(pos, max + 1)
  }

  let str = state.src.slice(pos, max + 1)

  max = str.length
  let labelEnd = -1

  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos)
    if (ch === 0x5b /* [ */) {
      return false
    } else if (ch === 0x5d /* ] */) {
      labelEnd = pos
      break
    } else if (ch === 0x0a /* \n */) {
      const lineContent = getNextLine(nextLine)
      if (lineContent !== null) {
        str += lineContent
        max = str.length
        nextLine++
      }
    } else if (ch === 0x5c /* \ */) {
      pos++
      if (pos < max && str.charCodeAt(pos) === 0x0a) {
        const lineContent = getNextLine(nextLine)
        if (lineContent !== null) {
          str += lineContent
          max = str.length
          nextLine++
        }
      }
    }
  }

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3a /* : */) {
    return false
  }

  // [label]:   destination   'title'
  //         ^^^ skip optional whitespace here
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos)
    if (ch === 0x0a) {
      const lineContent = getNextLine(nextLine)
      if (lineContent !== null) {
        str += lineContent
        max = str.length
        nextLine++
      }
    } else if (isSpace(ch)) {
      /* eslint no-empty:0 */
    } else {
      break
    }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ parse this
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max)
  if (!destRes.ok) {
    return false
  }

  const href = state.md.normalizeLink(destRes.str)
  if (!state.md.validateLink(href)) {
    return false
  }

  pos = destRes.pos

  // save cursor state, we could require to rollback later
  const destEndPos = pos
  const destEndLineNo = nextLine

  // [label]:   destination   'title'
  //                       ^^^ skipping those spaces
  const start = pos
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos)
    if (ch === 0x0a) {
      const lineContent = getNextLine(nextLine)
      if (lineContent !== null) {
        str += lineContent
        max = str.length
        nextLine++
      }
    } else if (isSpace(ch)) {
      /* eslint no-empty:0 */
    } else {
      break
    }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ parse this
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max)
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine)
    if (lineContent === null) break
    str += lineContent
    pos = max
    max = str.length
    nextLine++
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes)
  }
  let title

  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str
    pos = titleRes.pos
  } else {
    title = ''
    pos = destEndPos
    nextLine = destEndLineNo
  }

  // skip trailing spaces until the rest of the line
  while (pos < max) {
    const ch = str.charCodeAt(pos)
    if (!isSpace(ch)) {
      break
    }
    pos++
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0a) {
    if (title) {
      // garbage at the end of the line after title,
      // but it could still be a valid reference if we roll back
      title = ''
      pos = destEndPos
      nextLine = destEndLineNo
      while (pos < max) {
        const ch = str.charCodeAt(pos)
        if (!isSpace(ch)) {
          break
        }
        pos++
      }
    }
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0a) {
    // garbage at the end of the line
    return false
  }

  const label = str.slice(1, labelEnd)
  const normalizeLabel = normalizeReference(label)
  if (!label) {
    // CommonMark 0.20 disallows empty labels
    return false
  }

  // Reference can not terminate anything. This check is for safety only.
  /* istanbul ignore if */
  if (silent) {
    return true
  }

  const token = state.push('reference_def', '', 0)
  token.info = label
  token.attrs = [
    ['label', label],
    ['href', href],
  ]
  if (title) {
    token.attrs.push(['title', title])
  }
  token.map = [startLine, startLine + 1]
  token.content = str

  if (typeof state.env.rmeReferences === 'undefined') {
    state.env.rmeReferences = {}
  }
  if (typeof state.env.rmeReferences[label] === 'undefined') {
    state.env.rmeReferences[normalizeLabel] = { title, href, label }
  }

  state.line = nextLine
  return true
}

const rule: Core.RuleCore = (state: StateCore) => {
  let edited = false
  const tokens = state.tokens
  let tokensLength = tokens.length
  for (let i = 0; i <= tokensLength - 1; i++) {
    const curToken = tokens[i]

    if (curToken.type === 'reference_def') {
      console.log('reference_def', curToken)
      const label = curToken.attrs?.find((attr) => attr[0] === 'label')?.[1] || ''
      const href = curToken.attrs?.find((attr) => attr[0] === 'href')?.[1] || ''
      const title = curToken.attrs?.find((attr) => attr[0] === 'title')?.[1] || ''
      const labelToken = new Token('reference_label', 'span', 0)
      const hrefToken = new Token('reference_href', 'span', 0)
      const titleToken = new Token('reference_title', 'span', 0)
      labelToken.content = label
      hrefToken.content = href
      titleToken.content = title

      const openToken = new Token('reference_def_open', 'span', 0)
      const closeToken = new Token('reference_def_close', 'span', 0)
      openToken.attrs = [
        ['label', label],
        ['href', href],
        ['title', title],
      ]

      tokens.splice(i, 1, openToken, labelToken, hrefToken, titleToken, closeToken)
      i += 4
      tokensLength += 4
      edited = true
    }
  }

  return edited
}

export default function MarkdownItReference(md: MarkdownIt) {
  md.core.ruler.push('markdown-it-reference-def', rule)

  md.block.ruler.before('paragraph', 'reference_def', reference, {
    alt: ['paragraph', 'reference'],
  })
}
