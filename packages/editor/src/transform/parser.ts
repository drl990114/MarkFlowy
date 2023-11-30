import type { Node, NodeType, Schema } from '@remirror/pm/model'
import { Mark } from '@remirror/pm/model'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token'

import markdownItListCheckbox from './markdown-it-list-checkbox'

import type {
  BlockParserRule,
  ContextParserRule,
  InlineParserRule,
  ParserRule,
  ParserRuleContext,
  TextParserRule,
} from './parser-type'
import { ParserRuleType } from './parser-type'
import MarkdownItHtmlInline from './markdown-it-html-inline'

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

  public stack: StackItem[]

  public constructor(schema: Schema, tokenHandlers: TokenHandlers) {
    this.schema = schema
    this.stack = [{ type: schema.topNodeType, content: [] }]
    this.contextStack = []
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
      handler(this, tok)
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

  public openContext(context: ParserRuleContext): void {
    this.contextStack.push(context)
  }

  public closeContext() {
    this.contextStack.pop()
  }

  public topContext(): ParserRuleContext | undefined {
    return this.contextStack[this.contextStack.length - 1]
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
  handlers[parserRule.token + '_open'] = (state: MarkdownParseState) => {
    state.openContext(parserRule.context)
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
    const attrs = tok.attrs || null
    const inlinNode = schema.nodes[tok.type]?.createAndFill(attrs)
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

export class MarkdownParser {
  private schema: Schema
  private tokenizer: MarkdownIt
  private tokenHandlers: TokenHandlers

  public constructor(schema: Schema, parserRules: ParserRule[]) {
    this.schema = schema
    this.tokenizer = MarkdownIt('commonmark', { html: true })
      .disable(['emphasis', 'autolink', 'backticks', 'entity'])
      .enable(['table'])
      .use(markdownItListCheckbox)
      .use(MarkdownItHtmlInline)

    this.tokenHandlers = buildTokenHandlers(schema, parserRules)
  }

  public parse(text: string): Node {
    const state = new MarkdownParseState(this.schema, this.tokenHandlers)
    let doc: Node
    const mdTokens: Token[] = this.tokenizer.parse(text, {})
    console.log('tokens', mdTokens)
    state.parseTokens(mdTokens)
    do {
      doc = state.closeNode()
    } while (state.stack.length)
    return doc
  }
}
