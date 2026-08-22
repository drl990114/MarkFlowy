import type { Node, NodeType, Schema } from '@rme-sdk/sdk/pm/model'
import { Mark } from '@rme-sdk/sdk/pm/model'
import MarkdownIt from 'markdown-it'

import MarkdownItListCheckbox from './markdown-it-list-checkbox'
import MarkdownItReferenceImage from './markdown-it-reference-image'

import type { Token } from 'markdown-it/index.js'
import { front_matter_plugin } from './markdown-it-front-matter'
import MarkdownItHtmlInline from './markdown-it-html-inline'
import MarkdownItImage from './markdown-it-image'
import MarkdownItMath from './markdown-it-math'
import MarkdownItMermaid from './markdown-it-mermaid'
import MarkdownItReferenceDef from './markdown-it-reference-def'
import type {
  BlockParserRule,
  ContextParserRule,
  InlineParserRule,
  ParserRule,
  ParserRuleContext,
  TextParserRule,
} from './parser-type'
import { ParserRuleType } from './parser-type'

interface StackItem {
  type: NodeType
  attrs?: Record<string, any>
  content: Node[]
}

export type TokenHandler = (state: MarkdownParseState, tok: Token) => void
export type TokenHandlers = Record<string, TokenHandler>

export class UnknowMarkdownItTokenError extends Error {
  constructor(
    public tokenType: string,
    public supportedTokenTypes: string[],
  ) {
    super(`MarkdownIt token type '${tokenType}' not supported. `)
    this.tokenType = tokenType
  }
}

export class MarkdownParseState {
  private schema: Schema
  private marks: readonly Mark[]
  private tokenHandlers: TokenHandlers
  private contextStack: ParserRuleContext[]
  private contextTokenStack: Token[]

  public stack: StackItem[]

  public constructor(schema: Schema, tokenHandlers: TokenHandlers) {
    this.schema = schema
    this.stack = [{ type: schema.topNodeType, content: [] }]
    this.contextStack = []
    this.contextTokenStack = []
    this.marks = Mark.none
    this.tokenHandlers = tokenHandlers
  }

  public top(): StackItem {
    return this.stack[this.stack.length - 1]
  }

  public push(node: Node): void {
    if (this.stack.length) this.top().content.push(node)
  }

  // Adds the given text to the current position in the document,
  // using the current marks as styling.
  public addText(text: string): void {
    if (!text) return

    const top = this.top()
    const nodes = top.content
    const last: Node | undefined = nodes[nodes.length - 1]
    const node = this.schema.text(text, this.marks)
    let merged: Node | undefined
    if (last && (merged = this.mergeTextNode(last, node))) nodes[nodes.length - 1] = merged
    else nodes.push(node)
  }

  private mergeTextNode(a: Node, b: Node): Node | undefined {
    if (a.isText && b.isText && Mark.sameSet(a.marks, b.marks)) {
      const text: string = (a.text || '') + (b.text || '')
      return a.type.schema.text(text, a.marks)
    }
  }

  // Adds the given mark to the set of active marks.
  public openMark(mark: Mark): void {
    this.marks = mark.addToSet(this.marks)
  }

  // Removes the given mark from the set of active marks.
  public closeMark(mark: Mark): void {
    this.marks = mark.removeFromSet(this.marks)
  }

  public parseTokens(toks: Token[]): void {
    for (const tok of toks) {
      const handler = this.tokenHandlers[tok.type]
      if (!handler) return
      if (!handler) throw new UnknowMarkdownItTokenError(tok.type, Object.keys(this.tokenHandlers))

      // 递归处理inline token的children
      if (tok.type === 'inline' && tok.children && tok.children.length > 0) {
        this.parseTokens(tok.children)
      } else {
        handler(this, tok)
      }
    }
  }

  // Add a node at the current position.
  public addNode(type: NodeType, attrs?: Record<string, any>, content?: Node[]): Node {
    const node = type.createAndFill(attrs, content, this.marks)
    if (!node) {
      throw new Error(`unexpected error: node is empty while creating ${type.name} node`)
    }
    this.push(node)
    return node
  }

  // Wrap subsequent content in a node of the given type.
  public openNode(type: NodeType, attrs?: Record<string, any>): void {
    this.stack.push({ type: type, attrs: attrs, content: [] })
  }

  // Close and return the node that is currently on top of the stack.
  public closeNode(): Node {
    if (this.marks.length) this.marks = Mark.none
    const info = this.stack.pop()
    if (!info) {
      throw new Error('unexpected error: info is empty')
    }
    return this.addNode(info.type, info.attrs, info.content)
  }

  public openContext(context: ParserRuleContext, token: Token): void {
    this.contextStack.push(context)
    this.contextTokenStack.push(token)
  }

  public closeContext() {
    this.contextStack.pop()
    this.contextTokenStack.pop()
  }

  public closeContextToken(): Token | undefined {
    return this.contextTokenStack.pop()
  }

  public topContext(): ParserRuleContext | undefined {
    return this.contextStack[this.contextStack.length - 1]
  }

  public topContextToken(): Token | undefined {
    return this.contextTokenStack[this.contextTokenStack.length - 1]
  }
}

function withoutTrailingNewline(str: string): string {
  return str.endsWith('\n') ? str.slice(0, str.length - 1) : str
}

function buildBlockTokenHandler(
  parserRule: BlockParserRule,
  handlers: TokenHandlers,
  schema: Schema,
): void {
  const nodeType: NodeType = schema.nodes[parserRule.node]
  if (nodeType === undefined) {
    throw new RangeError(`Can't find block type '${parserRule.node}'`)
  }
  if (parserRule.hasOpenClose) {
    handlers[parserRule.token + '_open'] = (state: MarkdownParseState, tok: Token) => {
      const attrs = parserRule.getAttrs ? parserRule.getAttrs(tok) : undefined
      state.openNode(nodeType, attrs)
    }
    handlers[parserRule.token + '_close'] = (state: MarkdownParseState) => {
      state.closeNode()
    }
  } else {
    handlers[parserRule.token] = (state: MarkdownParseState, tok: Token) => {
      const attrs = parserRule.getAttrs ? parserRule.getAttrs(tok) : undefined
      state.openNode(nodeType, attrs)
      state.addText(withoutTrailingNewline(tok.content))
      state.closeNode()
    }
  }
}

function buildContextTokenHandler(parserRule: ContextParserRule, handlers: TokenHandlers): void {
  handlers[parserRule.token + '_open'] = (state: MarkdownParseState, tok: Token) => {
    state.openContext(parserRule.context, tok)
  }
  handlers[parserRule.token + '_close'] = (state: MarkdownParseState) => {
    state.closeContext()
  }
}

function buildInlineNodeHandler(
  parserRule: InlineParserRule,
  handlers: TokenHandlers,
  schema: Schema,
) {
  const nodeType: NodeType = schema.nodes[parserRule.token]
  if (nodeType === undefined) {
    throw new RangeError(`Can't find inline type '${parserRule.token}'`)
  }
  handlers[parserRule.token] = (state: MarkdownParseState, tok: Token) => {
    const attrs = (tok.attrs as Record<string, any>) || null

    let content = undefined
    if (tok.content && !nodeType.isAtom) {
      content = schema.text(tok.content)
    }
    const inlinNode = schema.nodes[tok.type]?.createAndFill(attrs, content)
    if (inlinNode) {
      state.push(inlinNode)
    }
  }
}

function buildTextTokenHandler(parserRule: TextParserRule, handlers: TokenHandlers): void {
  handlers[parserRule.token] = (state: MarkdownParseState, tok: Token) => {
    state.addText(parserRule.getText(tok))
  }
}

function buildTokenHandlers(schema: Schema, parserRules: ParserRule[]): TokenHandlers {
  const handlers: TokenHandlers = {}
  for (const parserRule of parserRules) {
    switch (parserRule.type) {
      case ParserRuleType.text:
        buildTextTokenHandler(parserRule, handlers)
        break
      case ParserRuleType.block:
        buildBlockTokenHandler(parserRule, handlers, schema)
        break
      case ParserRuleType.context:
        buildContextTokenHandler(parserRule, handlers)
        break
      case ParserRuleType.ignore:
        handlers[parserRule.token] = () => {}
        break
      case ParserRuleType.inline:
        buildInlineNodeHandler(parserRule, handlers, schema)
        break
      case ParserRuleType.free:
        handlers[parserRule.token] = parserRule.handler
        break
      default:
        throw new Error(`unknown parser rule type`)
    }
  }

  return handlers
}

function isListOpenToken(token: Token): boolean {
  return token.type === 'bullet_list_open' || token.type === 'ordered_list_open'
}

function isListCloseToken(token: Token): boolean {
  return token.type === 'bullet_list_close' || token.type === 'ordered_list_close'
}

function containsOnlyTopLevelLists(tokens: Token[]): boolean {
  let listDepth = 0
  let sawList = false

  for (const token of tokens) {
    if (listDepth === 0) {
      if (!isListOpenToken(token)) return false
      listDepth = 1
      sawList = true
      continue
    }

    if (isListOpenToken(token)) {
      listDepth += 1
    } else if (isListCloseToken(token)) {
      listDepth -= 1
      if (listDepth < 0) return false
    }
  }

  return sawList && listDepth === 0
}

function stripFourSpaceIndent(sourceLines: string[]): string | null {
  const firstContentLine = sourceLines.find((line) => line.trim().length > 0)
  if (!firstContentLine?.startsWith('    ')) return null

  const stripped: string[] = []
  for (const line of sourceLines) {
    if (line.trim().length === 0) {
      stripped.push('')
      continue
    }
    if (!line.startsWith('    ')) return null
    stripped.push(line.slice(4))
  }

  return stripped.join('\n')
}

function looksLikeCanonicalListSource(source: string): boolean {
  const rootListMarker = /^(?:[-+*]|\d{1,9}[.)])[ \t]+/
  return source.split('\n').every((line) => {
    return line.trim().length === 0 || line.startsWith('    ') || rootListMarker.test(line)
  })
}

function replaceRootIndentedLists(tokenizer: MarkdownIt, source: string, tokens: Token[]): Token[] {
  const sourceLines = source.split(/\r?\n/)
  const normalized: Token[] = []

  for (const token of tokens) {
    if (token.type !== 'code_block' || token.level !== 0 || !token.map) {
      normalized.push(token)
      continue
    }

    const candidate = stripFourSpaceIndent(sourceLines.slice(token.map[0], token.map[1]))
    if (candidate === null || !looksLikeCanonicalListSource(candidate)) {
      normalized.push(token)
      continue
    }

    const candidateTokens = tokenizer.parse(candidate, {})
    if (!containsOnlyTopLevelLists(candidateTokens)) {
      normalized.push(token)
      continue
    }

    normalized.push(...candidateTokens)
  }

  return normalized
}

function annotateListTightness(tokens: Token[]): void {
  const listStack: Token[] = []

  for (const token of tokens) {
    if (isListOpenToken(token)) {
      token.meta = { ...token.meta, tight: true }
      listStack.push(token)
      continue
    }

    if (token.type === 'paragraph_open' && token.hidden === false) {
      const list = listStack[listStack.length - 1]
      if (list && token.level === list.level + 2) {
        list.meta = { ...list.meta, tight: false }
      }
      continue
    }

    if (isListCloseToken(token)) {
      listStack.pop()
    }
  }
}

export class MarkdownParser {
  private schema: Schema
  private tokenizer: MarkdownIt
  private tokenHandlers: TokenHandlers

  public constructor(schema: Schema, parserRules: ParserRule[]) {
    this.schema = schema
    this.tokenizer = MarkdownIt('commonmark', { html: true })
      .disable(['emphasis', 'autolink', 'backticks', 'entity', 'reference', 'link'])
      .enable(['table'])
      .use(front_matter_plugin, function (res: any) {
        console.log('Front matter content:', res)
      })
      .use(MarkdownItHtmlInline)
      .use(MarkdownItListCheckbox)
      .use(MarkdownItMermaid)
      .use(MarkdownItMath)
      .use(MarkdownItImage)
      .use(MarkdownItReferenceImage)
      .use(MarkdownItReferenceDef)

    // Custom validateLink function to allow data:application/octet-stream URIs
    this.tokenizer.validateLink = (url: string) => {
      // Allow all data: URIs (including application/octet-stream)
      if (url.startsWith('data:')) {
        return true
      }
      // Use default validation for other URLs
      return MarkdownIt().validateLink(url)
    }

    this.tokenizer.normalizeLink = (url: string) => {
      // Prevent normalization that could alter data:application/octet-stream URIs
      return url
    }

    this.tokenHandlers = buildTokenHandlers(schema, parserRules)
  }

  public parse(text: string): Node {
    const state = new MarkdownParseState(this.schema, this.tokenHandlers)
    let doc: Node
    const mdTokens = replaceRootIndentedLists(this.tokenizer, text, this.tokenizer.parse(text, {}))
    annotateListTightness(mdTokens)
    state.parseTokens(mdTokens)
    do {
      doc = state.closeNode()
    } while (state.stack.length)
    return doc
  }
}
